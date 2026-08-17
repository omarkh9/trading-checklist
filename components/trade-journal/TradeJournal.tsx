"use client";

import { TradeForm } from "@/components/trade-journal/TradeForm";
import { TradeTable } from "@/components/trade-journal/TradeTable";
import type { Trade, TradeFormData } from "@/lib/types/trade";
import { useEffect, useState } from "react";

const STORAGE_KEY = "edge-log-trades";

function loadTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Trade[]) : [];
  } catch {
    return [];
  }
}

export function TradeJournal() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setTrades(loadTrades());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  }, [trades, isLoaded]);

  const handleSubmit = (data: TradeFormData) => {
    const trade: Trade = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setTrades((prev) => [trade, ...prev]);
  };

  const handleDelete = (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-8">
      <TradeForm onSubmit={handleSubmit} />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Trade History</h3>
            <p className="text-sm text-zinc-500">
              {trades.length} {trades.length === 1 ? "entry" : "entries"} logged
            </p>
          </div>
        </div>
        <TradeTable trades={trades} onDelete={handleDelete} />
      </div>
    </div>
  );
}
