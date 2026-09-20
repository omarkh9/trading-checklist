import { NextResponse } from "next/server";
import { validateMt5LinkInput } from "@/lib/mt5/credentials";
import {
  disconnectMt5Connection,
  Mt5GatewayError,
  provisionMt5Connection,
} from "@/lib/mt5/gateway";
import { generateMt5WebhookToken, hashMt5WebhookToken } from "@/lib/mt5/token";
import { getMt5WebhookUrl } from "@/lib/mt5/webhook";
import { createClient } from "@/lib/supabase/server";
import { emptyMt5Link } from "@/lib/types/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isMissingMt5Schema(message: string) {
  const normalized = message.toLowerCase();
  return (
    (normalized.includes("column") && normalized.includes("mt5")) ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
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

  const accountId = typeof body.accountId === "string" ? body.accountId : "";
  if (!accountId) {
    return json({ ok: false, error: "Account is required." }, 400);
  }

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

  const { data: account, error: accountError } = await supabase
    .from("trading_accounts")
    .select("id, mt5_connection_id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError || !account) {
    return json({ ok: false, error: "Trading account not found." }, 404);
  }

  const { data: taken } = await supabase
    .from("trading_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("mt5_login", parsed.login)
    .neq("id", accountId)
    .maybeSingle();

  if (taken) {
    return json(
      {
        ok: false,
        error: "That MT5 account number is already linked to another journal.",
      },
      409
    );
  }

  const webhookToken = generateMt5WebhookToken();
  const tokenHash = await hashMt5WebhookToken(webhookToken);

  let provisioned;
  try {
    provisioned = await provisionMt5Connection({
      login: parsed.login,
      investorPassword: parsed.investorPassword,
      server: parsed.server,
      accountId,
      userId: user.id,
      webhookUrl: getMt5WebhookUrl(),
      webhookToken,
    });
  } catch (cause) {
    const message =
      cause instanceof Mt5GatewayError
        ? cause.message
        : "Could not validate those MT5 credentials.";
    const status = cause instanceof Mt5GatewayError && cause.code === "unavailable" ? 503 : 422;
    return json({ ok: false, error: message }, status);
  }

  if (account.mt5_connection_id && account.mt5_connection_id !== provisioned.connectionId) {
    await disconnectMt5Connection(account.mt5_connection_id);
  }

  const { error: updateError } = await supabase
    .from("trading_accounts")
    .update({
      mt5_login: parsed.login,
      mt5_server: parsed.server,
      mt5_webhook_token_hash: tokenHash,
      mt5_connection_id: provisioned.connectionId,
      mt5_balance: provisioned.balance,
      mt5_equity: provisioned.equity,
      mt5_synced_at: provisioned.balance != null ? new Date().toISOString() : null,
    })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (updateError) {
    await disconnectMt5Connection(provisioned.connectionId);
    if (isMissingMt5Schema(updateError.message)) {
      return json(
        {
          ok: false,
          error:
            "MT5 columns are missing. Run supabase/mt5.sql in the Supabase SQL editor.",
        },
        503
      );
    }
    return json({ ok: false, error: updateError.message }, 400);
  }

  return json({
    ok: true,
    accountId,
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
    .select("id, mt5_connection_id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError || !account) {
    return json({ ok: false, error: "Trading account not found." }, 404);
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

  if (updateError && isMissingMt5Schema(updateError.message)) {
    return json(
      {
        ok: false,
        error:
          "MT5 columns are missing. Run supabase/mt5.sql in the Supabase SQL editor.",
      },
      503
    );
  }
  if (updateError) return json({ ok: false, error: updateError.message }, 400);

  return json({ ok: true, accountId, ...emptyMt5Link() });
}
