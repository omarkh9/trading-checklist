"use client";

import { useAccounts } from "@/components/accounts/AccountProvider";
import { CompactMarketClock } from "@/components/dashboard/CompactMarketClock";
import { PositionSizer } from "@/components/risk/PositionSizer";
import { useCachedTrades } from "@/components/trade-journal/useCachedTrades";
import { ThemeToggle } from "@/components/workspace/ThemeToggle";
import { useWorkspaceSettings } from "@/components/workspace/WorkspaceProvider";
import { DeskCard } from "@/components/ui/DeskCard";
import { NumberField } from "@/components/ui/NumberField";
import {
  listTimeZones,
  resolveDisplayTimeZone,
} from "@/lib/settings/workspace";
import {
  computeCurrentBalance,
  formatBalance,
  tradesForAccount,
} from "@/lib/trades/account-balance";
import { AUTO_TIME_ZONE } from "@/lib/types/settings";
import { desk } from "@/lib/ui/desk";
import { useMemo } from "react";

export function SettingsHub() {
  const { settings, setSettings } = useWorkspaceSettings();
  const { accounts, activeAccount, isLoaded: accountsLoaded } = useAccounts();
  const { trades, isLoaded: tradesLoaded } = useCachedTrades();
  const fallbackId = accounts[0]?.id ?? "";

  const currentBalance = useMemo(() => {
    if (!activeAccount) return 0;
    return computeCurrentBalance(
      activeAccount.startingBalance,
      tradesForAccount(trades, activeAccount.id, fallbackId)
    );
  }, [activeAccount, fallbackId, trades]);

  const timeZones = useMemo(() => listTimeZones(), []);
  const displayZone = resolveDisplayTimeZone(settings.timeZone);

  if (!accountsLoaded || !tradesLoaded) {
    return <div className="h-64 animate-pulse rounded-2xl bg-[#12121a]" />;
  }

  return (
    <div className="space-y-6">
      <DeskCard>
        <h3 className={desk.title}>Appearance</h3>
        <p className={desk.subtitle}>
          Switch the desk between the dark terminal and a clean light theme.
        </p>
        <div className="mt-5 max-w-md">
          <ThemeToggle variant="segmented" />
        </div>
      </DeskCard>

      <DeskCard>
        <h3 className={desk.title}>Risk guardrails</h3>
        <p className={desk.subtitle}>
          Defaults feed the journal sizer. Caps keep position size inside your
          rules even if a field is typed too aggressively.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={desk.label} htmlFor="default-risk">
              Default risk %
            </label>
            <NumberField
              id="default-risk"
              min={0}
              max={100}
              step="0.1"
              value={settings.defaultRiskPercent}
              emptyValue={0}
              onCommit={(defaultRiskPercent) =>
                setSettings({ defaultRiskPercent })
              }
              className={desk.input}
            />
          </div>
          <div>
            <label className={desk.label} htmlFor="max-risk">
              Max risk %
            </label>
            <NumberField
              id="max-risk"
              min={0}
              max={100}
              step="0.1"
              value={settings.maxRiskPercent}
              emptyValue={0}
              onCommit={(maxRiskPercent) => setSettings({ maxRiskPercent })}
              className={desk.input}
            />
          </div>
          <div>
            <label className={desk.label} htmlFor="daily-loss">
              Daily loss limit %
            </label>
            <NumberField
              id="daily-loss"
              min={0}
              max={100}
              step="0.1"
              value={settings.dailyLossLimitPercent}
              emptyValue={0}
              onCommit={(dailyLossLimitPercent) =>
                setSettings({ dailyLossLimitPercent })
              }
              className={desk.input}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Active account {activeAccount?.name ?? "—"} is at{" "}
          {formatBalance(currentBalance)}. Daily lockout uses that live balance.
        </p>
      </DeskCard>

      <PositionSizer
        accountBalance={currentBalance || activeAccount?.startingBalance || 0}
        defaultRiskPercent={settings.defaultRiskPercent}
        maxRiskPercent={settings.maxRiskPercent}
      />

      <DeskCard>
        <h3 className={desk.title}>Timezone & news</h3>
        <p className={desk.subtitle}>
          Calendar events and session clocks convert into this zone automatically.
        </p>
        <div className="mt-5">
          <CompactMarketClock />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={desk.label} htmlFor="timezone">
              Display timezone
            </label>
            <select
              id="timezone"
              value={settings.timeZone}
              onChange={(event) => setSettings({ timeZone: event.target.value })}
              className={desk.nativeSelect}
            >
              <option value={AUTO_TIME_ZONE}>Auto ({displayZone})</option>
              {timeZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={desk.label} htmlFor="news-impact">
              News impact filter
            </label>
            <select
              id="news-impact"
              value={settings.newsImpact}
              onChange={(event) =>
                setSettings({
                  newsImpact: event.target.value as typeof settings.newsImpact,
                })
              }
              className={desk.nativeSelect}
            >
              <option value="all">All events</option>
              <option value="medium">Medium and high</option>
              <option value="high">High impact only</option>
            </select>
          </div>
        </div>
      </DeskCard>
    </div>
  );
}
