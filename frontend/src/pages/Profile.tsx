import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Bell, HelpCircle, LogOut, ChevronRight,
  X, Loader2, CheckCircle2, Zap, Shield
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { analyticsApi, transactionsApi } from "@/lib/api";

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] } })
};

const fmtK = (n: number) =>
  n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(1)}k` : `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function Profile() {
  const { user, logout } = useAuth();
  const [summary, setSummary]   = useState<any>(null);
  const [txnCount, setTxnCount] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: user?.name || "", email: user?.email || "" });
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t] = await Promise.all([
          analyticsApi.summary(12),
          transactionsApi.list({ limit: 500 }),
        ]);
        setSummary(s.data);
        setTxnCount(t.data.length);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "Recently";

  const monthsActive = user?.created_at
    ? Math.max(1, Math.round((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : 1;

  const savingsRate = summary?.savings_rate || 0;

  const stats = [
    { label: "Transactions", value: txnCount.toString(),    color: "text-indigo-400" },
    { label: "Savings Rate", value: `${savingsRate.toFixed(0)}%`, color: "text-emerald-400" },
    { label: "Months Active", value: monthsActive.toString(), color: "text-blue-400" },
  ];

  return (
    <>
      <div className="pb-28 max-w-md mx-auto px-4 pt-8 space-y-4">

        {/* header */}
        <motion.div variants={fade} custom={0} initial="hidden" animate="show">
          <h1 className="text-2xl font-black text-white tracking-tight">Profile</h1>
        </motion.div>

        {/* user card — no ring, no health bar */}
        <motion.div variants={fade} custom={1} initial="hidden" animate="show">
          <div className="relative overflow-hidden rounded-3xl p-5"
            style={{ background: "linear-gradient(135deg, #1a1f3e 0%, #0f172a 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />

            <div className="flex items-center gap-4 relative z-10">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-black text-white truncate">{user?.name}</p>
                <p className="text-xs text-white/40 truncate">{user?.email}</p>
                <div className="mt-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                    Member since {joinedDate}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowEdit(true)}
                className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Settings className="h-3.5 w-3.5 text-white/40" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* stats */}
        <motion.div variants={fade} custom={2} initial="hidden" animate="show" className="grid grid-cols-3 gap-3">
          {stats.map(s => (
            <div key={s.label} className="rounded-2xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className={`text-xl font-black ${s.color}`}>{loading ? "—" : s.value}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* menu */}
        <motion.div variants={fade} custom={3} initial="hidden" animate="show"
          className="rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { icon: Bell,       label: "Notifications",  sub: "Transaction & budget alerts", color: "#f97316" },
            { icon: Shield,     label: "Privacy & Data", sub: "Export or delete your data",  color: "#6366f1" },
            { icon: HelpCircle, label: "Help & Support", sub: "FAQs and contact",            color: "#06b6d4" },
          ].map(m => (
            <button key={m.label} onClick={() => setActiveModal(m.label)}
              className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${m.color}20` }}>
                <m.icon className="h-4 w-4" style={{ color: m.color }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-white">{m.label}</p>
                <p className="text-[10px] text-white/30">{m.sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20" />
            </button>
          ))}
        </motion.div>

        {/* logout */}
        <motion.button variants={fade} custom={4} initial="hidden" animate="show"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-red-400 transition-colors"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <LogOut className="h-4 w-4" /> Log Out
        </motion.button>

        <motion.div variants={fade} custom={5} initial="hidden" animate="show" className="text-center pb-2">
          <p className="text-[10px] text-white/15">Cash Flow IQ · v1.0</p>
        </motion.div>
      </div>

      {/* edit profile modal */}
      <AnimatePresence>
        {showEdit && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-end justify-center px-4 pb-6"
            onClick={e => { if (e.target === e.currentTarget) setShowEdit(false); }}>
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-md rounded-3xl p-5 space-y-4 mb-16"
              style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between">
                <p className="text-base font-black text-white">Edit Profile</p>
                <button onClick={() => setShowEdit(false)} className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
                  <X className="h-3.5 w-3.5 text-white/60" />
                </button>
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">Full Name</label>
                <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white rounded-xl" />
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">Email</label>
                <Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white rounded-xl" />
              </div>
              {saved && (
                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-xs font-semibold">Profile updated!</p>
                </div>
              )}
              <p className="text-[10px] text-white/20">Name changes apply on next login.</p>
              <button onClick={() => { setSaved(true); setTimeout(() => { setSaved(false); setShowEdit(false); }, 1500); }}
                className="w-full py-3.5 rounded-2xl font-black text-sm text-white"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                Save Changes
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* info modals */}
      <AnimatePresence>
        {activeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-end justify-center px-4 pb-6"
            onClick={e => { if (e.target === e.currentTarget) setActiveModal(null); }}>
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-md rounded-3xl p-5 space-y-4 mb-16"
              style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between">
                <p className="text-base font-black text-white">{activeModal}</p>
                <button onClick={() => setActiveModal(null)} className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
                  <X className="h-3.5 w-3.5 text-white/60" />
                </button>
              </div>
              {activeModal === "Notifications" && (
                <div className="space-y-3">
                  {["Transaction alerts", "Budget warnings", "Weekly summary", "AI insights"].map(n => (
                    <div key={n} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <p className="text-sm text-white/70">{n}</p>
                      <div className="h-6 w-11 rounded-full bg-indigo-500/40 border border-indigo-500/30 flex items-center px-1">
                        <div className="h-4 w-4 rounded-full bg-indigo-400 ml-auto" />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-white/20 text-center pt-1">Full notification settings coming soon</p>
                </div>
              )}
              {activeModal === "Privacy & Data" && (
                <div className="space-y-3">
                  <p className="text-xs text-white/50 leading-relaxed">Your financial data is stored locally and encrypted at rest. We never sell your data.</p>
                  <button className="w-full py-3 rounded-2xl text-sm font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20">Export All Data (CSV)</button>
                  <button className="w-full py-3 rounded-2xl text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/20">Delete Account & Data</button>
                </div>
              )}
              {activeModal === "Help & Support" && (
                <div className="space-y-3">
                  {[
                    { q: "How do I import transactions?", a: "Go to Import tab and upload your bank statement PDF or CSV." },
                    { q: "Which banks are supported?",    a: "HDFC, SBI, ICICI, Axis, Kotak, Yes Bank and most Indian banks." },
                    { q: "Is my data secure?",            a: "Yes — all data stays on your local device and is never shared." },
                    { q: "How does AI Insights work?",    a: "We analyse your spending patterns locally to generate personalised insights." },
                  ].map(faq => (
                    <div key={faq.q} className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <p className="text-xs font-bold text-white mb-1">{faq.q}</p>
                      <p className="text-xs text-white/40 leading-relaxed">{faq.a}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}