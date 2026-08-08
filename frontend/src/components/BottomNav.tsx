import { useLocation, useNavigate } from "react-router-dom";
import { Home, Calendar, User, MessageCircle, Plus, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { transactionsApi } from "@/lib/api";



const tabs = [
  { path: "/",        label: "Home",      icon: Home          },
  { path: "/advisor", label: "AI Advisor", icon: MessageCircle },
  { path: "/upload",  label: "Import",    icon: Upload        },
  { path: "/planner", label: "Planner",   icon: Calendar      },
  { path: "/profile", label: "Profile",   icon: User          },
];
const CATEGORIES = [
  { id: 1,  name: "Food",      emoji: "🍽️" },
  { id: 2,  name: "Shopping",  emoji: "🛍️" },
  { id: 3,  name: "Transport", emoji: "🚗" },
  { id: 4,  name: "Fun",       emoji: "🎬" },
  { id: 5,  name: "Health",    emoji: "❤️" },
  { id: 6,  name: "Other",     emoji: "📦" },
  { id: 7,  name: "Utilities", emoji: "⚡" },
  { id: 8,  name: "Education", emoji: "📚" },
  { id: 9,  name: "Invest",    emoji: "📈" },
  { id: 10, name: "Income",    emoji: "💰" },
];

const EMPTY_FORM = {
  amount: "", note: "", type: "expense",
  category_id: "6", date: new Date().toISOString().split("T")[0]
};

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSheet, setShowSheet] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [done, setDone]     = useState(false);

  const touchStartY = useRef<number>(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartY.current - e.changedTouches[0].clientY > 40) setShowSheet(true);
  };

  const handleSave = async () => {
    if (!form.amount) { setError("Enter an amount"); return; }
    setSaving(true); setError("");
    try {
      await transactionsApi.create({
        amount: parseFloat(form.amount),
        type: form.type,
        description: CATEGORIES.find(c => String(c.id) === form.category_id)?.name || "Transaction",
        note: form.note || undefined,
        category_id: parseInt(form.category_id),
        date: new Date(form.date).toISOString(),
      });
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setShowSheet(false);
        setForm({ ...EMPTY_FORM, date: new Date().toISOString().split("T")[0] });
        window.dispatchEvent(new Event("txn-added"));
      }, 800);
    } catch (e: any) { setError(e.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <>
      {/* bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-2 px-4"
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="w-full max-w-md rounded-2xl px-2 py-2 flex items-center justify-around relative"
          style={{ background: "rgba(10,13,28,0.92)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>

          <div className="absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="w-8 h-0.5 rounded-full bg-white/20" />
          </div>

          {tabs.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button key={path} onClick={() => navigate(path)}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all relative"
                style={{ minWidth: 52 }}>
                {active && (
                  <motion.div layoutId="nav-pill" className="absolute inset-0 rounded-xl"
                    style={{ background: "rgba(99,102,241,0.15)" }}
                    transition={{ type: "spring", damping: 24, stiffness: 300 }} />
                )}
                <Icon className={`h-5 w-5 relative z-10 transition-colors ${active ? "text-indigo-400" : "text-white/30"}`} />
                <span className={`text-[10px] font-semibold relative z-10 transition-colors ${active ? "text-indigo-400" : "text-white/30"}`}>
                  {label}
                </span>
              </button>
            );
          })}
      {/* floating + button — home only */}
      {location.pathname === "/" && (
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowSheet(true)}
          className="absolute -top-16 right-25 h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          <Plus className="h-5 w-5 text-white" />
        </motion.button>
      )}
        </div>
      </div>

      {/* add transaction sheet */}
      <AnimatePresence>
        {showSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
              onClick={() => setShowSheet(false)} />

            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              drag="y" dragConstraints={{ top: 0 }} dragElastic={0.1}
              onDragEnd={(_, info) => { if (info.offset.y > 80) setShowSheet(false); }}
              className="fixed bottom-0 left-0 right-0 z-[100] flex justify-center px-4 pb-6">
              <div className="w-full max-w-md rounded-3xl p-5 space-y-4"
                style={{ background: "#0c1022", border: "1px solid rgba(255,255,255,0.1)" }}>

                {/* drag handle */}
                <div className="flex justify-center -mt-1 mb-1">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                <p className="text-base font-black text-white">Add Transaction</p>

                {/* expense / income */}
                <div className="grid grid-cols-2 gap-2">
                  {["expense", "income"].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`py-2.5 rounded-2xl text-sm font-bold transition-all ${form.type === t
                        ? t === "expense" ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                         : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-white/5 text-white/30"}`}>
                      {t === "expense" ? "− Expense" : "+ Income"}
                    </button>
                  ))}
                </div>

                {/* amount */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-lg font-bold">₹</span>
                  <Input type="number" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className="bg-white/5 border-white/10 text-white rounded-xl text-2xl font-black h-14 pl-9"
                    autoFocus />
                </div>

                {/* category pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {CATEGORIES.map(c => (
                    <button key={c.id} onClick={() => setForm(f => ({ ...f, category_id: String(c.id) }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                        form.category_id === String(c.id)
                          ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40"
                          : "bg-white/5 text-white/40"}`}>
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>

                {/* optional note */}
                <Input value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="📝 Add a note… (optional)"
                  className="bg-white/5 border-white/10 text-white/70 rounded-xl text-sm placeholder:text-white/25" />

                {/* date */}
                <Input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white rounded-xl text-sm" />

                {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}

                <motion.button onClick={handleSave} disabled={saving || done}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-4 rounded-2xl font-black text-sm text-white disabled:opacity-60"
                  style={{ background: done ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  {done ? "✓ Saved!" : saving ? "Saving…" : "Save Transaction"}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}