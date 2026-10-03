// Recharts-backed pieces of the dashboard, split out so the rest of Home can
// paint before the chart library has downloaded.
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, BarChart, Bar,
} from "recharts";
import { COLOR, tooltipStyle } from "@/lib/design";

const axisTick = { fill: COLOR.tick, fontSize: 10, fontFamily: "Geist Mono" };
const rupees = (v: any) => `₹${Number(v).toLocaleString("en-IN")}`;

export function NetSparkline({ data }: { data: { month: string; net: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
        <defs>
          <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR.accent} stopOpacity={0.25} />
            <stop offset="100%" stopColor={COLOR.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(255,255,255,0.12)" }}
          formatter={(v: any) => [rupees(v), "Net"]}
          labelFormatter={(_: any, p: any) => p?.[0]?.payload?.month} />
        <Area type="monotone" dataKey="net" stroke={COLOR.accent} strokeWidth={1.75} fill="url(#netGrad)" dot={false}
          activeDot={{ r: 3, strokeWidth: 2, stroke: COLOR.surface }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CashFlowChart({ data, timeframe, desktop }: {
  data: any[]; timeframe: "daily" | "monthly" | "yearly"; desktop: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {timeframe === "yearly" ? (
        <AreaChart data={data} margin={{ top: 4, right: 14, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR.seriesSpend} stopOpacity={0.22} />
              <stop offset="100%" stopColor={COLOR.seriesSpend} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR.seriesIncome} stopOpacity={0.28} />
              <stop offset="100%" stopColor={COLOR.seriesIncome} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={COLOR.grid} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={desktop ? 0 : 1} />
          <YAxis width={36} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(255,255,255,0.12)" }}
            formatter={(v: any, name: any) => [rupees(v), name]} />
          <Area type="monotone" dataKey="income" stroke={COLOR.seriesIncome} strokeWidth={2} fill="url(#incGrad)" name="Income" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: COLOR.surface }} />
          <Area type="monotone" dataKey="spending" stroke={COLOR.seriesSpend} strokeWidth={2} fill="url(#spendGrad)" name="Spending" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: COLOR.surface }} />
        </AreaChart>
      ) : (
        <BarChart data={data} margin={{ top: 4, right: 14, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={COLOR.grid} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={timeframe === "monthly" ? (desktop ? 2 : 4) : 3} />
          <YAxis width={36} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }}
            formatter={(v: any) => [rupees(v), "Spent"]} />
          <Bar dataKey="spending" fill={COLOR.seriesSpend} radius={[4, 4, 0, 0]} name="Spending" maxBarSize={16} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
