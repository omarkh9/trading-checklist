// Netlify scheduled function: every hour, ask the app to pause MetaAPI accounts
// nobody has used for 6 hours (see app/api/mt5/idle/route.ts).
export default async () => {
  const secret = process.env.MT5_SYNC_SECRET || process.env.MT5_GATEWAY_SECRET;
  const site = process.env.URL;
  if (!secret || !site) {
    console.warn("mt5-idle: set MT5_SYNC_SECRET to enable idle pausing.");
    return;
  }
  const response = await fetch(`${site}/api/mt5/idle`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  console.info("mt5-idle", response.status, (await response.text()).slice(0, 500));
};

export const config = { schedule: "@hourly" };
