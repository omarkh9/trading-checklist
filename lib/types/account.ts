export type AccountSettings = {
  startingBalance: number;
};

export const defaultAccountSettings = (): AccountSettings => ({
  startingBalance: 10_000,
});
