"use client";

import { motion } from "framer-motion";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

export interface StatusCodeData {
  code: string;
  count: number;
  color: string;
}

interface StatusCodeWidgetProps {
  data: StatusCodeData[];
  className?: string;
}

const DEFAULT_DATA: StatusCodeData[] = [
  { code: "2xx", count: 0, color: "hsl(var(--success))" },
  { code: "3xx", count: 0, color: "hsl(var(--info))" },
  { code: "4xx", count: 0, color: "hsl(var(--warning))" },
  { code: "5xx", count: 0, color: "hsl(var(--destructive))" },
];

/**
 * Status code distribution donut chart.
 * Shows the breakdown of responses by status code category.
 */
export function StatusCodeWidget({ data, className }: StatusCodeWidgetProps) {
  const chartData = data.length > 0 ? data : DEFAULT_DATA;
  const total = chartData.reduce((sum, d) => sum + d.count, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <motion.div
      data-testid="status-code-widget"
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="rounded-xl border bg-card p-4 h-full">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-muted-foreground">Status Codes</h3>
          <span className="text-lg font-bold tabular-nums">{total.toLocaleString()}</span>
        </div>

        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                dataKey="count"
                nameKey="code"
                labelLine={false}
                label={renderCustomLabel}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value, name) => [
                  `${Number(value).toLocaleString()} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`,
                  name,
                ]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span style={{ color: "hsl(var(--foreground))", fontSize: "12px" }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

export default StatusCodeWidget;
