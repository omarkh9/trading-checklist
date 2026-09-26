import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, TradingAccountUpdate } from "@/lib/supabase/database.types";

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

function isMissingRpc(message: string, name: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(name) &&
    (normalized.includes("could not find") ||
      normalized.includes("schema cache") ||
      normalized.includes("does not exist") ||
      normalized.includes("function"))
  );
}

function stripOptionalMt5Fields(
  fields: Record<string, unknown>,
  message: string
) {
  const next = { ...fields };
  const matches = message.toLowerCase().match(/mt5_[a-z0-9_]+/g) ?? [];
  for (const column of matches) {
    if (column === "mt5_login" || column === "mt5_server") continue;
    delete next[column];
  }
  return next;
}

function asRpcResult(data: Json | null) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false as const, error: "Could not save MT5 credentials." };
  }
  const row = data as Record<string, unknown>;
  if (row.ok !== true) {
    return {
      ok: false as const,
      error:
        typeof row.error === "string" && row.error.trim()
          ? row.error
          : "Could not save MT5 credentials.",
    };
  }
  return {
    ok: true as const,
    accountId: typeof row.accountId === "string" ? row.accountId : "",
    login: typeof row.login === "string" ? row.login : "",
    server: typeof row.server === "string" ? row.server : "",
  };
}

async function persistViaRpc(
  supabase: SupabaseClient<Database>,
  input: {
    accountId: string;
    login: string;
    server: string;
    passwordCipher: string;
  }
) {
  const { data, error } = await supabase.rpc("save_mt5_account_credentials", {
    p_account_id: input.accountId,
    p_login: input.login,
    p_server: input.server,
    p_password_cipher: input.passwordCipher,
  });
  if (error) {
    if (isMissingRpc(error.message, "save_mt5_account_credentials")) return null;
    console.error("Full Supabase Error:", error);
    return { ok: false as const, error: error.message };
  }
  const parsed = asRpcResult(data);
  if (
    parsed.ok &&
    parsed.login === input.login &&
    parsed.server === input.server
  ) {
    return { ok: true as const, accountId: parsed.accountId || input.accountId };
  }
  return parsed.ok
    ? {
        ok: false as const,
        error: "MT5 credentials did not land on the account row.",
      }
    : parsed;
}

async function persistViaUpdate(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    accountId: string;
    login: string;
    server: string;
    passwordCipher: string;
  }
) {
  let fields: Record<string, unknown> = {
    mt5_login: input.login,
    mt5_server: input.server,
    mt5_password: input.passwordCipher,
    mt5_investor_password_cipher: input.passwordCipher,
    mt5_credentials_set: true,
  };

  let lastError = "";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (!("mt5_login" in fields) || !("mt5_server" in fields)) {
      break;
    }
    if (
      !("mt5_password" in fields) &&
      !("mt5_investor_password_cipher" in fields)
    ) {
      return {
        ok: false as const,
        error:
          "Could not write mt5_password. Run supabase/mt5.sql in the Supabase SQL editor.",
      };
    }

    const { data, error } = await supabase
      .from("trading_accounts")
      .update(fields as TradingAccountUpdate)
      .eq("id", input.accountId)
      .eq("user_id", input.userId)
      .select("id, mt5_login, mt5_server")
      .maybeSingle();

    if (
      !error &&
      data?.mt5_login === input.login &&
      data?.mt5_server === input.server
    ) {
      return { ok: true as const, accountId: data.id };
    }

    if (error) {
      lastError = error.message;
      console.error("Full Supabase Error:", error);
      if (!isUnknownMt5Column(error.message)) {
        return { ok: false as const, error: error.message };
      }
      fields = stripOptionalMt5Fields(fields, error.message);
      continue;
    }

    lastError = "MT5 credentials update matched no account row.";
    break;
  }

  return {
    ok: false as const,
    error:
      lastError ||
      "Could not save the MT5 login, password, and server on this account.",
  };
}

export async function persistMt5Credentials(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    accountId: string;
    login: string;
    server: string;
    passwordCipher: string;
  }
) {
  const viaRpc = await persistViaRpc(supabase, input);
  if (viaRpc) return viaRpc;
  return persistViaUpdate(supabase, input);
}

export async function persistMt5ConnectionMeta(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    accountId: string;
    fields: TradingAccountUpdate;
  }
) {
  const { error } = await supabase
    .from("trading_accounts")
    .update(input.fields)
    .eq("id", input.accountId)
    .eq("user_id", input.userId);
  if (error && isUnknownMt5Column(error.message)) {
    const reduced = stripOptionalMt5Fields(
      input.fields as Record<string, unknown>,
      error.message
    );
    await supabase
      .from("trading_accounts")
      .update(reduced as TradingAccountUpdate)
      .eq("id", input.accountId)
      .eq("user_id", input.userId);
    return;
  }
  if (error) {
    console.error("Full Supabase Error:", error);
  }
}

function asSnapshotRpcResult(data: Json | null) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (row.ok !== true) return null;
  const balance =
    typeof row.balance === "number" && Number.isFinite(row.balance)
      ? row.balance
      : typeof row.mt5_balance === "number" && Number.isFinite(row.mt5_balance)
        ? row.mt5_balance
        : null;
  const equity =
    typeof row.equity === "number" && Number.isFinite(row.equity)
      ? row.equity
      : typeof row.mt5_equity === "number" && Number.isFinite(row.mt5_equity)
        ? row.mt5_equity
        : null;
  if (balance == null) return null;
  return {
    balance,
    equity: equity ?? balance,
    syncedAt:
      typeof row.syncedAt === "string"
        ? row.syncedAt
        : typeof row.mt5_synced_at === "string"
          ? row.mt5_synced_at
          : null,
  };
}

function requireScopedAccount(accountId: string, userId: string) {
  const id = accountId.trim();
  const uid = userId.trim();
  const scoped =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!id || !uid || !scoped.test(id) || !scoped.test(uid)) {
    throw new Error(
      "MT5 sync refused to update trading_accounts without an exact account id and user id."
    );
  }
  return { accountId: id, userId: uid };
}

export async function persistMt5Snapshot(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    accountId: string;
    balance: number;
    equity: number;
    connectionId?: string;
    syncedAt: string;
  }
) {
  const scope = requireScopedAccount(input.accountId, input.userId);
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "save_mt5_account_snapshot",
    {
      p_account_id: scope.accountId,
      p_user_id: scope.userId,
      p_balance: input.balance,
      p_equity: input.equity,
      p_connection_id: input.connectionId ?? "",
    }
  );
  if (!rpcError) {
    const parsed = asSnapshotRpcResult(rpcData);
    if (parsed) return parsed;
  } else if (!isMissingRpc(rpcError.message, "save_mt5_account_snapshot")) {
    console.error("Full Supabase Error:", rpcError);
  }

  let fields: Record<string, unknown> = {
    mt5_balance: input.balance,
    mt5_equity: input.equity,
    mt5_synced_at: input.syncedAt,
    ...(input.connectionId ? { mt5_connection_id: input.connectionId } : {}),
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!("mt5_balance" in fields) || !("mt5_equity" in fields)) {
      break;
    }
    const { data, error } = await supabase
      .from("trading_accounts")
      .update(fields as TradingAccountUpdate)
      .eq("id", scope.accountId)
      .eq("user_id", scope.userId)
      .select("id, mt5_balance, mt5_equity, mt5_synced_at")
      .maybeSingle();

    if (data && "id" in data && data.id !== scope.accountId) {
      throw new Error("MT5 sync matched a different trading account.");
    }

    if (
      !error &&
      typeof data?.mt5_balance === "number" &&
      Number.isFinite(data.mt5_balance)
    ) {
      return {
        balance: data.mt5_balance,
        equity:
          typeof data.mt5_equity === "number" && Number.isFinite(data.mt5_equity)
            ? data.mt5_equity
            : input.equity,
        syncedAt: data.mt5_synced_at ?? input.syncedAt,
      };
    }

    if (error) {
      console.error("Full Supabase Error:", error);
      if (!isUnknownMt5Column(error.message)) break;
      const reduced = { ...fields };
      const matches = error.message.toLowerCase().match(/mt5_[a-z0-9_]+/g) ?? [];
      for (const column of matches) {
        if (
          column === "mt5_balance" ||
          column === "mt5_equity" ||
          column === "mt5_synced_at"
        ) {
          continue;
        }
        delete reduced[column];
      }
      if (Object.keys(reduced).length === Object.keys(fields).length) break;
      fields = reduced;
      continue;
    }

    break;
  }

  return {
    balance: input.balance,
    equity: input.equity,
    syncedAt: input.syncedAt,
  };
}
