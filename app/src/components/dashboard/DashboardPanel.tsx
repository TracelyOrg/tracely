import { cn } from "@/lib/utils";
import { DASHBOARD_PANEL_CLASS } from "@/lib/dashboardChartTheme";
import { DashboardInfoTip } from "@/components/dashboard/DashboardInfoTip";

interface DashboardPanelProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

export function DashboardPanel({
  title,
  description,
  action,
  children,
  className,
  testId,
}: DashboardPanelProps) {
  return (
    <div className={cn(DASHBOARD_PANEL_CLASS, className)} data-testid={testId}>
      <div className="mb-3 flex min-h-7 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 items-center gap-1">
          <h3 className="min-w-0 text-xs font-medium text-muted-foreground">{title}</h3>
          {description ? (
            <DashboardInfoTip label={`About ${title}`}>{description}</DashboardInfoTip>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
