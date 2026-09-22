export function SidebarLiveStatus() {
  return (
    <div
      className="sidebar-status-indicator mt-3 flex items-center gap-2 px-1"
      aria-label="Live feed active"
    >
      <span className="green-circle relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>
      <span className="text-[12px] text-zinc-400">Live Feed Active</span>
    </div>
  );
}
