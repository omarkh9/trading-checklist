type LiveFeedBadgeProps = {
  active?: boolean;
};

export function LiveFeedBadge({ active = true }: LiveFeedBadgeProps) {
  return (
    <div
      className="live-feed-badge flex items-center justify-start gap-2"
      aria-label={active ? "Live feed active" : "Live feed offline"}
    >
      <span className="green-circle relative flex h-2.5 w-2.5 shrink-0">
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${
            active ? "animate-ping bg-emerald-500 opacity-70" : "bg-zinc-500 opacity-40"
          }`}
        />
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            active ? "bg-emerald-500" : "bg-zinc-500"
          }`}
        />
      </span>
      <span className={`text-[12px] ${active ? "text-zinc-400" : "text-zinc-500"}`}>
        {active ? "Live Feed Active" : "Feed offline"}
      </span>
    </div>
  );
}

/** @deprecated Use LiveFeedBadge on the economic calendar. */
export function SidebarLiveStatus() {
  return <LiveFeedBadge />;
}
