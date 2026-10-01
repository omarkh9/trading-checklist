export function normalizeMt5Login(value: string) {
  return value.trim().replace(/\s+/g, "");
}

// Broker server names can contain spaces ("VantageInternational-Live 3"), so
// only tidy them: removing the space names a server that doesn't exist.
export function normalizeMt5Server(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function hasMt5InvestorCredentials(input?: {
  login?: string | null;
  investorPassword?: string | null;
  server?: string | null;
}) {
  return Boolean(
    input?.login?.trim() &&
      input?.investorPassword?.trim() &&
      input?.server?.trim()
  );
}

export function validateMt5LinkInput(input: {
  login: string;
  investorPassword: string;
  server: string;
}) {
  const login = normalizeMt5Login(input.login);
  const server = normalizeMt5Server(input.server);
  const investorPassword = input.investorPassword.trim();

  if (!/^\d{5,32}$/.test(login)) {
    return {
      ok: false as const,
      error: "Enter a valid MT5 account number.",
    };
  }

  if (
    server.length < 3 ||
    server.length > 64 ||
    !/^[A-Za-z0-9._:-]+( [A-Za-z0-9._:-]+)*$/.test(server)
  ) {
    return {
      ok: false as const,
      error: "Enter the broker server name exactly as it appears in MT5.",
    };
  }

  if (investorPassword.length < 6 || investorPassword.length > 64) {
    return {
      ok: false as const,
      error: "Enter the investor (read-only) password for this account.",
    };
  }

  if (investorPassword === login) {
    return {
      ok: false as const,
      error: "Use the investor password, not the account number.",
    };
  }

  return { ok: true as const, login, server, investorPassword };
}
