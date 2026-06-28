"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import type { TimeAllocationSlice, MoodDataPoint, KnowledgeGrowthPoint } from "@/types";
import {
  chartAxisProps,
  chartTooltipProps,
  useChartTheme,
} from "@/lib/chart-theme";

export function TimeAllocationChart({ data }: { data: TimeAllocationSlice[] }) {
  const theme = useChartTheme();
  const colors = theme.colors.some(Boolean) ? theme.colors : ["#6366f1", "#22d3ee", "#a78bfa", "#34d399", "#fb923c"];

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="percentage"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            stroke={theme.card || "var(--card)"}
            strokeWidth={2}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip {...chartTooltipProps(theme)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((item, i) => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ background: colors[i % colors.length] }}
            />
            {item.label} {item.percentage}%
          </div>
        ))}
      </div>
    </div>
  );
}

export function KnowledgeGrowthChart({ data }: { data: KnowledgeGrowthPoint[] }) {
  const theme = useChartTheme();
  const axis = chartAxisProps(theme);

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
          <XAxis dataKey="date" {...axis} />
          <YAxis {...axis} />
          <Tooltip {...chartTooltipProps(theme)} />
          <Line
            type="monotone"
            dataKey="entities"
            stroke={theme.colors[0]}
            strokeWidth={2}
            dot={false}
            name="Entities"
          />
          <Line
            type="monotone"
            dataKey="connections"
            stroke={theme.colors[1]}
            strokeWidth={2}
            dot={false}
            name="Connections"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MoodChart({ data }: { data: MoodDataPoint[] }) {
  const theme = useChartTheme();
  const axis = chartAxisProps(theme);

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
          <XAxis dataKey="date" {...axis} />
          <YAxis {...axis} />
          <Tooltip {...chartTooltipProps(theme)} />
          <Area
            type="monotone"
            dataKey="positive"
            stackId="1"
            stroke={theme.colors[3]}
            fill={theme.colors[3]}
            fillOpacity={0.45}
            name="Positive"
          />
          <Area
            type="monotone"
            dataKey="neutral"
            stackId="1"
            stroke={theme.colors[1]}
            fill={theme.colors[1]}
            fillOpacity={0.35}
            name="Neutral"
          />
          <Area
            type="monotone"
            dataKey="negative"
            stackId="1"
            stroke={theme.colors[4]}
            fill={theme.colors[4]}
            fillOpacity={0.35}
            name="Negative"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
