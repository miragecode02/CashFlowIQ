import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, MessageSquareText, FileUp, CalendarRange, CircleUser, ArrowUpRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { transactionsApi } from "@/lib/api";
import { BottomSheet, CategoryIcon, EASE, SPRING } from "@/lib/design";

const tabs = [
  { path: "/",        label: "Home",    icon: LayoutGrid        },
  { path: "/advisor", label: "Advisor", icon: MessageSquareText },
  { path: "/upload",  label: "Import",  icon: FileUp            },
  { path: "/planner", label: "Planner", icon: CalendarRange     },
  { path: "/profile", label: "Profile", icon: CircleUser        },
];
const CATEGORIES = [
  { id: 1,  name: "Food"      },
  { id: 2,  name: "Shopping"  },
  { id: 3,  name: "Transport" },
  { id: 4,  name: "Fun"       },
  { id: 5,  name: "Health"    },
  { id: 6,  name: "Other"     },
  { id: 7,  name: "Utilities" },
  { id: 8,  name: "Education" },
  { id: 9,  name: "Invest"    },
  { id: 10, name: "Income"    },
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

  // other screens open the sheet through a window event
  useEffect(() => {
    const open = () => setShowSheet(true);
    window.addEventListener("open-add-txn", open);
    return () => window.removeEventListener("open-add-txn", open);
  }, []);

  const touchStartY = useRef<number>(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartY.current - e.changedTouches[0].clientY > 40) setShowSheet(true);
  };

  const handleSave = async () => {
    if (!form.amount) { setError("Enter an amount to continue."); return; }
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
    } catch (e: any) { setError(e.response?.data?.detail || "Couldn't save this transaction. Try again."); }
    finally { setSaving(false); }
  };

  const isExpense = form.type === "expense";

  return (
    <>
      {/* floating island nav */}
      <nav aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-nav flex justify-center px-4 lg:hidden pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="pointer-events-auto flex items-center gap-1 rounded-full p-1.5 nav-material ring-1 ring-white/[0.08] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)]">
          {tabs.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button key={path} onClick={() => navigate(path)}
                aria-label={label} aria-current={active ? "page" : undefined}
                className={`relative flex h-11 items-center justify-center gap-2 rounded-full transition-[padding,color] duration-500 ease-premium ${active ? "px-4 text-background" : "w-11 text-foreground/45 hover:text-foreground/80"}`}>
                {active && (
                  <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-foreground"
                    transition={SPRING} />
                )}
                <Icon className="relative h-[18px] w-[18px]" />
                {active && (
                  <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
                    className="relative text-xs font-semibold">
                    {label}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* add transaction sheet */}
      <BottomSheet open={showSheet} onClose={() => setShowSheet(false)} title="Add transaction"
        headerExtra={
          <div className="segmented w-44" onPointerDown={(e) => e.stopPropagation()}>
            {(["expense", "income"] as const).map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`segmented-item py-1.5 ${form.type === t ? "text-foreground" : ""}`}>
                {form.type === t && (
                  <motion.span layoutId="txn-type" className="absolute inset-0 rounded-full bg-white/[0.09] ring-1 ring-inset ring-white/[0.08]"
                    transition={SPRING} />
                )}
                <span className="relative capitalize">{t}</span>
              </button>
            ))}
          </div>
        }>
        {/* amount */}
        <label className="block text-center">
          <span className="text-xs font-medium text-muted-foreground">Amount</span>
          <div className="flex items-baseline justify-center gap-1 py-2">
            <span className={`shrink-0 whitespace-nowrap text-2xl font-medium ${isExpense ? "text-chart-rust/70" : "text-primary/70"}`}>
              {isExpense ? "−₹" : "+₹"}
            </span>
            <input type="number" inputMode="decimal" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0" autoFocus
              style={{ width: `${Math.min(Math.max(form.amount.length, 1), 10) + 0.6}ch` }}
              className="num-display min-w-0 bg-transparent text-left text-5xl font-semibold text-foreground placeholder:text-white/15 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
        </label>

        {/* category chips */}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-hide">
          {CATEGORIES.map(c => {
            const on = form.category_id === String(c.id);
            return (
              <button key={c.id} onClick={() => setForm(f => ({ ...f, category_id: String(c.id) }))}
                className={`flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-xs font-medium transition-all duration-300 ease-premium ${on
                  ? "bg-white/[0.1] text-foreground ring-1 ring-inset ring-white/15"
                  : "bg-white/[0.03] text-muted-foreground hover:text-foreground"}`}>
                <CategoryIcon name={c.name} size="sm" className="h-7 w-7 rounded-full" />
                {c.name}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label htmlFor="txn-note" className="field-label">Note <span className="text-muted-foreground/60">(optional)</span></label>
            <input id="txn-note" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Dinner with Aarav"
              className="field w-full" />
          </div>
          <div>
            <label htmlFor="txn-date" className="field-label">Date</label>
            <input id="txn-date" type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="field w-[9.5rem] font-mono-nums text-xs" />
          </div>
        </div>

        {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-2.5 text-xs text-destructive">{error}</p>}

        <button onClick={handleSave} disabled={saving || done} className="btn-primary w-full justify-between">
          <span>{done ? "Saved" : saving ? "Saving…" : "Save transaction"}</span>
          <span className="btn-primary-icon">
            {done ? <Check className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          </span>
        </button>
      </BottomSheet>
    </>
  );
}
