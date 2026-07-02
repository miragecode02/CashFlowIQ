import { useState, useEffect } from "react";
import { TrendingUp, Plus, ArrowUpRight, Sparkles, IndianRupee, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import CircularGauge from "@/components/CircularGauge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { analyticsApi, transactionsApi, budgetsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const CATEGORIES = [
  { id: 1, name: "Food & Dining" },
  { id: 2, name: "Shopping" },
  { id: 3, name: "Transport" },
  { id: 4, name: "Entertainment" },
  { id: 5, name: "Health" },
  { id: 6, name: "Other" },
];

const Home = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ amount: "", description: "", type: "expense", category_id: "6", date: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [summaryRes, budgetRes] = await Promise.all([
        analyticsApi.summary(6),
        budgetsApi.list(new Date().getMonth() + 1, new Date().getFullYear()),
      ]);
      setSummary(summaryRes.data);
      setBudgets(budgetRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddExpense = async () => {
    if (!form.amount || !form.description) { setError("Please fill all fields"); return; }
    setSaving(true);
    setError("");
    try {
      await transactionsApi.create({
        amount: parseFloat(form.amount),
        type: form.type,
        description: form.description,
        category_id: parseInt(form.category_id),
        date: new Date(form.date).toISOString(),
      });
      setShowModal(false);
      setForm({ amount: "", description: "", type: "expense", category_id: "6", date: new Date().toISOString().split("T")[0] });
      fetchData();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0);
  const budgetPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();

  return (
    <>
      <motion.div className="space-y-4 pb-24 px-4 pt-6 max-w-md mx-auto" variants={container} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{greeting()},</p>
            <h1 className="text-xl font-bold text-foreground">{user?.name?.split(" ")[0]} 👋</h1>
          </div>
          <div className="h-9 w-9 rounded-full gradient-accent flex items-center justify-center text-sm font-bold text-primary-foreground">
            {user?.name?.[0]?.toUpperCase()}
          </div>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Net Savings Card */}
            <motion.div variants={item} className="gradient-card p-5">
              <p className="text-xs text-muted-foreground mb-1">Net Savings This Month</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-bold text-foreground flex items-center">
                  <IndianRupee className="h-6 w-6" />{summary?.net_savings?.toLocaleString("en-IN") || "0"}
                </h2>
                <span className="flex items-center text-xs font-medium text-mint">
                  <ArrowUpRight className="h-3 w-3" /> {summary?.savings_rate?.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">savings rate this month</p>
            </motion.div>

            {/* Add Expense Button */}
            <motion.button
              variants={item}
              onClick={() => setShowModal(true)}
              className="w-full gradient-accent text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Add Transaction
            </motion.button>

            {/* Monthly Budget */}
            {totalBudget > 0 && (
              <motion.div variants={item} className="glass-card p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium text-foreground">Monthly Budget</p>
                  <p className="text-xs text-muted-foreground">₹{totalSpent.toLocaleString("en-IN")} / ₹{totalBudget.toLocaleString("en-IN")}</p>
                </div>
                <Progress value={budgetPct} className="h-2 bg-secondary" />
                <p className="text-xs text-muted-foreground mt-1.5">₹{(totalBudget - totalSpent).toLocaleString("en-IN")} remaining · {daysLeft} days left</p>
              </motion.div>
            )}

            {/* AI Insight */}
            {summary?.top_category && (
              <motion.div variants={item} className="glass-card p-4 border-l-2 border-l-primary">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">AI Smart Insight</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your top spending category is <span className="text-destructive font-medium">{summary.top_category.name}</span> at ₹{summary.top_category.amount.toLocaleString("en-IN")} — <span className="text-destructive font-medium">{summary.top_category.percentage}%</span> of your total spending this month.
                </p>
              </motion.div>
            )}

            {/* Savings Rate & Top Category */}
            <motion.div variants={item} className="grid grid-cols-2 gap-3">
              <div className="glass-card p-4 flex flex-col items-center">
                <CircularGauge value={Math.min(summary?.savings_rate || 0, 100)} size={100} strokeWidth={7} color="hsl(160, 84%, 39%)" />
                <p className="text-xs font-medium text-foreground mt-2">Savings Rate</p>
              </div>
              <div className="glass-card p-4 flex flex-col justify-between">
                <p className="text-xs text-muted-foreground">Top Category</p>
                <p className="text-lg font-bold text-foreground mt-1">{summary?.top_category?.name || "—"}</p>
                <p className="text-2xl font-bold text-destructive">₹{summary?.top_category?.amount?.toLocaleString("en-IN") || "0"}</p>
                <p className="text-xs text-muted-foreground">{summary?.top_category?.percentage || 0}% of spending</p>
              </div>
            </motion.div>

            {/* Income vs Spending Chart */}
            {summary?.monthly_trends?.length > 0 && (
              <motion.div variants={item} className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Income vs Spending</p>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.monthly_trends} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 20%, 18%)" />
                      <XAxis dataKey="month" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(225, 40%, 11%)", border: "1px solid hsl(225, 20%, 18%)", borderRadius: "8px", color: "hsl(210, 40%, 96%)", fontSize: 12 }} />
                      <Bar dataKey="income" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="spending" fill="hsl(245, 58%, 51%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-primary" /><span className="text-xs text-muted-foreground">Income</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-chart-indigo" /><span className="text-xs text-muted-foreground">Spending</span></div>
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {!summary?.monthly_trends?.length && (
              <motion.div variants={item} className="glass-card p-8 text-center">
                <p className="text-sm text-muted-foreground">No transactions yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Add your first transaction to see insights!</p>
              </motion.div>
            )}
          </>
        )}
      </motion.div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center px-4 pb-8">
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="glass-card w-full max-w-md p-5 rounded-2xl space-y-4 mb-16">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-foreground">Add Transaction</p>
                <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>

              {/* Type Toggle */}
              <div className="grid grid-cols-2 gap-2">
                {["expense", "income"].map((t) => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`py-2 rounded-xl text-sm font-medium transition-all ${form.type === t ? "gradient-accent text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Amount (₹)</label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="bg-secondary border-border/50 text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Description</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Swiggy order" className="bg-secondary border-border/50 text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Category</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="w-full bg-secondary border border-border/50 text-foreground text-sm rounded-lg px-3 py-2">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Date</label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-secondary border-border/50 text-foreground" />
              </div>

              {error && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}

              <button onClick={handleAddExpense} disabled={saving} className="w-full gradient-accent text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60">
                {saving ? "Saving..." : "Save Transaction"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Home;
