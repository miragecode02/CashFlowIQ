import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, Sparkles, ArrowUpRight, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { analyticsApi } from "@/lib/api";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const FinancialHealth = () => {
  const [summary, setSummary] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, a] = await Promise.all([analyticsApi.summary(6), analyticsApi.anomalies()]);
        setSummary(s.data);
        setAnomalies(a.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const savingsRate = summary?.savings_rate || 0;
  const totalIncome = summary?.total_income || 0;
  const netSavings = summary?.net_savings || 0;

  return (
    <motion.div className="space-y-4 pb-24 px-4 pt-6 max-w-md mx-auto" variants={container} initial="hidden" animate="show">
      <motion.h1 variants={item} className="text-xl font-bold text-foreground">Financial Health</motion.h1>

      {/* Savings Rate */}
      <motion.div variants={item} className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-mint" />
            <p className="text-sm font-medium text-foreground">Savings Rate</p>
          </div>
          <span className="flex items-center text-xs font-medium text-mint">
            <ArrowUpRight className="h-3 w-3" /> This month
          </span>
        </div>
        <p className="text-3xl font-bold text-foreground mt-2">{savingsRate.toFixed(1)}%</p>
        <p className="text-xs text-muted-foreground">
          {totalIncome > 0
            ? `You saved ₹${netSavings.toLocaleString("en-IN")} of ₹${totalIncome.toLocaleString("en-IN")} income`
            : "No income recorded this month"}
        </p>
      </motion.div>

      {/* Income vs Spending */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <div className="glass-card p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-mint" />
            <p className="text-xs text-muted-foreground">Income</p>
          </div>
          <p className="text-lg font-bold text-mint">₹{totalIncome.toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">This month</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <p className="text-xs text-muted-foreground">Spending</p>
          </div>
          <p className="text-lg font-bold text-destructive">₹{(summary?.total_spending || 0).toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">This month</p>
        </div>
      </motion.div>

      {/* Smart Insights */}
      <motion.div variants={item} className="glass-card p-4 border-l-2 border-l-primary">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Smart Insights</p>
        </div>
        <ul className="space-y-2">
          {anomalies.length > 0 ? (
            anomalies.slice(0, 3).map((a, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive mt-1 shrink-0" />
                {a.message}
              </li>
            ))
          ) : (
            <>
              <li className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-mint mt-1 shrink-0" />
                {savingsRate >= 20 ? "Great job! Your savings rate is healthy." : "Try to save at least 20% of your income each month."}
              </li>
              <li className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1 shrink-0" />
                Add more transactions to get personalised AI insights.
              </li>
              <li className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-chart-amber mt-1 shrink-0" />
                Use the AI Advisor to simulate purchases and plan budgets.
              </li>
            </>
          )}
        </ul>
      </motion.div>

      {/* Spending Breakdown */}
      {summary?.category_breakdown?.length > 0 && (
        <motion.div variants={item} className="glass-card p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Spending Breakdown</p>
          <div className="space-y-2">
            {summary.category_breakdown.slice(0, 4).map((c: any) => (
              <div key={c.name}>
                <div className="flex justify-between mb-1">
                  <p className="text-xs text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.percentage}%</p>
                </div>
                <Progress value={c.percentage} className="h-1.5 bg-secondary" />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default FinancialHealth;