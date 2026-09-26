import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptStoredInvestorPassword } from "@/lib/mt5/secret";
import type { Database, Json } from "@/lib/supabase/database.types";

export type StoredMt5Credentials = {
  id: string;
  userId: string;
  login: string;
  server: string;
  investorPassword: string;
  connectionId: string | null;
};

type CredentialRow = {
  id: string;
  user_id: string;
  mt5_login?: string | null;
  mt5_server?: string | null;
  mt5_connection_id?: string | null;
  mt5_password?: string | null;
  mt5_investor_password_cipher?: string | null;
  mt5_credentials_set?: boolean | null;
};

const CREDENTIAL_SELECTS = [
  "id, user_id, mt5_login, mt5_server, mt5_connection_id, mt5_password, mt5_investor_password_cipher, mt5_credentials_set",
  "id, user_id, mt5_login, mt5_server, mt5_connection_id, mt5_password, mt5_credentials_set",
  "id, user_id, mt5_login, mt5_server, mt5_connection_id, mt5_investor_password_cipher, mt5_credentials_set",
  "id, user_id, mt5_login, mt5_server, mt5_connection_id, mt5_password",
  "id, user_id, mt5_login, mt5_server, mt5_connection_id, mt5_investor_password_cipher",
  "*",
  "id, user_id, mt5_login, mt5_server, mt5_connection_id, mt5_credentials_set",
];

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUnknownMt5Column(message: string) {
  const normalized = message.toLowerCase();
  return (
    /\bmt5_[a-z0-9_]+/.test(normalized) &&
    (normalized.includes("schema cache") ||
      normalized.includes("could not find") ||
      normalized.includes("does not exist") ||
      normalized.includes("column"))
  );
}

function isMissingRpc(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("load_mt5_account_credentials") &&
    (normalized.includes("could not find") ||
      normalized.includes("schema cache") ||
      normalized.includes("does not exist") ||
      normalized.includes("function"))
  );
}

function passwordFromCiphers(...values: unknown[]) {
  const seen = new Set<string>();
  for (const value of values) {
    const payload = asText(value);
    if (!payload || seen.has(payload)) continue;
    seen.add(payload);
    try {
      const password = decryptStoredInvestorPassword(payload);
      if (password) return password;
    } catch (cause) {
      console.error(
        "MT5 credential decrypt failed:",
        cause instanceof Error ? cause.message : cause
      );
    }
  }
  return "";
}

function fromRow(row: CredentialRow): StoredMt5Credentials {
  return {
    id: row.id,
    userId: row.user_id,
    login: asText(row.mt5_login),
    server: asText(row.mt5_server),
    investorPassword: passwordFromCiphers(
      row.mt5_investor_password_cipher,
      row.mt5_password
    ),
    connectionId: asText(row.mt5_connection_id) || null,
  };
}

function fromRpc(data: Json | null): StoredMt5Credentials | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (row.ok !== true) return null;
  const id = asText(row.accountId);
  const userId = asText(row.userId);
  if (!id || !userId) return null;
  return {
    id,
    userId,
    login: asText(row.login),
    server: asText(row.server),
    investorPassword: passwordFromCiphers(row.passwordCipher, row.password),
    connectionId: asText(row.connectionId) || null,
  };
}

async function loadViaRpc(
  supabase: SupabaseClient<Database>,
  accountId: string
) {
  const { data, error } = await supabase.rpc("load_mt5_account_credentials", {
    p_account_id: accountId,
  });
  if (error) {
    if (!isMissingRpc(error.message)) {
      console.error("Full Supabase Error:", error);
    }
    return null;
  }
  return fromRpc(data);
}

async function selectCredentialRows(
  supabase: SupabaseClient<Database>,
  input: { userId?: string; accountId?: string }
) {
  const filters = input.accountId
    ? [""]
    : [
        "mt5_credentials_set.eq.true,mt5_connection_id.not.is.null,mt5_login.not.is.null",
        "mt5_connection_id.not.is.null,mt5_login.not.is.null",
        "",
      ];
  let lastError = "";
  for (const columns of CREDENTIAL_SELECTS) {
    for (const filter of filters) {
      let query = supabase.from("trading_accounts").select(columns);
      if (input.userId) query = query.eq("user_id", input.userId);
      if (input.accountId) query = query.eq("id", input.accountId);
      if (filter) query = query.or(filter);
      const { data, error } = await query;
      if (!error) {
        const rows = (data ?? []) as unknown as CredentialRow[];
        if (!input.accountId && !filter) {
          return rows.filter(
            (row) =>
              asText(row.mt5_login) ||
              asText(row.mt5_connection_id) ||
              row.mt5_credentials_set ||
              asText(row.mt5_password) ||
              asText(row.mt5_investor_password_cipher)
          );
        }
        return rows;
      }
      lastError = error.message;
      if (!isUnknownMt5Column(error.message) && !filter) {
        throw new Error(error.message);
      }
    }
  }
  throw new Error(lastError || "Could not read saved MT5 credentials.");
}

export async function loadMt5StoredCredentials(
  supabase: SupabaseClient<Database>,
  input: { userId?: string; accountId?: string }
): Promise<StoredMt5Credentials[]> {
  const viaRpc = input.accountId ? await loadViaRpc(supabase, input.accountId) : null;
  if (
    viaRpc &&
    viaRpc.login &&
    viaRpc.server &&
    viaRpc.investorPassword &&
    (!input.userId || viaRpc.userId === input.userId)
  ) {
    return [viaRpc];
  }

  const rows = await selectCredentialRows(supabase, input);
  const loaded: StoredMt5Credentials[] = [];
  for (const row of rows) {
    let next = fromRow(row);
    if (!next.investorPassword) {
      const rpc = await loadViaRpc(supabase, row.id);
      if (rpc) {
        next = {
          ...next,
          login: next.login || rpc.login,
          server: next.server || rpc.server,
          investorPassword: rpc.investorPassword,
          connectionId: next.connectionId || rpc.connectionId,
        };
      }
    }
    if (viaRpc && viaRpc.id === next.id) {
      next = {
        ...next,
        login: next.login || viaRpc.login,
        server: next.server || viaRpc.server,
        investorPassword: next.investorPassword || viaRpc.investorPassword,
        connectionId: next.connectionId || viaRpc.connectionId,
      };
    }
    loaded.push(next);
  }

  if (loaded.length === 0 && viaRpc) return [viaRpc];
  return loaded;
}
