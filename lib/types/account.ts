export const MAX_TRADING_ACCOUNTS = 10;
export const DEFAULT_ACCOUNT_NAME = "Main";
export const DEFAULT_STARTING_BALANCE = 10_000;

export type TradingAccount = {
  id: string;
  name: string;
  startingBalance: number;
  createdAt: string;
  mt5Login: string;
  mt5Server: string;
  mt5TokenSet: boolean;
  mt5ConnectionId: string;
  mt5Balance: number | null;
  mt5Equity: number | null;
  mt5SyncedAt: string | null;
};

export type TradingAccountMt5Credentials = {
  login: string;
  investorPassword: string;
  server: string;
};

export type TradingAccountMt5Patch = {
  unlinkMt5?: boolean;
};

export const emptyMt5Link = (): Pick<
  TradingAccount,
  "mt5Login" | "mt5Server" | "mt5TokenSet" | "mt5ConnectionId" | "mt5Balance" | "mt5Equity" | "mt5SyncedAt"
> => ({
  mt5Login: "",
  mt5Server: "",
  mt5TokenSet: false,
  mt5ConnectionId: "",
  mt5Balance: null,
  mt5Equity: null,
  mt5SyncedAt: null,
});

export type AccountSettings = {
  startingBalance: number;
};

export const defaultAccountSettings = (): AccountSettings => ({
  startingBalance: DEFAULT_STARTING_BALANCE,
});

export function normalizeAccountName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 48);
}

export function nextAccountName(existing: TradingAccount[]) {
  const taken = new Set(existing.map((account) => account.name.toLowerCase()));
  if (!taken.has(DEFAULT_ACCOUNT_NAME.toLowerCase())) {
    return DEFAULT_ACCOUNT_NAME;
  }
  for (let index = 2; index <= MAX_TRADING_ACCOUNTS + 1; index += 1) {
    const candidate = `Account ${index}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `Account ${existing.length + 1}`;
}
