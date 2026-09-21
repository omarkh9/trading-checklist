export function normalizeMt5Login(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function normalizeMt5Server(value: string) {
  return value.trim().replace(/\s+/g, "");
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

  if (!/^[A-Za-z0-9._:-]{3,64}$/.test(server)) {
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
