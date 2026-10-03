import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TriangleAlert, Sparkles } from "lucide-react";
import { analyticsApi } from "@/lib/api";
import { CategoryIcon, categoryMeta, COLOR, EASE, fade, PageHeader, SkeletonPage } from "@/lib/design";

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

  if (loading) return <SkeletonPage blocks={["h-44", "h-24", "h-48"]} />;

  const savingsRate = summary?.savings_rate || 0;
  const totalIncome = summary?.total_income || 0;
  const netSavings = summary?.net_savings || 0;

  const tips = anomalies.length > 0
    ? anomalies.slice(0, 3).map((a) => ({ warn: true, text: a.message }))
    : [
        { warn: false, text: savingsRate >= 20 ? "Your savings rate is healthy." : "Aim to save at least 20% of your income each month." },
        { warn: false, text: "More transactions make these insights sharper." },
        { warn: false, text: "Ask the Advisor to test a purchase against your budget." },
      ];

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 pb-32 lg:grid lg:max-w-[1180px] lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0 lg:px-10 lg:pb-16">
      <motion.div variants={fade} custom={0} initial="hidden" animate="show" className="lg:col-span-2">
        <PageHeader eyebrow="This month" title="Financial health" />
      </motion.div>

      <motion.section variants={fade} custom={1} initial="hidden" animate="show" className="bezel">
        <div className="bezel-core bezel-hero p-5">
          <p className="text-xs text-muted-foreground">Savings rate</p>
          <p className="num-display mt-2 text-[3.25rem] font-semibold leading-none">{savingsRate.toFixed(1)}<span className="text-2xl text-muted-foreground">%</span></p>
          <p className="mt-3 text-sm text-muted-foreground">
            {totalIncome > 0
              ? `₹${netSavings.toLocaleString("en-IN")} kept from ₹${totalIncome.toLocaleString("en-IN")} of income.`
              : "No income recorded this month."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="well p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Income</p>
              <p className="mt-1.5 text-base font-medium font-mono-nums">₹{totalIncome.toLocaleString("en-IN")}</p>
            </div>
            <div className="well p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-chart-rust" />Spending</p>
              <p className="mt-1.5 text-base font-medium font-mono-nums">₹{(summary?.total_spending || 0).toLocaleString("en-IN")}</p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section variants={fade} custom={2} initial="hidden" animate="show" className="bezel">
        <div className="bezel-core p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">{anomalies.length > 0 ? "Worth a look" : "Insights"}</h2>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {tips.map((t, i) => (
              <li key={i} className="flex items-start gap-3 py-3 text-sm text-foreground/75 first:pt-0 last:pb-0">
                {t.warn && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-chart-clay" aria-label="Warning" />}
                {t.text}
              </li>
            ))}
          </ul>
        </div>
      </motion.section>

      {summary?.category_breakdown?.length > 0 && (
        <motion.section variants={fade} custom={3} initial="hidden" animate="show" className="bezel">
          <div className="bezel-core p-4">
            <h2 className="mb-4 text-base font-semibold">Spending breakdown</h2>
            <div className="space-y-4">
              {summary.category_breakdown.slice(0, 5).map((c: any, i: number) => (
                <div key={c.name} className="flex items-center gap-3">
                  <CategoryIcon name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex justify-between">
                      <p className="text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground font-mono-nums">{c.percentage}%</p>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full" style={{ background: COLOR.track }}>
                      <motion.div className="h-full origin-left rounded-full"
                        style={{ background: categoryMeta(c.name).color, width: `${c.percentage}%` }}
                        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                        transition={{ duration: 1, delay: 0.2 + i * 0.08, ease: EASE }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      )}
    </main>
  );
};

export default FinancialHealth;
