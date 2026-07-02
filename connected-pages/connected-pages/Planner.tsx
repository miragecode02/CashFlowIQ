import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, PiggyBank, Scissors, Star, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { chatApi, analyticsApi } from "@/lib/api";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const Planner = () => {
  const [selectedStrategy, setSelectedStrategy] = useState("iq");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  const handleSimulate = async () => {
    if (!itemName || !itemPrice) return;
    setLoading(true);
    setAiResponse("");
    setStrategies([]);
    try {
      const { data } = await chatApi.send(
        `I want to buy ${itemName} for ₹${itemPrice}. Based on my current income and spending, can I afford it? Give me 3 saving strategies to reach this goal. Format: brief analysis, then 3 strategies each on a new line starting with "Strategy:"`
      );
      setAiResponse(data.reply);

      // Parse strategies from response
      const lines = data.reply.split("\n").filter((l: string) => l.includes("Strategy:"));
      const parsed = lines.slice(0, 3).map((l: string, i: number) => ({
        id: i,
        title: ["Disciplined Saver", "Lifestyle Trim", "IQ Recommendation"][i],
        description: l.replace("Strategy:", "").trim(),
        highlighted: i === 2,
        icon: [PiggyBank, Scissors, Star][i],
      }));
      setStrategies(parsed.length > 0 ? parsed : [
        { id: 0, title: "Disciplined Saver", description: `Save a fixed amount monthly until you reach ₹${parseInt(itemPrice).toLocaleString("en-IN")}`, highlighted: false, icon: PiggyBank },
        { id: 1, title: "Lifestyle Trim", description: "Cut discretionary spending by 30% and redirect to this goal", highlighted: false, icon: Scissors },
        { id: 2, title: "IQ Recommendation", description: "Smart mix of savings + cashback rewards for fastest result", highlighted: true, icon: Star },
      ]);

      // Generate projection chart
      const price = parseInt(itemPrice);
      const monthlySave = Math.ceil(price / 6);
      setChartData([
        { quarter: "M1", savings: monthlySave },
        { quarter: "M2", savings: monthlySave * 2 },
        { quarter: "M3", savings: monthlySave * 3 },
        { quarter: "M4", savings: monthlySave * 4 },
        { quarter: "Goal", savings: price },
      ]);
    } catch (e) {
      setAiResponse("Connect the AI Advisor to get personalised strategies!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="space-y-4 pb-24 px-4 pt-6 max-w-md mx-auto" variants={container} initial="hidden" animate="show">
      <motion.h1 variants={item} className="text-xl font-bold text-foreground">Purchase Planner</motion.h1>
      <motion.p variants={item} className="text-xs text-muted-foreground">Plan your next big purchase with AI-powered strategies.</motion.p>

      {/* Inputs */}
      <motion.div variants={item} className="glass-card p-4 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Item Name</label>
          <Input value={itemName} onChange={(e) => setItemName(e.target.value)} className="bg-secondary border-border/50 text-foreground" placeholder="e.g. iPhone 16 Pro" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Price (₹)</label>
          <Input value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="bg-secondary border-border/50 text-foreground" placeholder="e.g. 79999" type="number" />
        </div>
        <button
          onClick={handleSimulate}
          disabled={loading || !itemName || !itemPrice}
          className="w-full gradient-accent text-primary-foreground font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing...</> : <><Sparkles className="h-4 w-4" /> Simulate with AI</>}
        </button>
      </motion.div>

      {/* AI Response */}
      {aiResponse && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border-l-2 border-l-primary">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">AI Analysis</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {aiResponse.split("Strategy:")[0].trim()}
          </p>
        </motion.div>
      )}

      {/* AI Strategies */}
      {strategies.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">AI Strategies</p>
          </div>
          <div className="space-y-3">
            {strategies.map((s) => {
              const isSelected = selectedStrategy === String(s.id);
              return (
                <motion.button key={s.id} onClick={() => setSelectedStrategy(String(s.id))}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${s.highlighted && isSelected ? "gradient-card border-primary/50 ring-1 ring-primary/30" : isSelected ? "glass-card border-primary/40" : "glass-card border-border/30 opacity-80"}`}
                  whileTap={{ scale: 0.98 }}>
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${s.highlighted ? "gradient-accent" : "bg-secondary"}`}>
                      <s.icon className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{s.title}</p>
                        {s.highlighted && <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">BEST</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                    </div>
                    {isSelected && <div className="h-5 w-5 rounded-full gradient-accent flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-primary-foreground" /></div>}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Savings Chart */}
      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Savings Projection</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 20%, 18%)" />
                <XAxis dataKey="quarter" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(225, 40%, 11%)", border: "1px solid hsl(225, 20%, 18%)", borderRadius: "8px", color: "hsl(210, 40%, 96%)", fontSize: 12 }} />
                <Bar dataKey="savings" fill="hsl(160, 84%, 39%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!aiResponse && strategies.length === 0 && (
        <motion.div variants={item} className="glass-card p-6 text-center">
          <Sparkles className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Enter an item and price above, then click <span className="text-primary font-medium">Simulate with AI</span> to get personalised strategies based on your real spending data.</p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Planner;
