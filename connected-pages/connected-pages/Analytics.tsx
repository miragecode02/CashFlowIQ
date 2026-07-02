import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { analyticsApi, transactionsApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const COLORS = ["hsl(0,84%,60%)", "hsl(217,91%,60%)", "hsl(160,84%,39%)", "hsl(38,92%,50%)", "hsl(245,58%,51%)", "hsl(280,70%,60%)"];

const Analytics = () => {
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t, f, a] = await Promise.all([
          analyticsApi.summary(6),
          transactionsApi.list({ limit: 50, type: "expense", month: new Date().getMonth() + 1, year: new Date().getFullYear() }),
          analyticsApi.forecast(30),
          analyticsApi.anomalies(),
        ]);
        setSummary(s.data);
        setTransactions(t.data);
        setForecast(f.data.slice(0, 7).map((d: any) => ({ day: new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" }), amount: d.predicted_spending })));
        setAnomalies(a.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const pieData = summary?.category_breakdown?.slice(0, 5).map((c: any, i: number) => ({ name: c.name, value: c.amount, color: COLORS[i] })) || [];
  const totalThisMonth = summary?.total_spending || 0;

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <motion.div className="space-y-4 pb-24 px-4 pt-6 max-w-md mx-auto" variants={container} initial="hidden" animate="show">
      <motion.h1 variants={item} className="text-xl font-bold text-foreground">Spending Analytics</motion.h1>

      <Tabs defaultValue="monthly">
        <motion.div variants={item}>
          <TabsList className="w-full bg-secondary">
            <TabsTrigger value="monthly" className="flex-1">Monthly</TabsTrigger>
            <TabsTrigger value="forecast" className="flex-1">Forecast</TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="monthly" className="space-y-4 mt-4">
          {/* Anomaly Insight */}
          {anomalies.length > 0 && (
            <motion.div variants={item} className="glass-card p-3 border-l-2 border-l-destructive flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">{anomalies[0].message}</p>
            </motion.div>
          )}

          {/* Total */}
          <motion.div variants={item} className="glass-card p-4">
            <p className="text-xs text-muted-foreground">Total Spent This Month</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold text-foreground">₹{totalThisMonth.toLocaleString("en-IN")}</p>
              <span className="flex items-center text-xs font-medium text-mint">
                <TrendingUp className="h-3 w-3 mr-0.5" /> {summary?.savings_rate?.toFixed(1)}% saved
              </span>
            </div>
          </motion.div>

          {/* Trend Chart */}
          {summary?.monthly_trends?.length > 0 && (
            <motion.div variants={item} className="glass-card p-4">
              <p className="text-sm font-semibold text-foreground mb-3">6-Month Trend</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.monthly_trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 20%, 18%)" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(225, 40%, 11%)", border: "1px solid hsl(225, 20%, 18%)", borderRadius: "8px", color: "hsl(210, 40%, 96%)", fontSize: 12 }} />
                    <Line type="monotone" dataKey="spending" stroke="hsl(217, 91%, 60%)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(217, 91%, 60%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Distribution Donut */}
          {pieData.length > 0 && (
            <motion.div variants={item} className="glass-card p-4">
              <p className="text-sm font-semibold text-foreground mb-3">Expense Distribution</p>
              <div className="flex items-center gap-4">
                <div className="h-36 w-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={60} dataKey="value" strokeWidth={0}>
                        {pieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 flex-1">
                  {pieData.map((d: any) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                      <span className="text-xs font-medium text-foreground">₹{d.value.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Top Categories */}
          {summary?.category_breakdown?.length > 0 && (
            <motion.div variants={item} className="glass-card p-4">
              <p className="text-sm font-semibold text-foreground mb-3">Top Categories</p>
              <div className="space-y-3">
                {summary.category_breakdown.slice(0, 5).map((cat: any, i: number) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-medium text-foreground">{cat.name}</p>
                        <p className="text-xs font-semibold text-foreground">₹{cat.amount.toLocaleString("en-IN")}</p>
                      </div>
                      <Progress value={cat.percentage} className="h-1.5 bg-secondary" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Recent Transactions */}
          {transactions.length > 0 && (
            <motion.div variants={item} className="glass-card p-4">
              <p className="text-sm font-semibold text-foreground mb-3">Recent Expenses</p>
              <div className="space-y-2">
                {transactions.slice(0, 8).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-foreground">{t.description}</p>
                      <p className="text-[10px] text-muted-foreground">{t.category?.name || "Uncategorized"} · {new Date(t.date).toLocaleDateString("en-IN")}</p>
                    </div>
                    <p className="text-xs font-semibold text-destructive">-₹{t.amount.toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {transactions.length === 0 && (
            <motion.div variants={item} className="glass-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No transactions this month.</p>
              <p className="text-xs text-muted-foreground mt-1">Add transactions from the Home page!</p>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4 mt-4">
          <motion.div variants={item} className="glass-card p-3 border-l-2 border-l-primary flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">AI-powered 7-day spending forecast based on your transaction history.</p>
          </motion.div>
          {forecast.length > 0 ? (
            <motion.div variants={item} className="glass-card p-4">
              <p className="text-sm font-semibold text-foreground mb-3">Next 7 Days Forecast</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecast}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 20%, 18%)" />
                    <XAxis dataKey="day" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(225, 40%, 11%)", border: "1px solid hsl(225, 20%, 18%)", borderRadius: "8px", color: "hsl(210, 40%, 96%)", fontSize: 12 }} />
                    <Bar dataKey="amount" fill="hsl(160, 84%, 39%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ) : (
            <motion.div variants={item} className="glass-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Add more transactions to enable forecasting.</p>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default Analytics;
