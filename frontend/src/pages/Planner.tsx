import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, Loader2, Edit2, TrendingUp, TrendingDown, Zap, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fixedExpensesApi, analyticsApi } from "@/lib/api";

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] } })
};

const FREQ_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly",  label: "Yearly"  },
  { value: "weekly",  label: "Weekly"  },
];

const EXPENSE_CATS = [
  { name: "Housing",       emoji: "🏠" },
  { name: "Utilities",     emoji: "⚡" },
  { name: "Subscriptions", emoji: "📱" },
  { name: "Insurance",     emoji: "🛡️" },
  { name: "Education",     emoji: "📚" },
  { name: "Health",        emoji: "❤️" },
  { name: "Transport",     emoji: "🚗" },
  { name: "Investments",   emoji: "📈" },
  { name: "Other",         emoji: "📌" },
];

const INCOME_CATS = [
  { name: "Salary",    emoji: "💼" },
  { name: "Freelance", emoji: "💻" },
  { name: "Rental",    emoji: "🏢" },
  { name: "Business",  emoji: "🏪" },
  { name: "Dividends", emoji: "📊" },
  { name: "Pension",   emoji: "🏦" },
  { name: "Other",     emoji: "💰" },
];

const fmtK = (n: number) =>
  n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(1)}k` : `₹${Math.round(n).toLocaleString("en-IN")}`;

const toMonthly = (amount: number, freq: string) =>
  freq === "yearly" ? amount / 12 : freq === "weekly" ? amount * 4.33 : amount;

const EMPTY_FORM = { name: "", amount: "", frequency: "monthly", entry_type: "expense", category: "Utilities", emoji: "⚡" };

export default function Planner() {
  const [entries, setEntries]   = useState<any[]>([]);
  const [summary, setSummary]   = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [fetchError, setFetchError] = useState("");
  const [activeSection, setActiveSection] = useState<"expense" | "income" | "goals">("expense");
  const [goals, setGoals] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cashflow_goals") || "{}"); }
    catch { return {}; }
  });
  const [goalForm, setGoalForm] = useState({
    savings_target: goals.savings_target ?? 30,
    investment_target: goals.investment_target ?? 20,
  });

  const fetchAll = async () => {
    try {
      const [fe, s] = await Promise.all([fixedExpensesApi.list(), analyticsApi.summary(12)]);
      setEntries(fe.data);
      setSummary(s.data);
      setFetchError("");
    } catch (e) {
      console.error(e);
      setFetchError("Couldn't refresh — your last change may not be reflected. Pull to retry.");
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const expenses = entries.filter(e => e.entry_type === "expense");
  const incomes  = entries.filter(e => e.entry_type === "income");

  const totalExpense = expenses.filter(e => e.is_active).reduce((a, e) => a + toMonthly(e.amount, e.frequency), 0);
  const totalIncome  = incomes.filter(e => e.is_active).reduce((a, e) => a + toMonthly(e.amount, e.frequency), 0);
  const netFixed     = totalIncome - totalExpense;

  const openAdd = (type: "expense" | "income") => {
    setEditId(null);
    const cats = type === "income" ? INCOME_CATS : EXPENSE_CATS;
    setForm({ ...EMPTY_FORM, entry_type: type, category: cats[0].name, emoji: cats[0].emoji });
    setShowForm(true);
  };

  const openEdit = (e: any) => {
    setEditId(e.id);
    setForm({ name: e.name, amount: String(e.amount), frequency: e.frequency, entry_type: e.entry_type, category: e.category, emoji: e.emoji });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.amount) { setError("Fill all fields"); return; }
    setSaving(true); setError("");
    try {
      const payload = { name: form.name, amount: parseFloat(form.amount), frequency: form.frequency, entry_type: form.entry_type, category: form.category, emoji: form.emoji };
      if (editId) await fixedExpensesApi.update(editId, payload);
      else        await fixedExpensesApi.create(payload);
      setShowForm(false);
      setEditId(null);
      setForm({ ...EMPTY_FORM });
      await fetchAll();
    } catch (e: any) { setError(e.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try { await fixedExpensesApi.delete(id); await fetchAll(); }
    catch (e) {
      console.error(e);
      setFetchError("Couldn't delete — please try again.");
    }
    finally { setDeleting(null); }
  };

  const handleToggle = async (e: any) => {
    await fixedExpensesApi.update(e.id, { is_active: !e.is_active });
    fetchAll();
  };

  const cats = form.entry_type === "income" ? INCOME_CATS : EXPENSE_CATS;
  const pickCat = (name: string) => {
    const opt = cats.find(c => c.name === name);
    setForm(f => ({ ...f, category: name, emoji: opt?.emoji || "📌" }));
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const renderEntry = (e: any, i: number) => {
    const monthly = toMonthly(e.amount, e.frequency);
    const isIncome = e.entry_type === "income";
    return (
      <motion.div key={e.id} variants={fade} custom={i} initial="hidden" animate="show"
        className={`rounded-2xl p-4 flex items-center gap-3 transition-opacity ${!e.is_active ? "opacity-40" : ""}`}
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <button onClick={() => handleToggle(e)}
          className="h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: e.is_active ? (isIncome ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)") : "rgba(255,255,255,0.05)" }}>
          {e.emoji}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{e.name}</p>
          <p className="text-[10px] text-white/30 mt-0.5">{e.category} · {FREQ_OPTIONS.find(f => f.value === e.frequency)?.label}</p>
        </div>
        <div className="text-right shrink-0 mr-1">
          <p className={`text-sm font-black ${isIncome ? "text-emerald-400" : "text-red-400"}`}>
            {isIncome ? "+" : "−"}₹{e.amount.toLocaleString("en-IN")}
          </p>
          {e.frequency !== "monthly" && (
            <p className="text-[10px] text-white/25">≈ {fmtK(monthly)}/mo</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => openEdit(e)} className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <Edit2 className="h-3 w-3 text-white/40" />
          </button>
          <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
            className="h-7 w-7 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors">
            {deleting === e.id ? <Loader2 className="h-3 w-3 animate-spin text-red-400" /> : <Trash2 className="h-3 w-3 text-red-400" />}
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <div className="pb-28 max-w-md mx-auto px-4 pt-8 space-y-5">
        <motion.div variants={fade} custom={0} initial="hidden" animate="show">
          <h1 className="text-2xl font-black text-white tracking-tight">Fixed Manager</h1>
          <p className="text-xs text-white/40 mt-1">Track recurring income & expenses</p>
        </motion.div>

        {fetchError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl p-3 flex items-center justify-between gap-2"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p className="text-xs text-red-400">{fetchError}</p>
            <button onClick={fetchAll} className="text-xs font-bold text-red-300 underline shrink-0">Retry</button>
          </motion.div>
        )}

        {/* summary card */}
        <motion.div variants={fade} custom={1} initial="hidden" animate="show"
          className="rounded-3xl p-5" style={{ background: "linear-gradient(135deg, #1a1f3e 0%, #0f172a 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Monthly Fixed Overview</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-lg font-black text-emerald-400">{fmtK(totalIncome)}</p>
              <p className="text-[10px] text-white/30 mt-0.5">Fixed Income</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-red-400">{fmtK(totalExpense)}</p>
              <p className="text-[10px] text-white/30 mt-0.5">Fixed Costs</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-black ${netFixed >= 0 ? "text-indigo-400" : "text-orange-400"}`}>
                {netFixed >= 0 ? "+" : ""}{fmtK(netFixed)}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">Net Fixed</p>
            </div>
          </div>

          {(totalIncome > 0 || totalExpense > 0) && (
            <div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden flex mb-2">
                <motion.div className="h-full rounded-l-full" style={{ background: "linear-gradient(90deg, #10b981, #059669)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${totalIncome > 0 ? Math.min((totalIncome / Math.max(totalIncome, totalExpense)) * 100, 100) : 0}%` }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
                <motion.div className="h-full rounded-r-full" style={{ background: "linear-gradient(90deg, #ef4444, #dc2626)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${totalExpense > 0 ? Math.min((totalExpense / Math.max(totalIncome, totalExpense)) * 100, 100) : 0}%` }}
                  transition={{ duration: 1.2, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} />
              </div>
              <div className="flex justify-between">
                <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald-500" /><p className="text-[9px] text-white/25">Income</p></div>
                <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-500" /><p className="text-[9px] text-white/25">Expenses</p></div>
              </div>
            </div>
          )}
        </motion.div>

        {/* section tabs */}
        <motion.div variants={fade} custom={2} initial="hidden" animate="show">
          <div className="flex gap-1 p-1 bg-white/5 rounded-2xl">
            <button onClick={() => setActiveSection("income")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeSection === "income" ? "bg-emerald-500/20 text-emerald-400" : "text-white/30"}`}>
              <TrendingUp className="h-3.5 w-3.5" /> Income ({incomes.length})
            </button>
            <button onClick={() => setActiveSection("expense")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeSection === "expense" ? "bg-red-500/20 text-red-400" : "text-white/30"}`}>
              <TrendingDown className="h-3.5 w-3.5" /> Costs ({expenses.length})
            </button>
            <button onClick={() => setActiveSection("goals")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeSection === "goals" ? "bg-violet-500/20 text-violet-400" : "text-white/30"}`}>
              <Target className="h-3.5 w-3.5" /> Goals
            </button>
          </div>
        </motion.div>

        {/* add button — hidden on goals tab */}
        {activeSection !== "goals" && (
        <motion.button variants={fade} custom={3} initial="hidden" animate="show"
          onClick={() => openAdd(activeSection as "income" | "expense")}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white"
          style={{ background: activeSection === "income" ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #ef4444, #dc2626)" }}>
          <Plus className="h-4 w-4" />
          Add Fixed {activeSection === "income" ? "Income" : "Expense"}
        </motion.button>
        )}

        {/* list */}
        <AnimatePresence mode="wait">
          {activeSection === "goals" ? (
            <motion.div key="goals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-3xl p-5 space-y-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-400" />
                  <p className="text-sm font-bold text-white">Financial Goals</p>
                </div>

                {/* savings target */}
                <div>
                  <div className="flex justify-between mb-2">
                    <p className="text-xs font-semibold text-white/70">💰 Savings Target</p>
                    <p className="text-xs font-black text-violet-400">{goalForm.savings_target}%</p>
                  </div>
                  <input type="range" min={5} max={80} step={5}
                    value={goalForm.savings_target}
                    onChange={e => setGoalForm(f => ({ ...f, savings_target: parseInt(e.target.value) }))}
                    className="w-full accent-violet-500 h-2 rounded-full bg-white/10 appearance-none cursor-pointer" />
                  <div className="flex justify-between mt-1">
                    <p className="text-[10px] text-white/20">5%</p>
                    <p className="text-[10px] text-white/20">80%</p>
                  </div>
                </div>

                {/* investment target */}
                <div>
                  <div className="flex justify-between mb-2">
                    <p className="text-xs font-semibold text-white/70">📈 Investment Target</p>
                    <p className="text-xs font-black text-emerald-400">{goalForm.investment_target}%</p>
                  </div>
                  <input type="range" min={5} max={50} step={5}
                    value={goalForm.investment_target}
                    onChange={e => setGoalForm(f => ({ ...f, investment_target: parseInt(e.target.value) }))}
                    className="w-full accent-emerald-500 h-2 rounded-full bg-white/10 appearance-none cursor-pointer" />
                  <div className="flex justify-between mt-1">
                    <p className="text-[10px] text-white/20">5%</p>
                    <p className="text-[10px] text-white/20">50%</p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-3 space-y-1.5">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">Summary</p>
                  <div className="flex justify-between">
                    <p className="text-xs text-white/50">Savings goal</p>
                    <p className="text-xs font-bold text-violet-400">{goalForm.savings_target}% of income</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-xs text-white/50">Investment goal</p>
                    <p className="text-xs font-bold text-emerald-400">{goalForm.investment_target}% of income</p>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1.5 mt-1">
                    <p className="text-xs text-white/50">Total committed</p>
                    <p className={`text-xs font-bold ${goalForm.savings_target + goalForm.investment_target > 100 ? "text-red-400" : "text-white"}`}>
                      {goalForm.savings_target + goalForm.investment_target}%
                    </p>
                  </div>
                </div>

                <button onClick={() => {
                  localStorage.setItem("cashflow_goals", JSON.stringify(goalForm));
                  setGoals(goalForm);
                  window.dispatchEvent(new Event("goals-updated"));
                }}
                  className="w-full py-3 rounded-2xl font-black text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                  Save Goals
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key={activeSection} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {activeSection === "income" ? (
              incomes.length === 0 ? (
                <div className="rounded-3xl p-10 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <TrendingUp className="h-10 w-10 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/40">No fixed income added yet</p>
                  <p className="text-xs text-white/20 mt-1">Add salary, rent income, freelance…</p>
                </div>
              ) : incomes.map((e, i) => renderEntry(e, i))
            ) : (
              expenses.length === 0 ? (
                <div className="rounded-3xl p-10 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <TrendingDown className="h-10 w-10 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/40">No fixed expenses added yet</p>
                  <p className="text-xs text-white/20 mt-1">Add rent, EMIs, subscriptions…</p>
                </div>
              ) : expenses.map((e, i) => renderEntry(e, i))
            )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI tip */}
        {(totalIncome > 0 || totalExpense > 0) && (
          <motion.div variants={fade} custom={99} initial="hidden" animate="show"
            className="rounded-2xl p-4" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="h-3.5 w-3.5 text-violet-400" />
              <p className="text-xs font-bold text-violet-400">AI Insight</p>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              {totalIncome === 0
                ? "Add your fixed income sources to unlock earn vs spend tracking."
                : totalExpense / totalIncome > 0.6
                ? `Fixed costs consume ${((totalExpense / totalIncome) * 100).toFixed(0)}% of fixed income — that's high. Try reducing subscriptions or renegotiating bills.`
                : totalExpense / totalIncome > 0.4
                ? `Fixed costs are ${((totalExpense / totalIncome) * 100).toFixed(0)}% of fixed income. Aim to keep this under 40% for financial breathing room.`
                : `Great balance! Fixed costs are only ${((totalExpense / totalIncome) * 100).toFixed(0)}% of fixed income.`}
            </p>
          </motion.div>
        )}
      </div>

      {/* modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-end justify-center px-4 pb-6"
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-md rounded-3xl p-5 space-y-4 mb-16"
              style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between">
                <p className="text-base font-black text-white">
                  {editId ? "Edit" : "Add"} Fixed {form.entry_type === "income" ? "Income" : "Expense"}
                </p>
                <button onClick={() => setShowForm(false)} className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
                  <X className="h-3.5 w-3.5 text-white/60" />
                </button>
              </div>

              {!editId && (
                <div className="grid grid-cols-2 gap-2">
                  {(["income", "expense"] as const).map(t => (
                    <button key={t} onClick={() => {
                      const newCats = t === "income" ? INCOME_CATS : EXPENSE_CATS;
                      setForm(f => ({ ...f, entry_type: t, category: newCats[0].name, emoji: newCats[0].emoji }));
                    }}
                      className={`py-2.5 rounded-2xl text-xs font-bold transition-all ${form.entry_type === t
                        ? t === "income" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-white/5 text-white/30"}`}>
                      {t === "income" ? "💰 Income" : "📌 Expense"}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">Name</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={form.entry_type === "income" ? "e.g. Salary, Rent Income…" : "e.g. Rent, Netflix, EMI…"}
                  className="bg-white/5 border-white/10 text-white rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">Amount (₹)</label>
                  <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0" className="bg-white/5 border-white/10 text-white rounded-xl" />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">Frequency</label>
                  <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2">
                    {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ backgroundColor: "#0f172a" }}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-2">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {cats.map(c => (
                    <button key={c.name} onClick={() => pickCat(c.name)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${form.category === c.name
                        ? form.entry_type === "income" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-indigo-500/25 text-indigo-300 border border-indigo-500/40"
                        : "bg-white/5 text-white/40"}`}>
                      <span>{c.emoji}</span>{c.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {form.amount && (
                <div className="bg-white/5 rounded-xl px-4 py-2.5 flex justify-between items-center">
                  <p className="text-xs text-white/40">Monthly equivalent</p>
                  <p className={`text-sm font-bold ${form.entry_type === "income" ? "text-emerald-400" : "text-indigo-400"}`}>
                    ₹{toMonthly(parseFloat(form.amount) || 0, form.frequency).toFixed(0)}/mo
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}

              <button onClick={handleSave} disabled={saving}
                className="w-full py-3.5 rounded-2xl font-black text-sm text-white disabled:opacity-50"
                style={{ background: form.entry_type === "income" ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                {saving ? "Saving…" : editId ? "Update" : "Add"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}