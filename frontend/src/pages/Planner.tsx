import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Loader2, Pencil, Lightbulb, ArrowUpRight, Check } from "lucide-react";
import { fixedExpensesApi, analyticsApi } from "@/lib/api";
import { BottomSheet, CategoryIcon, COLOR, EASE, fade, PageHeader, SkeletonPage, SPRING } from "@/lib/design";

const FREQ_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly",  label: "Yearly"  },
  { value: "weekly",  label: "Weekly"  },
];

// emoji is still stored on the entry for backward compatibility; the UI renders icons
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
  const [goalsSaved, setGoalsSaved] = useState(false);

  const fetchAll = async () => {
    try {
      const [fe, s] = await Promise.all([fixedExpensesApi.list(), analyticsApi.summary(12)]);
      setEntries(fe.data);
      setSummary(s.data);
      setFetchError("");
    } catch (e) {
      console.error(e);
      setFetchError("Couldn't refresh. Your last change may not be shown yet.");
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
    if (!form.name || !form.amount) { setError("Fill in every field to continue."); return; }
    setSaving(true); setError("");
    try {
      const payload = { name: form.name, amount: parseFloat(form.amount), frequency: form.frequency, entry_type: form.entry_type, category: form.category, emoji: form.emoji };
      if (editId) await fixedExpensesApi.update(editId, payload);
      else        await fixedExpensesApi.create(payload);
      setShowForm(false);
      setEditId(null);
      setForm({ ...EMPTY_FORM });
      await fetchAll();
    } catch (e: any) { setError(e.response?.data?.detail || "Couldn't save this entry. Try again."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try { await fixedExpensesApi.delete(id); await fetchAll(); }
    catch (e) {
      console.error(e);
      setFetchError("Couldn't delete that entry. Try again.");
    }
    finally { setDeleting(null); }
  };

  const handleToggle = async (e: any) => {
    await fixedExpensesApi.update(e.id, { is_active: !e.is_active });
    fetchAll();
  };

  const saveGoals = () => {
    localStorage.setItem("cashflow_goals", JSON.stringify(goalForm));
    setGoals(goalForm);
    window.dispatchEvent(new Event("goals-updated"));
    setGoalsSaved(true);
    setTimeout(() => setGoalsSaved(false), 1600);
  };

  const cats = form.entry_type === "income" ? INCOME_CATS : EXPENSE_CATS;
  const pickCat = (name: string) => {
    const opt = cats.find(c => c.name === name);
    setForm(f => ({ ...f, category: name, emoji: opt?.emoji || "📌" }));
  };

  if (loading) return <SkeletonPage blocks={["h-44", "h-11", "h-20", "h-20", "h-20"]} />;

  const renderEntry = (e: any, i: number) => {
    const monthly = toMonthly(e.amount, e.frequency);
    const isIncome = e.entry_type === "income";
    return (
      <motion.div key={e.id} variants={fade} custom={i} initial="hidden" animate="show"
        className={`group flex items-center gap-3 py-3.5 transition-opacity duration-500 ${!e.is_active ? "opacity-40" : ""}`}>
        <button onClick={() => handleToggle(e)} aria-label={e.is_active ? `Pause ${e.name}` : `Resume ${e.name}`}
          title={e.is_active ? "Tap to pause" : "Tap to resume"}
          className="rounded-[13px] transition-transform duration-300 ease-premium active:scale-95">
          <CategoryIcon name={e.category} tone={e.is_active ? (isIncome ? COLOR.income : COLOR.expense) : COLOR.neutral} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{e.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {e.category} · {FREQ_OPTIONS.find(f => f.value === e.frequency)?.label}
            {!e.is_active && <span className="ml-2 rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] text-foreground/70">Paused</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-medium font-mono-nums ${isIncome ? "text-primary" : "text-foreground"}`}>
            {isIncome ? "+" : "−"}₹{e.amount.toLocaleString("en-IN")}
          </p>
          {e.frequency !== "monthly" && (
            <p className="text-[11px] text-muted-foreground font-mono-nums">≈ {fmtK(monthly)}/mo</p>
          )}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button onClick={() => openEdit(e)} aria-label={`Edit ${e.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-white/[0.06] hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id} aria-label={`Delete ${e.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-destructive/15 hover:text-destructive">
            {deleting === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </motion.div>
    );
  };

  const list = activeSection === "income" ? incomes : expenses;
  const maxSide = Math.max(totalIncome, totalExpense) || 1;
  const fixedRatio = totalIncome > 0 ? totalExpense / totalIncome : 0;

  return (
    <>
      <main className="mx-auto max-w-md space-y-5 px-4 pb-32 lg:grid lg:max-w-[1180px] lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-5 lg:space-y-0 lg:px-10 lg:pb-16">
        <motion.div variants={fade} custom={0} initial="hidden" animate="show" className="lg:col-span-12">
          <PageHeader title="Planner" sub="Salary, rent, EMIs and subscriptions. They're applied to your ledger at the start of each month." />
        </motion.div>

        {fetchError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl bg-destructive/10 px-4 py-3 ring-1 ring-inset ring-destructive/20 lg:col-span-12">
            <p className="text-xs text-destructive">{fetchError}</p>
            <button onClick={fetchAll} className="shrink-0 text-xs font-medium text-destructive underline underline-offset-4">Retry</button>
          </motion.div>
        )}

        {/* summary */}
        <motion.section variants={fade} custom={1} initial="hidden" animate="show" className="bezel lg:sticky lg:top-8 lg:col-span-5 lg:row-span-3">
          <div className="bezel-core bezel-hero p-5">
            <p className="text-xs text-muted-foreground">Net fixed per month</p>
            <p className={`num-display mt-2 text-[2.75rem] font-semibold leading-none ${netFixed >= 0 ? "text-foreground" : "text-destructive"}`}>
              {netFixed >= 0 ? "+" : "−"}{fmtK(Math.abs(netFixed))}
            </p>

            <div className="mt-6 space-y-3">
              {[
                { label: "Fixed income", value: totalIncome, color: COLOR.seriesIncome },
                { label: "Fixed costs",  value: totalExpense, color: COLOR.seriesSpend },
              ].map((row, i) => (
                <div key={row.label}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: row.color }} />{row.label}
                    </p>
                    <p className="text-sm font-medium font-mono-nums">{fmtK(row.value)}</p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: COLOR.track }}>
                    <motion.div className="h-full origin-left rounded-full"
                      style={{ background: row.color, width: `${(row.value / maxSide) * 100}%` }}
                      initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                      transition={{ duration: 1.2, delay: 0.2 + i * 0.1, ease: EASE }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* section tabs */}
        <motion.div variants={fade} custom={2} initial="hidden" animate="show" className="segmented lg:col-span-7 lg:col-start-6" role="tablist">
          {([
            { key: "income",  label: `Income`, count: incomes.length },
            { key: "expense", label: `Costs`,  count: expenses.length },
            { key: "goals",   label: `Goals` },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveSection(t.key)} role="tab" aria-selected={activeSection === t.key}
              className={`segmented-item py-2.5 text-sm ${activeSection === t.key ? "text-foreground" : ""}`}>
              {activeSection === t.key && (
                <motion.span layoutId="planner-tab" className="absolute inset-0 rounded-full bg-white/[0.09] ring-1 ring-inset ring-white/[0.06]"
                  transition={SPRING} />
              )}
              <span className="relative">
                {t.label}
                {"count" in t && <span className="ml-1.5 text-[11px] text-muted-foreground font-mono-nums">{t.count}</span>}
              </span>
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {activeSection === "goals" ? (
            <motion.section key="goals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: EASE }} className="bezel lg:col-span-7 lg:col-start-6">
              <div className="bezel-core space-y-6 p-5">
                <div>
                  <h2 className="text-base font-semibold">Monthly targets</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Share of income you want to keep and invest. Home tracks progress against these.</p>
                </div>

                {[
                  { key: "savings_target" as const,    label: "Save",   min: 5, max: 80, color: COLOR.accent },
                  { key: "investment_target" as const, label: "Invest", min: 5, max: 50, color: COLOR.ink },
                ].map(g => (
                  <div key={g.key}>
                    <div className="mb-3 flex items-baseline justify-between">
                      <label htmlFor={g.key} className="text-sm text-foreground/80">{g.label}</label>
                      <p className="num-display text-2xl font-semibold">{goalForm[g.key]}<span className="text-base text-muted-foreground">%</span></p>
                    </div>
                    <input id={g.key} type="range" min={g.min} max={g.max} step={5}
                      value={goalForm[g.key]}
                      onChange={e => setGoalForm(f => ({ ...f, [g.key]: parseInt(e.target.value) }))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(255,255,255,0.08)] [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground"
                      style={{ backgroundImage: `linear-gradient(${g.color}, ${g.color})`, backgroundSize: `${((goalForm[g.key] - g.min) / (g.max - g.min)) * 100}% 100%`, backgroundRepeat: "no-repeat" }} />
                    <div className="mt-2 flex justify-between text-[11px] text-muted-foreground/70 font-mono-nums">
                      <span>{g.min}%</span><span>{g.max}%</span>
                    </div>
                  </div>
                ))}

                <div className="well flex items-center justify-between px-4 py-3">
                  <p className="text-xs text-muted-foreground">Committed</p>
                  <p className={`text-sm font-medium font-mono-nums ${goalForm.savings_target + goalForm.investment_target > 100 ? "text-destructive" : "text-foreground"}`}>
                    {goalForm.savings_target + goalForm.investment_target}% of income
                  </p>
                </div>

                <button onClick={saveGoals} className="btn-primary w-full justify-between">
                  <span>{goalsSaved ? "Goals saved" : "Save goals"}</span>
                  <span className="btn-primary-icon">{goalsSaved ? <Check className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
                </button>
              </div>
            </motion.section>
          ) : (
            <motion.section key={activeSection} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: EASE }} className="bezel lg:col-span-7 lg:col-start-6">
              <div className="bezel-core px-4 pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">{activeSection === "income" ? "Fixed income" : "Fixed costs"}</h2>
                  <button onClick={() => openAdd(activeSection)} className="btn-ghost py-1.5 pl-2 pr-3.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                {list.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm text-foreground/70">
                      {activeSection === "income" ? "No fixed income yet" : "No fixed costs yet"}
                    </p>
                    <p className="mx-auto mt-1 max-w-[28ch] text-xs text-muted-foreground">
                      {activeSection === "income" ? "Add salary, rental income or a pension." : "Add rent, EMIs, insurance or subscriptions."}
                    </p>
                    <button onClick={() => openAdd(activeSection)} className="btn-primary mt-6">
                      Add {activeSection === "income" ? "income" : "a cost"}
                      <span className="btn-primary-icon"><Plus className="h-4 w-4" /></span>
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.05]">{list.map((e, i) => renderEntry(e, i))}</div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* insight */}
        {(totalIncome > 0 || totalExpense > 0) && (
          <motion.section variants={fade} custom={4} initial="hidden" animate="show"
            className="flex gap-3 rounded-[1.75rem] bg-white/[0.025] p-5 ring-1 ring-inset ring-white/[0.06] lg:col-span-7 lg:col-start-6">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-foreground/75">
              {totalIncome === 0
                ? "Add your fixed income to compare it against fixed costs."
                : fixedRatio > 0.6
                ? `Fixed costs take ${(fixedRatio * 100).toFixed(0)}% of fixed income, which is high. Subscriptions and renegotiable bills are the easiest place to start.`
                : fixedRatio > 0.4
                ? `Fixed costs are ${(fixedRatio * 100).toFixed(0)}% of fixed income. Keeping this under 40% leaves room to save.`
                : `Fixed costs are ${(fixedRatio * 100).toFixed(0)}% of fixed income, a healthy balance.`}
            </p>
          </motion.section>
        )}
      </main>

      {/* add / edit sheet */}
      <BottomSheet open={showForm} onClose={() => setShowForm(false)}
        title={`${editId ? "Edit" : "Add"} fixed ${form.entry_type === "income" ? "income" : "cost"}`}>
        {!editId && (
          <div className="segmented">
            {(["income", "expense"] as const).map(t => (
              <button key={t} onClick={() => {
                const newCats = t === "income" ? INCOME_CATS : EXPENSE_CATS;
                setForm(f => ({ ...f, entry_type: t, category: newCats[0].name, emoji: newCats[0].emoji }));
              }}
                className={`segmented-item py-2 text-sm ${form.entry_type === t ? "text-foreground" : ""}`}>
                {form.entry_type === t && (
                  <motion.span layoutId="fixed-type" className="absolute inset-0 rounded-full bg-white/[0.09]" transition={SPRING} />
                )}
                <span className="relative">{t === "income" ? "Income" : "Cost"}</span>
              </button>
            ))}
          </div>
        )}

        <div>
          <label htmlFor="fx-name" className="field-label">Name</label>
          <input id="fx-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={form.entry_type === "income" ? "Salary, rental income…" : "Rent, Netflix, car EMI…"}
            className="field w-full" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="fx-amount" className="field-label">Amount (₹)</label>
            <input id="fx-amount" type="number" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0" className="field w-full font-mono-nums" />
          </div>
          <div>
            <label htmlFor="fx-freq" className="field-label">Frequency</label>
            <select id="fx-freq" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
              className="field w-full appearance-none">
              {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ backgroundColor: "#141416" }}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <p className="field-label">Category</p>
          <div className="flex flex-wrap gap-2">
            {cats.map(c => {
              const on = form.category === c.name;
              return (
                <button key={c.name} onClick={() => pickCat(c.name)}
                  className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-medium transition-all duration-300 ease-premium ${on
                    ? "bg-white/[0.1] text-foreground ring-1 ring-inset ring-white/15"
                    : "bg-white/[0.03] text-muted-foreground hover:text-foreground"}`}>
                  <CategoryIcon name={c.name} size="sm" className="h-6 w-6 rounded-full" />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        {form.amount && (
          <div className="well flex items-center justify-between px-4 py-3">
            <p className="text-xs text-muted-foreground">Monthly equivalent</p>
            <p className="text-sm font-medium font-mono-nums">
              ₹{toMonthly(parseFloat(form.amount) || 0, form.frequency).toFixed(0)}/mo
            </p>
          </div>
        )}

        {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-2.5 text-xs text-destructive">{error}</p>}

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-between">
          <span>{saving ? "Saving…" : editId ? "Update entry" : "Add entry"}</span>
          <span className="btn-primary-icon">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}</span>
        </button>
      </BottomSheet>
    </>
  );
}
