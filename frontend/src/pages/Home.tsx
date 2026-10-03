import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  TrendingUp, X, ArrowUpRight, ArrowDownLeft, Plus,
  Lightbulb, Target, ChevronRight, ChevronLeft, Sparkles, Trash2,
  TriangleAlert, Check, History, Search
} from "lucide-react";
import { Link } from "react-router-dom";
import { analyticsApi, transactionsApi, fixedExpensesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { takePrefetch } from "@/lib/prefetch";

const NetSparkline  = lazy(() => import("@/components/HomeCharts").then(m => ({ default: m.NetSparkline })));
const CashFlowChart = lazy(() => import("@/components/HomeCharts").then(m => ({ default: m.CashFlowChart })));
import { CategoryIcon, categoryMeta, COLOR, EASE, fade, tooltipStyle, SkeletonPage, SPRING, useEscape, useIsDesktop, richMotion } from "@/lib/design";

const fmt  = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN")}`;
const fmtK = (n: number) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(1)}k` : fmt(n);

const openAddSheet = () => window.dispatchEvent(new Event("open-add-txn"));

function AnimatedNumber({ value, prefix = "₹", className = "" }: { value: number; prefix?: string; className?: string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, v => `${prefix}${Math.round(v).toLocaleString("en-IN")}`);
  useEffect(() => {
    // phones show the real figure immediately; the count-up is a desktop flourish
    if (!richMotion) { mv.set(value); return; }
    let start: number | null = null;
    const duration = 700;
    const from = 0, to = value;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      mv.set(from + (to - from) * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <motion.span className={`num-display ${className}`}>{rounded}</motion.span>;
}

function InsightCard({ insight }: { insight: any }) {
  const meta: Record<string, { icon: any; tone: string }> = {
    warning: { icon: TriangleAlert, tone: "text-chart-clay bg-chart-clay/10" },
    success: { icon: Check,         tone: "text-primary bg-primary/10" },
    trend:   { icon: TrendingUp,    tone: "text-primary bg-primary/10" },
    tip:     { icon: Lightbulb,     tone: "text-foreground/70 bg-white/[0.06]" },
  };
  const { icon: Icon, tone } = meta[insight.type] || meta.tip;
  return (
    <div className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{insight.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
      </div>
    </div>
  );
}

function TxnRow({ t, onDelete, wide = false }: { t: any; onDelete: () => void; wide?: boolean }) {
  const expense = t.type === "expense";
  return (
    <div className="group flex items-center gap-3 py-3">
      <CategoryIcon name={t.category?.name} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium text-foreground ${wide ? "max-w-[200px]" : "max-w-[160px]"}`}>{t.description}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {wide
            ? new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
            : `${t.category?.name || "Other"} · ${new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
        </p>
        {t.note && <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-primary/70">{t.note}</p>}
      </div>
      <p className={`shrink-0 text-sm font-medium font-mono-nums ${expense ? "text-foreground" : "text-primary"}`}>
        {expense ? "−" : "+"}₹{t.amount.toLocaleString("en-IN")}
      </p>
      <button onClick={onDelete} aria-label={`Delete ${t.description}`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 ease-premium hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
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

function HistorySheet({ transactions, onClose, onDelete }: { transactions: any[]; onClose: () => void; onDelete: (t: any) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "expense" | "income">("all");
  useEscape(true, onClose);

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
      transition={{ duration: 0.3 }}
      role="dialog" aria-modal="true" aria-label="Transaction history"
      className="fixed inset-0 z-overlay flex flex-col bg-background/90 backdrop-blur-2xl">
      <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden">
        <div className="flex items-end justify-between px-5 pt-10 pb-5">
          <div>
            <span className="eyebrow mb-3">{transactions.length} transactions</span>
            <h2 className="text-2xl font-semibold">History</h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close history">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search transactions" aria-label="Search transactions" className="field w-full pl-11" />
          </div>
          <div className="flex items-center gap-3">
            <div className="segmented w-60">
              {(["all", "expense", "income"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`segmented-item py-1.5 capitalize ${filter === f ? "text-foreground" : ""}`}>
                  {filter === f && (
                    <motion.span layoutId="hist-filter" className="absolute inset-0 rounded-full bg-white/[0.09]"
                      transition={SPRING} />
                  )}
                  <span className="relative">{f}</span>
                </button>
              ))}
            </div>
            <p className="ml-auto text-[11px] text-muted-foreground font-mono-nums">{filtered.length} results</p>
          </div>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-4 pt-2 pb-32">
          {Object.entries(grouped).map(([month, txns]) => (
            <section key={month}>
              <div className="mb-1 flex items-center justify-between">
                <p className="section-label">{month}</p>
                <p className="text-[11px] text-muted-foreground font-mono-nums">−{fmtK(txns.filter(t => t.type === "expense").reduce((a, t) => a + t.amount, 0))}</p>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {txns.map(t => (
                  <TxnRow key={t.id} t={t} wide onDelete={() => onDelete(t)} />
                ))}
              </div>
            </section>
          ))}
          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-sm text-foreground/70">No transactions match.</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different search or filter.</p>
            </div>
          )}
        </div>
      </motion.div>
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
  const [fixedCount, setFixedCount]   = useState<number | null>(null);
  const desktop = useIsDesktop();
  const [goals, setGoals]             = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem("cashflow_goals") || "{}"); }
    catch { return {}; }
  });

  const fetchData = async () => {
    try {
      const [s, t] = await (takePrefetch() ?? Promise.all([
        analyticsApi.summary(12),
        transactionsApi.list({ limit: 500 }),
      ]));
      setSummary(s.data);
      setAllTxns(t.data);
      setRecentTxns(t.data.slice(0, 8));
      fixedExpensesApi.list().then(r => setFixedCount(r.data.length)).catch(() => setFixedCount(0));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Forgiving delete: hide the row now, commit after a short undo window.
  const deleteTxn = (t: any) => {
    const hide = (xs: any[]) => xs.filter(x => x.id !== t.id);
    setAllTxns(hide);
    setRecentTxns(hide);
    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      try { await transactionsApi.delete(t.id); }
      catch { toast.error("Couldn't delete that transaction. It's been restored."); }
      fetchData();
    }, 5000);
    toast(`Deleted ${t.description}`, {
      duration: 5000,
      action: { label: "Undo", onClick: () => { undone = true; clearTimeout(timer); fetchData(); } },
    });
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
  const monthLabel = hasNow ? "this month" : (last?.month || "this month");
  const chartRefDate = useMemo(() => {
    const d = new Date();
    if (timeframe === "monthly") d.setMonth(d.getMonth() + monthOffset);
    if (timeframe === "yearly") d.setFullYear(d.getFullYear() + yearOffset);
    return d;
  }, [timeframe, monthOffset, yearOffset]);
  const chartData  = buildChartData(allTxns, timeframe, chartRefDate);
  const chartHasData = chartData.some((d: any) => (d.spending || 0) > 0 || (d.income || 0) > 0);
  const timeframeLabels: Record<TimeFrame, string> = {
    daily: "Last 24 hours",
    monthly: chartRefDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    yearly: `${chartRefDate.getFullYear()}`,
  };

  const insights = (() => {
    if (!summary) return [];
    const list: any[] = [];
    const cats = summary.category_breakdown || [];
    if (savRate >= 30) list.push({ type: "success", title: "Strong savings rate", body: `You saved ${savRate.toFixed(0)}% of income ${monthLabel === "this month" ? "this month" : `in ${monthLabel}`}.` });
    else if (savRate < 10 && income > 0) list.push({ type: "warning", title: "Savings are running thin", body: `Only ${savRate.toFixed(0)}% saved this month. Discretionary spend is the quickest lever.` });
    const top = cats[0];
    if (top && top.percentage > 40) list.push({ type: "warning", title: `${top.name} is ${top.percentage}% of spend`, body: `${fmt(top.amount)} went to ${top.name}. Worth a closer look.` });
    const invest = cats.find((c: any) => c.name === "Investments");
    if (!invest && income > 0) list.push({ type: "tip", title: "Start a ₹500 monthly SIP", body: "No investment transactions yet. Small, regular SIPs compound over time." });
    if (trends.length >= 3) {
      const prev = trends[trends.length - 2], curr = trends[trends.length - 1];
      if (curr && prev && curr.spending < prev.spending)
        list.push({ type: "trend", title: "Spending is down", body: `Spending fell ${((prev.spending - curr.spending) / prev.spending * 100).toFixed(0)}% from ${prev.month} to ${curr.month}.` });
    }
    return list.slice(0, 3);
  })();

  const budgetRings = (summary?.category_breakdown || [])
    .filter((c: any) => c.name !== "Income" && c.name !== "Other")
    .slice(0, 4)
    .map((c: any) => ({ name: c.name, label: c.name.split(" ")[0], spent: c.amount, budget: c.amount * 1.2, color: categoryMeta(c.name).color }));

  const greet = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

  if (loading) return <SkeletonPage blocks={["h-64", "h-60", "h-11", "h-72"]} />;

  const canStepForward = timeframe === "monthly" ? monthOffset < 0 : yearOffset < 0;

  // month-over-month context for the headline numbers
  const prev = trends[trends.length - 2];
  const pctChange = (cur: number, before?: number) => before && before > 0 ? ((cur - before) / before) * 100 : null;
  const incomeDelta = pctChange(income, prev?.income);
  const spendDelta  = pctChange(spending, prev?.spending);
  const netSeries   = trends.map((t: any) => ({ month: t.month, net: (t.income || 0) - (t.spending || 0) }));
  const showSpark   = netSeries.filter((d: any) => d.net !== 0).length >= 2;

  const setupSteps = [
    { label: "Add or import transactions", hint: "Upload a bank statement or log one by hand", done: allTxns.length > 0, to: "/upload" },
    { label: "Add fixed income and costs", hint: "Salary, rent, EMIs and subscriptions", done: (fixedCount ?? 0) > 0, to: "/planner" },
    { label: "Set your savings goals", hint: "Choose how much of your income to keep", done: goals.savings_target != null, to: "/planner" },
  ];
  const setupDone = setupSteps.filter(s => s.done).length;
  const showSetup = fixedCount !== null && setupDone < setupSteps.length;

  const Delta = ({ value, invert = false }: { value: number | null; invert?: boolean }) => {
    if (value === null || !isFinite(value)) return <span className="text-[11px] text-muted-foreground/70">No prior month</span>;
    const good = invert ? value <= 0 : value >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium font-mono-nums ${good ? "text-primary" : "text-chart-rust"}`}>
        {value >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
        <span className="ml-1 font-sans font-normal text-muted-foreground">vs {prev?.month}</span>
      </span>
    );
  };

  const cardTitle = "text-[15px] font-semibold tracking-tight";

  /* ── sections ───────────────────────────────────────── */

  const heroCard = (
    <motion.section variants={fade} custom={1} initial="hidden" animate="show" className="bezel lg:col-span-5">
      <div className="bezel-core bezel-hero relative flex h-full flex-col overflow-hidden p-5 lg:p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{savings >= 0 ? "Net saved" : "Net deficit"} · {monthLabel}</p>
          {income > 0 && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium font-mono-nums ${savings >= 0 ? "bg-primary/[0.12] text-primary" : "bg-destructive/[0.12] text-destructive"}`}
              title="Share of income saved">
              {Math.abs(savRate).toFixed(1)}% saved
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-2xl font-medium text-muted-foreground">{savings < 0 ? "−₹" : "₹"}</span>
          <AnimatedNumber value={Math.abs(savings)} prefix="" className={`text-[3.25rem] font-semibold leading-none lg:text-[3.75rem] ${savings >= 0 ? "text-foreground" : "text-destructive"}`} />
        </div>

        {/* net trend */}
        <div className="-mx-1 mt-3 h-14">
          {showSpark && (
            <Suspense fallback={null}><NetSparkline data={netSeries} /></Suspense>
          )}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
          <div className="well p-3.5">
            <p className="text-[11px] text-muted-foreground">Income</p>
            <p className="mt-1 text-lg font-medium font-mono-nums text-foreground">{fmtK(income)}</p>
            <div className="mt-1"><Delta value={incomeDelta} /></div>
          </div>
          <div className="well p-3.5">
            <p className="text-[11px] text-muted-foreground">Spent</p>
            <p className="mt-1 text-lg font-medium font-mono-nums text-foreground">{fmtK(spending)}</p>
            <div className="mt-1"><Delta value={spendDelta} invert /></div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 lg:hidden">
          <button onClick={openAddSheet} className="btn-primary flex-1 justify-between">
            <span>Add transaction</span>
            <span className="btn-primary-icon"><Plus className="h-4 w-4" /></span>
          </button>
          <button onClick={() => setShowHistory(true)} className="btn-ghost" aria-label="Transaction history">
            <History className="h-4 w-4" /> History
          </button>
        </div>
      </div>
    </motion.section>
  );

  const legend = (
    <>
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="h-0.5 w-3 rounded-full" style={{ background: COLOR.seriesIncome }} />Income</span>
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="h-0.5 w-3 rounded-full" style={{ background: COLOR.seriesSpend }} />Spending</span>
    </>
  );

  const chartCard = (
    <motion.section variants={fade} custom={2} initial="hidden" animate="show" className="bezel lg:col-span-7">
      <div className="bezel-core flex h-full flex-col p-4 lg:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className={cardTitle}>{timeframe === "yearly" ? "Cash flow" : "Spending"}</h2>
            <div className="mt-1 flex items-center gap-1">
              {timeframe !== "daily" && (
                <button aria-label="Previous period"
                  onClick={() => timeframe === "monthly" ? setMonthOffset(o => o - 1) : setYearOffset(o => o - 1)}
                  className="-ml-1 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              )}
              <p className="text-xs text-muted-foreground font-mono-nums">{timeframeLabels[timeframe]}</p>
              {timeframe !== "daily" && (
                <button aria-label="Next period" disabled={!canStepForward}
                  onClick={() => timeframe === "monthly" ? setMonthOffset(o => Math.min(0, o + 1)) : setYearOffset(o => Math.min(0, o + 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {timeframe === "yearly" && chartHasData && <div className="hidden gap-4 sm:flex">{legend}</div>}
            <div className="segmented w-[7.5rem] shrink-0">
              {(["daily", "monthly", "yearly"] as TimeFrame[]).map(tf => (
                <button key={tf} onClick={() => setTimeframe(tf)} aria-label={tf}
                  className={`segmented-item px-0 py-1 text-[11px] ${timeframe === tf ? "text-foreground" : ""}`}>
                  {timeframe === tf && (
                    <motion.span layoutId="tf-pill" className="absolute inset-0 rounded-full bg-white/[0.09]" transition={SPRING} />
                  )}
                  <span className="relative">{tf === "daily" ? "D" : tf === "monthly" ? "M" : "Y"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="relative -ml-2 h-44 lg:h-auto lg:min-h-[13rem] lg:flex-1">
          {!chartHasData && (
            <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center pl-2 text-center">
              <p className="text-sm text-foreground/70">No activity for this period</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {allTxns.length === 0 ? "Add or import transactions to see your cash flow." : "Try a different period."}
              </p>
            </div>
          )}
          <Suspense fallback={<div className="skeleton h-full w-full rounded-xl" />}>
            <CashFlowChart data={chartData} timeframe={timeframe} desktop={desktop} />
          </Suspense>
        </div>
        {timeframe === "yearly" && chartHasData && <div className="mt-3 flex justify-end gap-4 sm:hidden">{legend}</div>}
      </div>
    </motion.section>
  );

  const setupCard = showSetup && (
    <motion.section variants={fade} custom={3} initial="hidden" animate="show" className="bezel lg:col-span-12">
      <div className="bezel-core p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={cardTitle}>Finish setting up</h2>
            <p className="mt-1 text-xs text-muted-foreground">A few minutes of setup makes the dashboard and the Advisor accurate.</p>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground font-mono-nums">{setupDone} of {setupSteps.length}</p>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full" style={{ background: COLOR.track }}>
          <motion.div className="h-full origin-left rounded-full bg-primary" style={{ width: `${(setupDone / setupSteps.length) * 100}%` }}
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, ease: EASE }} />
        </div>
        <ol className="mt-4 grid gap-2 lg:grid-cols-3">
          {setupSteps.map((st, i) => (
            <li key={st.label}>
              <Link to={st.to}
                className={`group flex h-full items-start gap-3 rounded-2xl p-3.5 ring-1 ring-inset transition-colors duration-300 ${st.done
                  ? "bg-white/[0.02] ring-white/[0.04]"
                  : "bg-white/[0.035] ring-white/[0.06] hover:bg-white/[0.06]"}`}>
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${st.done ? "bg-primary text-primary-foreground" : "text-muted-foreground ring-1 ring-inset ring-white/15"}`}>
                  {st.done ? <Check className="h-3.5 w-3.5" /> : <span className="text-[11px] font-mono-nums">{i + 1}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${st.done ? "text-muted-foreground line-through decoration-white/20" : "text-foreground"}`}>{st.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{st.hint}</span>
                </span>
                {!st.done && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-premium group-hover:translate-x-0.5" />}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </motion.section>
  );

  const categoriesCard = (summary?.category_breakdown || []).length > 0 && (
    <section className="bezel">
      <div className="bezel-core p-4 lg:p-5">
        <h2 className={`mb-4 ${cardTitle}`}>Where it went</h2>
        <div className="space-y-4">
          {summary.category_breakdown.slice(0, desktop ? 5 : 3).map((cat: any, i: number) => (
            <div key={cat.name} className="flex items-center gap-3">
              <CategoryIcon name={cat.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <p className="truncate text-sm text-foreground">{cat.name}</p>
                  <p className="text-sm font-medium font-mono-nums">{fmt(cat.amount)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: COLOR.track }}>
                    <motion.div className="h-full origin-left rounded-full"
                      style={{ backgroundColor: categoryMeta(cat.name).color, width: `${cat.percentage}%` }}
                      initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                      transition={{ duration: 1, delay: 0.2 + i * 0.08, ease: EASE }} />
                  </div>
                  <p className="w-9 text-right text-[11px] text-muted-foreground font-mono-nums">{cat.percentage}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const recentCard = recentTxns.length > 0 && (
    <section className="bezel">
      <div className="bezel-core px-4 pt-4 pb-1 lg:px-5 lg:pt-5">
        <div className="flex items-center justify-between">
          <h2 className={cardTitle}>Recent activity</h2>
          <button onClick={() => setShowHistory(true)}
            className="group -mr-1 flex items-center gap-0.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
            View all <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 ease-premium group-hover:translate-x-0.5" />
          </button>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {recentTxns.map((t: any) => (
            <TxnRow key={t.id} t={t} wide={desktop} onDelete={() => deleteTxn(t)} />
          ))}
        </div>
      </div>
    </section>
  );

  const insightsCard = insights.length > 0 && (
    <section className="bezel">
      <div className="bezel-core p-4 lg:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className={cardTitle}>Insights</h2>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
        </div>
      </div>
    </section>
  );

  const budgetCard = (
    <section className="bezel">
      <div className="bezel-core p-5">
        <div className="mb-5 flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <h2 className={cardTitle}>Spending vs budget</h2>
        </div>
        {budgetRings.length > 0 ? (
          <>
            <div className="grid grid-cols-4 gap-2">
              {budgetRings.map((r: any) => {
                const pct = Math.min((r.spent / r.budget) * 100, 100);
                const cr = 2 * Math.PI * 26;
                return (
                  <div key={r.label} className="flex flex-col items-center gap-2">
                    <div className="relative h-16 w-16">
                      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                        <circle cx="32" cy="32" r="26" fill="none" stroke={COLOR.track} strokeWidth="4" />
                        <motion.circle cx="32" cy="32" r="26" fill="none" stroke={r.color} strokeWidth="4"
                          strokeLinecap="round" strokeDasharray={`${cr}`}
                          initial={{ strokeDashoffset: cr }} animate={{ strokeDashoffset: cr - (pct / 100) * cr }}
                          transition={{ duration: 1.4, ease: EASE }} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium font-mono-nums">{Math.round(pct)}%</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{r.label}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 text-center text-[11px] text-muted-foreground/70">Caps are estimated at 120% of current spend.</p>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Budget rings appear once you have spending in a few categories.</p>
        )}
      </div>
    </section>
  );

  const goalsCard = (
    <section className="bezel">
      <div className="bezel-core p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className={cardTitle}>Goals</h2>
          <Link to="/planner" className="group flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Edit <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 ease-premium group-hover:translate-x-0.5" />
          </Link>
        </div>
        {[
          { label: `Save ${goals.savings_target ?? 30}% of income`, target: income * ((goals.savings_target ?? 30) / 100), current: savings, color: COLOR.accent },
          { label: `Invest ${goals.investment_target ?? 20}% of income`, target: income * ((goals.investment_target ?? 20) / 100), current: (summary?.category_breakdown || []).find((c: any) => c.name === "Investments")?.amount || 0, color: COLOR.ink },
        ].map(goal => {
          const pct = goal.target > 0 ? Math.max(0, Math.min((goal.current / goal.target) * 100, 100)) : 0;
          return (
            <div key={goal.label} className="mb-5 last:mb-0">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm text-foreground/80">{goal.label}</p>
                <p className="text-sm font-medium font-mono-nums">{pct.toFixed(0)}%</p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: COLOR.track }}>
                <motion.div className="h-full origin-left rounded-full" style={{ backgroundColor: goal.color, width: `${pct}%` }}
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                  transition={{ duration: 1.2, ease: EASE }} />
              </div>
              <div className="mt-1.5 flex justify-between">
                <p className="text-[11px] text-muted-foreground font-mono-nums">{fmtK(Math.max(goal.current, 0))} so far</p>
                <p className="text-[11px] text-muted-foreground font-mono-nums">of {fmtK(goal.target)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const summaryCard = income > 0 && (
    <section className="rounded-[1.75rem] bg-white/[0.025] p-5 ring-1 ring-inset ring-white/[0.06]">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Summary</h2>
      </div>
      <p className="text-sm leading-relaxed text-foreground/70">
        {savRate >= 30 ? `${savRate.toFixed(0)}% savings rate. Your largest expense is ${summary?.category_breakdown?.[0]?.name || "Other"}. There's room to raise your SIP.`
          : savRate >= 15 ? `${savRate.toFixed(0)}% savings rate. The biggest opportunity is ${summary?.category_breakdown?.[0]?.name || "expenses"}, at ${summary?.category_breakdown?.[0]?.percentage || 0}% of spending.`
          : `A ${savRate.toFixed(0)}% savings rate needs attention. An automatic transfer to savings on payday is the simplest fix.`}
      </p>
    </section>
  );

  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-32 lg:max-w-[1180px] lg:px-10 lg:pb-16">

        {/* header */}
        <motion.header variants={fade} custom={0} initial="hidden" animate="show"
          className="flex items-end justify-between pt-10 pb-6 lg:pt-12 lg:pb-8">
          <div>
            <span className="eyebrow mb-3 lg:hidden">{greet()}</span>
            <h1 className="text-[1.75rem] font-semibold leading-none lg:text-[2rem]">
              <span className="hidden lg:inline">{greet()}, </span>{user?.name?.split(" ")[0]}
            </h1>
            <p className="mt-2 hidden text-sm text-muted-foreground lg:block">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <Link to="/profile" aria-label="Profile"
            className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/[0.06] text-sm font-semibold text-foreground ring-1 ring-inset ring-white/[0.08] transition-colors duration-300 hover:bg-white/[0.1] lg:hidden">
            {user?.name?.[0]?.toUpperCase()}
          </Link>
          <button onClick={() => setShowHistory(true)} className="btn-ghost hidden lg:inline-flex">
            <History className="h-4 w-4" /> History
          </button>
        </motion.header>

        <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          {heroCard}
          {chartCard}
          {setupCard}

          {desktop ? (
            <>
              <motion.div variants={fade} custom={4} initial="hidden" animate="show" className="space-y-5 lg:col-span-7">
                {recentCard}
                {budgetCard}
              </motion.div>
              <motion.div variants={fade} custom={5} initial="hidden" animate="show" className="space-y-5 lg:col-span-5">
                {categoriesCard}
                {insightsCard}
                {goalsCard}
                {summaryCard}
              </motion.div>
            </>
          ) : (
            <div className="mt-2">
              <motion.div variants={fade} custom={3} initial="hidden" animate="show" className="segmented mb-4" role="tablist">
                {(["overview", "budget"] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} role="tab" aria-selected={activeTab === t}
                    className={`segmented-item py-2.5 text-sm ${activeTab === t ? "text-foreground" : ""}`}>
                    {activeTab === t && (
                      <motion.span layoutId="home-tab" className="absolute inset-0 rounded-full bg-white/[0.09] ring-1 ring-inset ring-white/[0.06]"
                        transition={SPRING} />
                    )}
                    <span className="relative">{t === "overview" ? "Overview" : "Budget & goals"}</span>
                  </button>
                ))}
              </motion.div>
              <AnimatePresence mode="wait">
                {activeTab === "overview" ? (
                  <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.4, ease: EASE }} className="space-y-4">
                    {categoriesCard}
                    {recentCard}
                    {insightsCard}
                  </motion.div>
                ) : (
                  <motion.div key="budget" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.4, ease: EASE }} className="space-y-4">
                    {budgetCard}
                    {goalsCard}
                    {summaryCard}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showHistory && (
          <HistorySheet
            transactions={allTxns}
            onClose={() => setShowHistory(false)}
            onDelete={deleteTxn}
          />
        )}
      </AnimatePresence>
    </>
  );
}
