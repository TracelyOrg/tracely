"use client";

import { Bell } from "lucide-react";

export default function AlertsPage() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Alerts</h1>

      <div className="flex h-[400px] items-center justify-center">
        <div className="text-center">
          <Bell className="mx-auto size-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No alerts configured</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Set up alerts to get notified when metrics exceed thresholds
          </p>
        </div>
      </div>
    </div>
  );
}
