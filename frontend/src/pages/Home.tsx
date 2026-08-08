import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  TrendingUp, TrendingDown, Plus, X, ArrowUpRight, ArrowDownRight,
  Zap, Target, ChevronRight, ChevronLeft, Sparkles, Loader2, Trash2,
  AlertTriangle, CheckCircle2, Flame, History
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  BarChart, Bar
} from "recharts";
import { analyticsApi, transactionsApi, fixedExpensesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const fade = { hidden: { opacity: 0, y: 20 }, show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [.22, 1, .36, 1] } }) };
const fmt  = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN")}`;
const fmtK = (n: number) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(1)}k` : fmt(n);

const CATEGORIES = [
  { id: 1,  name: "Food & Dining", emoji: "🍽️" },
  { id: 2,  name: "Shopping",      emoji: "🛍️" },
  { id: 3,  name: "Transport",     emoji: "🚗"  },
  { id: 4,  name: "Entertainment", emoji: "🎬"  },
  { id: 5,  name: "Health",        emoji: "❤️"  },
  { id: 6,  name: "Other",         emoji: "📦"  },
  { id: 7,  name: "Utilities",     emoji: "⚡"  },
  { id: 8,  name: "Education",     emoji: "📚"  },
  { id: 9,  name: "Investments",   emoji: "📈"  },
  { id: 10, name: "Income",        emoji: "💰"  },
];

const CAT_COLORS: Record<string, string> = {
  "Food & Dining": "#f97316", Shopping: "#8b5cf6", Transport: "#3b82f6",
  Entertainment: "#ec4899", Health: "#ef4444", Utilities: "#eab308",
  Education: "#06b6d4", Investments: "#10b981", Income: "#22c55e", Other: "#6b7280",
};

function AnimatedNumber({ value, prefix = "₹", className = "" }: { value: number; prefix?: string; className?: string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, v => `${prefix}${Math.round(v).toLocaleString("en-IN")}`);
  useEffect(() => {
    let start: number | null = null;
    const duration = 900;
    const from = 0, to = value;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      mv.set(from + (to - from) * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <motion.span className={className}>{rounded}</motion.span>;
}

function InsightCard({ insight }: { insight: any }) {
  const icons: Record<string, any> = {
    warning: <AlertTriangle className="h-4 w-4" />,
    success: <CheckCircle2 className="h-4 w-4" />,
    trend:   <TrendingUp className="h-4 w-4" />,
    tip:     <Zap className="h-4 w-4" />,
  };
  const colors: Record<string, string> = {
    warning: "from-orange-500/15 to-red-500/10 border-orange-500/30 text-orange-400",
    success: "from-emerald-500/15 to-green-500/10 border-emerald-500/30 text-emerald-400",
    trend:   "from-blue-500/15 to-indigo-500/10 border-blue-500/30 text-blue-400",
    tip:     "from-violet-500/15 to-purple-500/10 border-violet-500/30 text-violet-400",
  };
  return (
    <div className={`bg-gradient-to-r ${colors[insight.type] || colors.tip} border rounded-2xl p-3.5 flex gap-3 items-start`}>
      <span className="mt-0.5 shrink-0">{icons[insight.type] || icons.tip}</span>
      <div>
        <p className="text-xs font-semibold mb-0.5">{insight.title}</p>
        <p className="text-xs opacity-80 leading-relaxed">{insight.body}</p>
      </div>
    </div>
  );
}

type TimeFrame = "daily" | "monthly" | "yearly";

function buildChartData(transactions: any[], timeframe: TimeFrame, refDate: Date = new Date()) {
  if (!transactions.length) return [];
  const now = refDate;
  if (timeframe === "daily") {
    const hours: Record<string, number> = {};
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now.getTime() - i * 3600000);
      hours[`${h.getHours()}:00`] = 0;
    }
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (now.getTime() - d.getTime() <= 86400000 && t.type === "expense") {
        const key = `${d.getHours()}:00`;
        if (key in hours) hours[key] += t.amount;
      }
    });
    return Object.entries(hours).map(([label, spending]) => ({ label, spending }));
  }
  if (timeframe === "monthly") {
    const days: Record<string, number> = {};
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) days[`${d}`] = 0;
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.type === "expense") {
        const key = `${d.getDate()}`;
        if (key in days) days[key] += t.amount;
      }
    });
    return Object.entries(days).map(([label, spending]) => ({ label, spending }));
  }
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const data: Record<string, { spending: number; income: number }> = {};
  months.forEach(m => { data[m] = { spending: 0, income: 0 }; });
  transactions.forEach(t => {
    const d = new Date(t.date);
    if (d.getFullYear() === now.getFullYear()) {
      const m = months[d.getMonth()];
      if (t.type === "expense") data[m].spending += t.amount;
      else data[m].income += t.amount;
    }
  });
  return Object.entries(data).map(([label, v]) => ({ label, ...v }));
}

function HistoryModal({ transactions, onClose, onDelete }: { transactions: any[]; onClose: () => void; onDelete: () => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "expense" | "income">("all");

  const filtered = transactions.filter(t => {
    const matchSearch = t.description?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || t.type === filter;
    return matchSearch && matchFilter;
  });

  const grouped: Record<string, any[]> = {};
  filtered.forEach(t => {
    const key = new Date(t.date).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col"
      style={{ paddingBottom: "80px" }}>
      <div className="flex items-center justify-between px-5 pt-8 pb-4">
        <div>
          <h2 className="text-lg font-black text-white">Transaction History</h2>
          <p className="text-xs text-white/30">{transactions.length} total transactions</p>
        </div>
        <button onClick={onClose} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
          <X className="h-4 w-4 text-white/60" />
        </button>
      </div>
      <div className="px-4 space-y-2 mb-3">
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search transactions…" className="bg-white/5 border-white/10 text-white rounded-xl text-sm" />
        <div className="flex gap-2">
          {(["all", "expense", "income"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === f
                ? f === "expense" ? "bg-red-500/20 text-red-400" : f === "income" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/15 text-white"
                : "bg-white/5 text-white/30"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <p className="ml-auto text-xs text-white/20 self-center">{filtered.length} results</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 space-y-4">
        {Object.entries(grouped).map(([month, txns]) => (
          <div key={month}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">{month}</p>
              <p className="text-xs text-white/30">−{fmtK(txns.filter(t => t.type === "expense").reduce((a, t) => a + t.amount, 0))}</p>
            </div>
            <div className="space-y-1">
              {txns.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0 group">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ background: `${CAT_COLORS[t.category?.name] || "#6366f1"}22` }}>
                      {CATEGORIES.find(c => c.name === t.category?.name)?.emoji || "📦"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white/90 truncate max-w-[180px]">{t.description}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">
                        {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {t.note && <p className="text-[10px] text-indigo-400/70 mt-0.5 truncate max-w-[180px]">📝 {t.note}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className={`text-sm font-bold ${t.type === "expense" ? "text-red-400" : "text-emerald-400"}`}>
                      {t.type === "expense" ? "−" : "+"}₹{t.amount.toLocaleString("en-IN")}
                    </p>
                    <button onClick={async () => { await transactionsApi.delete(t.id); onDelete(); }}
                      className="h-6 w-6 rounded-lg bg-red-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16"><p className="text-sm text-white/30">No transactions found</p></div>
        )}
      </div>
    </motion.div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [summary, setSummary]         = useState<any>(null);
  const [allTxns, setAllTxns]         = useState<any[]>([]);
  const [recentTxns, setRecentTxns]   = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [timeframe, setTimeframe]     = useState<TimeFrame>("yearly");
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = previous month, ...
  const [yearOffset, setYearOffset]   = useState(0);  // 0 = current year, -1 = previous year, ...
  const [activeTab, setActiveTab]     = useState<"overview" | "budget">("overview");
  const [goals, setGoals]             = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem("cashflow_goals") || "{}"); }
    catch { return {}; }
  });

  const fetchData = async () => {
    try {
      const [s, t] = await Promise.all([
        analyticsApi.summary(12),
        transactionsApi.list({ limit: 500 }),
      ]);
      setSummary(s.data);
      setAllTxns(t.data);
      setRecentTxns(t.data.slice(0, 8));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Auto-apply fixed income/expenses at start of each month
  const autoApplyFixed = async () => {
    try {
      const status = await fixedExpensesApi.applyStatus();
      if (!status.data.applied_this_month) {
        const result = await fixedExpensesApi.applyMonthly();
        if (result.data.applied > 0) {
          fetchData(); // refresh data after applying
        }
      }
    } catch (e) { /* silently ignore */ }
  };

  useEffect(() => {
    fetchData();
    autoApplyFixed();
  }, []);

  useEffect(() => {
    const handler = () => {
      try { setGoals(JSON.parse(localStorage.getItem("cashflow_goals") || "{}")); }
      catch {}
    };
    window.addEventListener("goals-updated", handler);
    return () => window.removeEventListener("goals-updated", handler);
  }, []);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("txn-added", handler);
    return () => window.removeEventListener("txn-added", handler);
  }, []);

  const trends     = summary?.monthly_trends || [];
  const hasNow     = (summary?.total_income || 0) > 0 || (summary?.total_spending || 0) > 0;
  const last       = trends[trends.length - 1];
  const income     = hasNow ? summary.total_income  : (last?.income   || 0);
  const spending   = hasNow ? summary.total_spending : (last?.spending || 0);
  const savings    = income - spending;
  const savRate    = income > 0 ? (savings / income) * 100 : 0;
  const monthLabel = hasNow ? "this month" : (last ? last.month : "");
  const chartRefDate = useMemo(() => {
    const d = new Date();
    if (timeframe === "monthly") d.setMonth(d.getMonth() + monthOffset);
    if (timeframe === "yearly") d.setFullYear(d.getFullYear() + yearOffset);
    return d;
  }, [timeframe, monthOffset, yearOffset]);
  const chartData  = buildChartData(allTxns, timeframe, chartRefDate);
  const timeframeLabels: Record<TimeFrame, string> = {
    daily: "Today by hour",
    monthly: `${chartRefDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })} by day`,
    yearly: `${chartRefDate.getFullYear()} by month`,
  };

  const insights = (() => {
    if (!summary) return [];
    const list: any[] = [];
    const cats = summary.category_breakdown || [];
    if (savRate >= 30) list.push({ type: "success", title: "Great savings rate! 🎉", body: `You saved ${savRate.toFixed(0)}% of income in ${monthLabel}. Keep it up!` });
    else if (savRate < 10 && income > 0) list.push({ type: "warning", title: "Low savings alert", body: `Only ${savRate.toFixed(0)}% saved this month. Try cutting discretionary spend.` });
    const top = cats[0];
    if (top && top.percentage > 40) list.push({ type: "warning", title: `Heavy spend on ${top.name}`, body: `${top.percentage}% of spending (${fmt(top.amount)}) went to ${top.name}.` });
    const invest = cats.find((c: any) => c.name === "Investments");
    if (!invest && income > 0) list.push({ type: "tip", title: "Start investing ₹500/month", body: "No investment transactions yet. Even small SIPs compound significantly over time." });
    if (trends.length >= 3) {
      const prev = trends[trends.length - 2], curr = trends[trends.length - 1];
      if (curr && prev && curr.spending < prev.spending)
        list.push({ type: "trend", title: "Spending dropped!", body: `Spending fell ${((prev.spending - curr.spending) / prev.spending * 100).toFixed(0)}% from ${prev.month} to ${curr.month}.` });
    }
    return list.slice(0, 3);
  })();

  const budgetRings = (summary?.category_breakdown || [])
    .filter((c: any) => c.name !== "Income" && c.name !== "Other")
    .slice(0, 4)
    .map((c: any) => ({ label: c.name.split(" ")[0], spent: c.amount, budget: c.amount * 1.2, color: CAT_COLORS[c.name] || "#6366f1", emoji: CATEGORIES.find(x => x.name === c.name)?.emoji || "📦" }));

  const greet = () => { const h = new Date().getHours(); return h < 12 ? "GOOD MORNING" : h < 17 ? "GOOD AFTERNOON" : "GOOD EVENING"; };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
        <Loader2 className="h-8 w-8 text-primary" />
      </motion.div>
      <p className="text-xs text-muted-foreground">Loading your finances…</p>
    </div>
  );

  return (
    <>
      <div className="pb-28 max-w-md mx-auto">

        {/* header */}
        <motion.div variants={fade} custom={0} initial="hidden" animate="show"
          className="px-5 pt-8 pb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40 font-medium tracking-widest">{greet()}</p>
            <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">{user?.name?.split(" ")[0]} 👋</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(true)}
              className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <History className="h-4 w-4 text-white/50" />
            </button>
            <div className="h-10 w-10 rounded-2xl gradient-accent flex items-center justify-center text-sm font-black text-white shadow-lg">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </motion.div>

        {/* hero savings card */}
        <motion.div variants={fade} custom={1} initial="hidden" animate="show" className="mx-4 mb-4">
          <div className="relative overflow-hidden rounded-3xl p-5"
            style={{ background: "linear-gradient(135deg, #1a1f3e 0%, #0f172a 50%, #1a1f3e 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #10b981, transparent)" }} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/40 font-medium tracking-widest uppercase">{savings >= 0 ? "Net Wealth" : "Net Deficit"} · {monthLabel}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${savings >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                  {savings >= 0 ? "▲" : "▼"} {Math.abs(savRate).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-end gap-1 mb-5">
                <span className="text-white/40 text-lg mb-1">{savings < 0 ? "−₹" : "₹"}</span>
                <AnimatedNumber value={Math.abs(savings)} prefix="" className={`text-4xl font-black tracking-tight ${savings >= 0 ? "text-white" : "text-red-400"}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-2xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Income</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-400">{fmtK(income)}</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowDownRight className="h-3 w-3 text-red-400" />
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Spent</p>
                  </div>
                  <p className="text-sm font-bold text-red-400">{fmtK(spending)}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* spending chart */}
        <motion.div variants={fade} custom={2} initial="hidden" animate="show" className="mx-4 mb-4">
          <div className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-white">Spending Chart</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {timeframe !== "daily" && (
                    <button
                      onClick={() => timeframe === "monthly" ? setMonthOffset(o => o - 1) : setYearOffset(o => o - 1)}
                      className="h-4 w-4 rounded flex items-center justify-center text-white/30 hover:text-white/60 transition-colors">
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                  )}
                  <p className="text-[10px] text-white/30">{timeframeLabels[timeframe]}</p>
                  {timeframe !== "daily" && (
                    <button
                      disabled={timeframe === "monthly" ? monthOffset >= 0 : yearOffset >= 0}
                      onClick={() => timeframe === "monthly" ? setMonthOffset(o => Math.min(0, o + 1)) : setYearOffset(o => Math.min(0, o + 1))}
                      className="h-4 w-4 rounded flex items-center justify-center text-white/30 hover:text-white/60 transition-colors disabled:opacity-20 disabled:hover:text-white/30">
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                {(["daily", "monthly", "yearly"] as TimeFrame[]).map(tf => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${timeframe === tf ? "bg-white/15 text-white" : "text-white/30"}`}>
                    {tf === "daily" ? "D" : tf === "monthly" ? "M" : "Y"}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                {timeframe === "yearly" ? (
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 11, color: "#fff" }}
                      formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, ""]} />
                    <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#incGrad)" name="Income" dot={false} />
                    <Area type="monotone" dataKey="spending" stroke="#6366f1" strokeWidth={2} fill="url(#spendGrad)" name="Spending" dot={false} />
                  </AreaChart>
                ) : (
                  <BarChart data={chartData}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} interval={timeframe === "monthly" ? 4 : 2} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 11, color: "#fff" }}
                      formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Spent"]} />
                    <Bar dataKey="spending" fill="url(#barGrad)" radius={[4, 4, 0, 0]} name="Spending" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            {timeframe === "yearly" && (
              <div className="flex gap-4 mt-2 justify-end">
                <div className="flex items-center gap-1.5"><div className="h-2 w-4 rounded-full bg-emerald-500" /><span className="text-[10px] text-white/30">Income</span></div>
                <div className="flex items-center gap-1.5"><div className="h-2 w-4 rounded-full bg-indigo-500" /><span className="text-[10px] text-white/30">Spending</span></div>
              </div>
            )}
          </div>
        </motion.div>

        {/* tabs */}
        <motion.div variants={fade} custom={3} initial="hidden" animate="show" className="px-4 mb-4">
          <div className="flex gap-1 p-1 bg-white/5 rounded-2xl">
            {(["overview", "budget"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === t ? "bg-white/10 text-white" : "text-white/40"}`}>
                {t === "overview" ? "📊 Overview" : "🎯 Budget Goals"}
              </button>
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === "overview" ? (
            <motion.div key="overview" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="px-4 space-y-4">

              {/* top 2 categories */}
              {(summary?.category_breakdown || []).length > 0 && (
                <motion.div variants={fade} custom={4} initial="hidden" animate="show"
                  className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-sm font-bold text-white mb-3">Top Categories</p>
                  <div className="space-y-3">
                    {summary.category_breakdown.slice(0, 2).map((cat: any, i: number) => (
                      <div key={cat.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{CATEGORIES.find(c => c.name === cat.name)?.emoji || "📦"}</span>
                            <p className="text-xs font-semibold text-white/80">{cat.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-white">{fmt(cat.amount)}</p>
                            <p className="text-[10px] text-white/30">{cat.percentage}%</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full"
                            style={{ backgroundColor: CAT_COLORS[cat.name] || "#6366f1" }}
                            initial={{ width: 0 }} animate={{ width: `${cat.percentage}%` }}
                            transition={{ duration: 1, delay: i * 0.1, ease: [.22,1,.36,1] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* recent transactions */}
              {recentTxns.length > 0 && (
                <motion.div variants={fade} custom={5} initial="hidden" animate="show"
                  className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-white">Recent Activity</p>
                    <button onClick={() => setShowHistory(true)} className="text-[10px] text-indigo-400 flex items-center gap-1">
                      View all <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {recentTxns.map((t: any, i: number) => (
                      <motion.div key={t.id} variants={fade} custom={i} initial="hidden" animate="show"
                        className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0 group">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-base shrink-0"
                            style={{ background: `${CAT_COLORS[t.category?.name] || "#6366f1"}22` }}>
                            {CATEGORIES.find(c => c.name === t.category?.name)?.emoji || "📦"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white/90 truncate max-w-[140px]">{t.description}</p>
                            <p className="text-[10px] text-white/30 mt-0.5">{t.category?.name || "Other"} · {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                            {t.note && <p className="text-[10px] text-indigo-400/70 mt-0.5 truncate max-w-[140px]">📝 {t.note}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className={`text-sm font-bold ${t.type === "expense" ? "text-red-400" : "text-emerald-400"}`}>
                            {t.type === "expense" ? "−" : "+"}₹{t.amount.toLocaleString("en-IN")}
                          </p>
                          <button onClick={async () => { await transactionsApi.delete(t.id); fetchData(); }}
                            className="h-6 w-6 rounded-lg bg-red-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* AI insights */}
              {insights.length > 0 && (
                <motion.div variants={fade} custom={6} initial="hidden" animate="show">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                    <p className="text-xs font-bold text-white/60 uppercase tracking-widest">AI Insights</p>
                  </div>
                  <div className="space-y-2">
                    {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
                  </div>
                </motion.div>
              )}
            </motion.div>

          ) : (
            <motion.div key="budget" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="px-4 space-y-4">

              {budgetRings.length > 0 ? (
                <motion.div variants={fade} custom={0} initial="hidden" animate="show"
                  className="rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-4 w-4 text-violet-400" />
                    <p className="text-sm font-bold text-white">Spending vs Budget</p>
                  </div>
                  <div className="flex gap-4 justify-around flex-wrap">
                    {budgetRings.map((r: any) => {
                      const pct = Math.min((r.spent / r.budget) * 100, 100);
                      const cr = 2 * Math.PI * 26;
                      return (
                        <div key={r.label} className="flex flex-col items-center gap-1.5 min-w-[72px]">
                          <div className="relative w-16 h-16">
                            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                              <motion.circle cx="32" cy="32" r="26" fill="none" stroke={r.color} strokeWidth="6"
                                strokeLinecap="round" strokeDasharray={`${cr}`}
                                initial={{ strokeDashoffset: cr }} animate={{ strokeDashoffset: cr - (pct / 100) * cr }}
                                transition={{ duration: 1.2, ease: [.22,1,.36,1] }} />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center"><span className="text-lg">{r.emoji}</span></div>
                          </div>
                          <p className="text-[10px] text-white/50 text-center">{r.label}</p>
                          <p className={`text-[10px] font-bold ${pct > 90 ? "text-red-400" : pct > 70 ? "text-orange-400" : "text-emerald-400"}`}>{Math.round(pct)}%</p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-white/25 text-center mt-4">Budget caps auto-estimated at 120% of current spend</p>
                </motion.div>
              ) : (
                <div className="rounded-3xl p-8 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Target className="h-10 w-10 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/40">No budget data yet</p>
                </div>
              )}

              <motion.div variants={fade} custom={1} initial="hidden" animate="show"
                className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-400" />
                    <p className="text-sm font-bold text-white">Savings Goal</p>
                  </div>
                  <a href="/planner" className="text-[10px] text-indigo-400 flex items-center gap-1">
                    Edit goals <ChevronRight className="h-3 w-3" />
                  </a>
                </div>
                {[
                  { label: `${goals.savings_target ?? 30}% savings target`, target: income * ((goals.savings_target ?? 30) / 100), current: savings, color: "#6366f1" },
                  { label: `${goals.investment_target ?? 20}% investment target`, target: income * ((goals.investment_target ?? 20) / 100), current: (summary?.category_breakdown || []).find((c: any) => c.name === "Investments")?.amount || 0, color: "#10b981" },
                ].map(goal => {
                  const pct = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
                  return (
                    <div key={goal.label} className="mb-4 last:mb-0">
                      <div className="flex justify-between mb-1.5">
                        <p className="text-xs text-white/60">{goal.label}</p>
                        <p className="text-xs font-bold text-white">{pct.toFixed(0)}%</p>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ backgroundColor: goal.color }}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ duration: 1.2, ease: [.22,1,.36,1] }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <p className="text-[10px] text-white/25">{fmtK(goal.current)} saved</p>
                        <p className="text-[10px] text-white/25">goal: {fmtK(goal.target)}</p>
                      </div>
                    </div>
                  );
                })}
              </motion.div>

              <motion.div variants={fade} custom={2} initial="hidden" animate="show"
                className="rounded-3xl p-4" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))", border: "1px solid rgba(99,102,241,0.2)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-violet-400" />
                  <p className="text-sm font-bold text-white">AI Financial Summary</p>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  {income > 0
                    ? savRate >= 30 ? `Excellent — ${savRate.toFixed(0)}% savings rate. Top expense: ${summary?.category_breakdown?.[0]?.name || "Other"}. Consider increasing SIP investments.`
                    : savRate >= 15 ? `Decent savings at ${savRate.toFixed(0)}%. Biggest opportunity: reduce ${summary?.category_breakdown?.[0]?.name || "expenses"} (${summary?.category_breakdown?.[0]?.percentage || 0}% of spending).`
                    : `Savings rate of ${savRate.toFixed(0)}% needs attention. Set up automatic transfers to savings on payday.`
                    : "Add transactions to get personalised AI insights on your spending."}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* history modal */}
      <AnimatePresence>
        {showHistory && (
          <HistoryModal
            transactions={allTxns}
            onClose={() => setShowHistory(false)}
            onDelete={() => fetchData()}
          />
        )}
      </AnimatePresence>
    </>
  );
}