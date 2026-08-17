import { Sidebar } from "@/components/Sidebar";

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
};

export function DashboardShell({
  children,
  title,
  description,
}: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface-raised/80 px-8 backdrop-blur-sm">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-zinc-500">{description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-zinc-300">Trader</p>
              <p className="text-xs text-zinc-500">Pro Account</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white ring-2 ring-surface-overlay">
              T
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
