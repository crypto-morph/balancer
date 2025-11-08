"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Alert = {
  at: string;
  type: string;
  severity: string;
  message: string;
  payload?: Record<string, unknown>;
};

export function AlertsList() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/alerts", { cache: "no-store" });
        const data = await res.json();
        setAlerts(Array.isArray(data.alerts) ? data.alerts.reverse() : []);
      } catch {
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return <div className="text-sm text-zinc-500">Loading alerts…</div>;
  }

  if (!alerts.length) {
    return <div className="text-sm text-zinc-500">No alerts yet.</div>;
  }

  return (
    <div className="space-y-3">
      {alerts.map((a, idx) => (
        <Card key={idx} className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{a.type}</div>
            <Badge variant={a.severity === "critical" ? "destructive" : "secondary"}>
              {a.severity}
            </Badge>
          </div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{a.message}</div>
          <div className="mt-1 text-[11px] text-zinc-500">{new Date(a.at).toLocaleString()}</div>
        </Card>
      ))}
    </div>
  );
}
