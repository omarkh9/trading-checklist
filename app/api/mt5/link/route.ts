import { NextResponse } from "next/server";
import { validateMt5LinkInput } from "@/lib/mt5/credentials";
import {
  disconnectMt5Connection,
  Mt5GatewayError,
  provisionMt5Connection,
} from "@/lib/mt5/gateway";
import { generateMt5WebhookToken, hashMt5WebhookToken } from "@/lib/mt5/token";
import { getMt5WebhookUrl } from "@/lib/mt5/webhook";
import type {
  TradingAccountInsert,
  TradingAccountRow,
  TradingAccountUpdate,
} from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_STARTING_BALANCE,
  emptyMt5Link,
  MAX_TRADING_ACCOUNTS,
  normalizeAccountName,
} from "@/lib/types/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccountRef = {
  id: string;
  mt5_connection_id: string | null;
};

type ListedAccount = Pick<TradingAccountRow, "id" | "name"> &
  Partial<TradingAccountRow>;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isUnknownMt5Column(message: string) {
  const normalized = message.toLowerCase();
  const mentionsMt5 = /\bmt5_[a-z0-9_]+/.test(normalized);
  if (!mentionsMt5) return false;
  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find") ||
    normalized.includes("does not exist") ||
    normalized.includes("column")
  );
}

function stripUnknownMt5Fields(
  fields: Record<string, unknown>,
  message: string
) {
  const next = { ...fields };
  const matches = message.toLowerCase().match(/mt5_[a-z0-9_]+/g) ?? [];
  for (const column of matches) {
    delete next[column];
  }
  if ("mt5_connection_id" in next) delete next.mt5_connection_id;
  return next;
}

function uniqueMt5AccountName(login: string, existingNames: string[]) {
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));
  const base = normalizeAccountName(`MT5 ${login}`);
  if (!taken.has(base.toLowerCase())) return base;
  for (let index = 2; index <= MAX_TRADING_ACCOUNTS + 2; index += 1) {
    const candidate = normalizeAccountName(`${base} ${index}`);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return normalizeAccountName(`${base} ${Date.now().toString().slice(-4)}`);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const requestedAccountId =
    typeof body.accountId === "string" ? body.accountId.trim() : "";

  const parsed = validateMt5LinkInput({
    login: typeof body.login === "string" ? body.login : "",
    investorPassword:
      typeof body.investorPassword === "string"
        ? body.investorPassword
        : typeof body.password === "string"
          ? body.password
          : "",
    server: typeof body.server === "string" ? body.server : "",
  });
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);

  const listed = await supabase
    .from("trading_accounts")
    .select("*")
    .eq("user_id", user.id);

  let rows: ListedAccount[] = listed.data ?? [];
  if (listed.error) {
    const fallback = await supabase
      .from("trading_accounts")
      .select("id, name, starting_balance, created_at")
      .eq("user_id", user.id);
    if (fallback.error) {
      return json({ ok: false, error: listed.error.message }, 400);
    }
    rows = fallback.data ?? [];
  }

  const byId = requestedAccountId
    ? rows.find((row) => row.id === requestedAccountId)
    : undefined;
  const byLogin = rows.find((row) => asText(row.mt5_login) === parsed.login);

  if (byId && byLogin && byId.id !== byLogin.id) {
    return json(
      {
        ok: false,
        error: "That MT5 account number is already linked to another journal.",
      },
      409
    );
  }

  let target: AccountRef;
  let created = false;
  let createdName = "";

  if (byLogin) {
    target = {
      id: byLogin.id,
      mt5_connection_id: byLogin.mt5_connection_id ?? null,
    };
  } else if (byId) {
    target = {
      id: byId.id,
      mt5_connection_id: byId.mt5_connection_id ?? null,
    };
  } else {
    if (rows.length >= MAX_TRADING_ACCOUNTS) {
      return json(
        {
          ok: false,
          error: `You can keep up to ${MAX_TRADING_ACCOUNTS} trading accounts.`,
        },
        409
      );
    }
    created = true;
    createdName = uniqueMt5AccountName(
      parsed.login,
      rows.map((row) => row.name)
    );
    target = {
      id: isUuid(requestedAccountId) ? requestedAccountId : crypto.randomUUID(),
      mt5_connection_id: null,
    };
  }

  const webhookToken = generateMt5WebhookToken();
  const tokenHash = await hashMt5WebhookToken(webhookToken);

  let provisioned;
  try {
    provisioned = await provisionMt5Connection({
      login: parsed.login,
      investorPassword: parsed.investorPassword,
      server: parsed.server,
      accountId: target.id,
      userId: user.id,
      webhookUrl: getMt5WebhookUrl(),
      webhookToken,
    });
  } catch (cause) {
    const message =
      cause instanceof Mt5GatewayError
        ? cause.message
        : "Could not validate those MT5 credentials.";
    const status =
      cause instanceof Mt5GatewayError && cause.code === "unavailable"
        ? 503
        : 422;
    return json({ ok: false, error: message }, status);
  }

  if (
    target.mt5_connection_id &&
    target.mt5_connection_id !== provisioned.connectionId
  ) {
    await disconnectMt5Connection(target.mt5_connection_id);
  }

  const mt5Fields = {
    mt5_login: parsed.login,
    mt5_server: parsed.server,
    mt5_webhook_token_hash: tokenHash,
    mt5_connection_id: provisioned.connectionId,
    mt5_balance: provisioned.balance,
    mt5_equity: provisioned.equity,
    mt5_synced_at:
      provisioned.balance != null ? new Date().toISOString() : null,
  };

  const startingBalance =
    provisioned.balance != null &&
    Number.isFinite(provisioned.balance) &&
    provisioned.balance >= 0
      ? provisioned.balance
      : DEFAULT_STARTING_BALANCE;

  const persistPayloads: Record<string, unknown>[] = [mt5Fields];
  if ("mt5_connection_id" in mt5Fields) {
    const { mt5_connection_id: _connectionId, ...withoutConnection } = mt5Fields;
    persistPayloads.push(withoutConnection);
  }
  persistPayloads.push({
    mt5_login: parsed.login,
    mt5_server: parsed.server,
    mt5_webhook_token_hash: tokenHash,
  });

  let persistError: { message: string } | null = null;
  for (let index = 0; index < persistPayloads.length; index += 1) {
    let fields = persistPayloads[index];
    if (persistError) {
      fields = stripUnknownMt5Fields(fields, persistError.message);
    }

    const payload = {
      id: target.id,
      user_id: user.id,
      name: createdName,
      starting_balance: startingBalance,
      ...fields,
    } as TradingAccountInsert;
    const result = created
      ? await supabase.from("trading_accounts").insert(payload)
      : await supabase
          .from("trading_accounts")
          .update(fields as TradingAccountUpdate)
          .eq("id", target.id)
          .eq("user_id", user.id);

    persistError = result.error;
    if (!persistError) break;
    if (!isUnknownMt5Column(persistError.message)) break;
  }

  if (persistError && created) {
    const coreInsert = await supabase.from("trading_accounts").insert({
      id: target.id,
      user_id: user.id,
      name: createdName,
      starting_balance: startingBalance,
    });
    if (!coreInsert.error) {
      const retry = await supabase
        .from("trading_accounts")
          .update(mt5Fields as TradingAccountUpdate)
        .eq("id", target.id)
        .eq("user_id", user.id);
      persistError = retry.error;
      if (persistError && isUnknownMt5Column(persistError.message)) {
        const reduced = stripUnknownMt5Fields(mt5Fields, persistError.message);
        const reducedUpdate = await supabase
          .from("trading_accounts")
          .update(reduced as TradingAccountUpdate)
          .eq("id", target.id)
          .eq("user_id", user.id);
        persistError = reducedUpdate.error;
      }
    }
  }

  if (persistError) {
    await disconnectMt5Connection(provisioned.connectionId);
    return json({ ok: false, error: persistError.message }, 400);
  }

  return json({
    ok: true,
    created,
    accountId: target.id,
    login: parsed.login,
    server: parsed.server,
    connectionId: provisioned.connectionId,
    balance: provisioned.balance,
    equity: provisioned.equity,
  });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const accountId = new URL(request.url).searchParams.get("accountId") ?? "";
  if (!accountId) {
    return json({ ok: false, error: "Account is required." }, 400);
  }

  const { data: account, error: accountError } = await supabase
    .from("trading_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError || !account) {
    const fallback = await supabase
      .from("trading_accounts")
      .select("id, name")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (fallback.error || !fallback.data) {
      return json({ ok: false, error: "Trading account not found." }, 404);
    }
    await supabase
      .from("trading_accounts")
      .update({
        mt5_login: null,
        mt5_server: null,
        mt5_webhook_token_hash: null,
        mt5_connection_id: null,
        mt5_balance: null,
        mt5_equity: null,
        mt5_synced_at: null,
      })
      .eq("id", accountId)
      .eq("user_id", user.id);
    return json({ ok: true, accountId, ...emptyMt5Link() });
  }

  if (account.mt5_connection_id) {
    await disconnectMt5Connection(account.mt5_connection_id);
  }

  const { error: updateError } = await supabase
    .from("trading_accounts")
    .update({
      mt5_login: null,
      mt5_server: null,
      mt5_webhook_token_hash: null,
      mt5_connection_id: null,
      mt5_balance: null,
      mt5_equity: null,
      mt5_synced_at: null,
    })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (updateError && isUnknownMt5Column(updateError.message)) {
    const reduced = stripUnknownMt5Fields(
      {
        mt5_login: null,
        mt5_server: null,
        mt5_webhook_token_hash: null,
        mt5_connection_id: null,
        mt5_balance: null,
        mt5_equity: null,
        mt5_synced_at: null,
      },
      updateError.message
    );
    const retry = await supabase
      .from("trading_accounts")
      .update(reduced as TradingAccountUpdate)
      .eq("id", accountId)
      .eq("user_id", user.id);
    if (retry.error) return json({ ok: false, error: retry.error.message }, 400);
    return json({ ok: true, accountId, ...emptyMt5Link() });
  }
  if (updateError) return json({ ok: false, error: updateError.message }, 400);

  return json({ ok: true, accountId, ...emptyMt5Link() });
}
