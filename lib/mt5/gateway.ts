import {
  getMetaApiToken,
  getMt5GatewaySecret,
  getMt5GatewayUrl,
} from "@/lib/mt5/env";

export class Mt5GatewayError extends Error {
  code: "invalid_credentials" | "unavailable" | "rejected";

  constructor(
    message: string,
    code: "invalid_credentials" | "unavailable" | "rejected" = "unavailable"
  ) {
    super(message);
    this.name = "Mt5GatewayError";
    this.code = code;
  }
}

export type Mt5ProvisionInput = {
  login: string;
  investorPassword: string;
  server: string;
  accountId: string;
  userId: string;
  webhookUrl: string;
  webhookToken: string;
};

export type Mt5ProvisionResult = {
  connectionId: string;
  balance: number | null;
  equity: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

async function readGatewayJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return asRecord(JSON.parse(text) as unknown);
  } catch {
    return { message: text.slice(0, 180) };
  }
}

async function provisionViaHttp(
  gatewayUrl: string,
  input: Mt5ProvisionInput
): Promise<Mt5ProvisionResult> {
  const secret = getMt5GatewaySecret();
  let response: Response;
  try {
    response = await fetch(`${gatewayUrl}/v1/connections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({
        login: input.login,
        password: input.investorPassword,
        investorPassword: input.investorPassword,
        server: input.server,
        accountId: input.accountId,
        userId: input.userId,
        webhookUrl: input.webhookUrl,
        webhookToken: input.webhookToken,
        platform: "mt5",
        readOnly: true,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Mt5GatewayError(
      "Could not reach the MT5 gateway. Try again in a moment.",
      "unavailable"
    );
  }

  const body = await readGatewayJson(response);
  if (response.status === 401 || response.status === 403) {
    throw new Mt5GatewayError(
      "MT5 rejected those credentials. Check the account number, investor password, and server.",
      "invalid_credentials"
    );
  }
  if (!response.ok || body.ok === false) {
    const error = pickString(body, ["error", "message", "error_description"]);
    if (response.status >= 500) {
      throw new Mt5GatewayError(
        "The MT5 gateway is unavailable. Try again in a moment.",
        "unavailable"
      );
    }
    throw new Mt5GatewayError(
      error ||
        "MT5 rejected those credentials. Check the account number, investor password, and server.",
      "rejected"
    );
  }

  return {
    connectionId:
      pickString(body, ["connectionId", "id", "accountId"]) ||
      crypto.randomUUID(),
    balance: pickNumber(body, ["balance"]),
    equity: pickNumber(body, ["equity"]),
  };
}

async function provisionViaMetaApi(
  token: string,
  input: Mt5ProvisionInput
): Promise<Mt5ProvisionResult> {
  let response: Response;
  try {
    response = await fetch(
      "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth-token": token,
        },
        body: JSON.stringify({
          login: input.login,
          password: input.investorPassword,
          name: `Edge Log ${input.login}`,
          server: input.server,
          platform: "mt5",
          magic: 0,
        }),
        signal: AbortSignal.timeout(20000),
      }
    );
  } catch {
    throw new Mt5GatewayError(
      "Could not reach the MT5 gateway. Try again in a moment.",
      "unavailable"
    );
  }

  const body = await readGatewayJson(response);
  if (!response.ok) {
    throw new Mt5GatewayError(
      "MT5 rejected those credentials. Check the account number, investor password, and server.",
      "invalid_credentials"
    );
  }

  return {
    connectionId: pickString(body, ["id", "connectionId"]) || crypto.randomUUID(),
    balance: pickNumber(body, ["balance"]),
    equity: pickNumber(body, ["equity"]),
  };
}

function provisionViaEdgeGateway(input: Mt5ProvisionInput): Mt5ProvisionResult {
  return {
    connectionId: `mt5:${input.accountId}:${input.login}`,
    balance: null,
    equity: null,
  };
}

export async function provisionMt5Connection(
  input: Mt5ProvisionInput
): Promise<Mt5ProvisionResult> {
  const gatewayUrl = getMt5GatewayUrl();
  if (gatewayUrl) return provisionViaHttp(gatewayUrl, input);

  const metaApiToken = getMetaApiToken();
  if (metaApiToken) return provisionViaMetaApi(metaApiToken, input);

  return provisionViaEdgeGateway(input);
}

export async function disconnectMt5Connection(connectionId: string) {
  const gatewayUrl = getMt5GatewayUrl();
  const secret = getMt5GatewaySecret();
  if (!gatewayUrl || !connectionId) return;

  try {
    await fetch(
      `${gatewayUrl}/v1/connections/${encodeURIComponent(connectionId)}`,
      {
        method: "DELETE",
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
        signal: AbortSignal.timeout(10000),
      }
    );
  } catch {
    // Unlink still succeeds locally if the gateway is briefly unreachable.
  }
}
