import type { AiClientContext, AiMode } from "@/lib/ai/types";

const PAGE_HINTS: Record<string, string> = {
  "/": "Dashboard home with live balance, net P/L, and recent setups.",
  "/trade-journal": "Trade journal form for logging a new setup.",
  "/calendar": "Trade calendar with daily P/L and journal review.",
  "/trade-history": "History grid of logged trades.",
  "/pre-trade-checklist": "Pre-trade checklist and rule score.",
  "/analytics": "Analytics: equity curve, strategy performance, risk stats.",
  "/settings": "Workspace, accounts, theme, and MT5 settings.",
  "/coach": "Dedicated AI Coach view.",
};

export function pageLabelForPath(pathname: string | undefined) {
  if (!pathname) return "Unknown page";
  if (PAGE_HINTS[pathname]) return PAGE_HINTS[pathname];
  const match = Object.keys(PAGE_HINTS).find(
    (path) => path !== "/" && pathname.startsWith(path)
  );
  return match ? PAGE_HINTS[match] : pathname;
}

export function buildSystemPrompt(
  mode: AiMode,
  options: {
    context?: AiClientContext;
    insights?: string;
    emailDomain?: string | null;
  }
) {
  const page = pageLabelForPath(options.context?.pathname);
  const location = [
    options.context?.pathname || "/",
    options.context?.pageTitle,
    page,
  ]
    .filter(Boolean)
    .join(" — ");

  const session = [
    options.emailDomain ? `Signed-in email domain: ${options.emailDomain}` : "Signed in",
    options.context?.accountName
      ? `Active account: ${options.context.accountName}`
      : null,
  ]
    .filter(Boolean)
    .join(". ");

  if (mode === "support") {
    return [
      "You are Edge Log Support, a precise in-app technician for Edge Log by Owz.",
      "Help the user fix the product: journaling trades, calendar, checklists, analytics, accounts, MT5 link, auth, and theme.",
      "Be concise, calm, and stepwise. Use short markdown: bold labels, lists, and fenced code only when a setting or field name matters.",
      "Never invent account balances or trade results. If you lack a fact, say what to click instead.",
      "Do not discuss other traders' data. Do not ask for passwords.",
      `Current location: ${location}.`,
      session,
    ].join("\n");
  }

  return [
    "You are an AI trading coach for Edge Log by Owz.",
    "Speak like a trusted desk partner: direct, specific, and encouraging without hype.",
    "Analyze these specific stats when answering. Cite pairs, setups, and P/L from the journal. Do not invent trades.",
    "Call out leaks, streaks, and process — not generic motivational filler.",
    "Format with readable markdown: short sections, **bold** takeaways, and bullet lists.",
    "If the journal is empty, help them log the next setup well.",
    "Do not give personalized financial advice as a guarantee. Frame ideas as process, risk, and review.",
    `Current location: ${location}.`,
    session,
    options.insights
      ? `Here are the user's recent trades:\n${options.insights}`
      : "No trade snapshot is available yet.",
  ].join("\n");
}
