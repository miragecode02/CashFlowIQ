import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings2, Bell, LifeBuoy, LogOut, ChevronRight, Check, Fingerprint, ArrowUpRight
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { analyticsApi, transactionsApi } from "@/lib/api";
import { BottomSheet, fade, PageHeader } from "@/lib/design";

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
    : "recently";

  const monthsActive = user?.created_at
    ? Math.max(1, Math.round((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : 1;

  const savingsRate = summary?.savings_rate || 0;

  const stats = [
    { label: "Transactions",  value: txnCount.toString() },
    { label: "Savings rate",  value: `${savingsRate.toFixed(0)}%` },
    { label: "Months active", value: monthsActive.toString() },
  ];

  const menu = [
    { icon: Bell,        label: "Notifications",  sub: "Transaction and budget alerts" },
    { icon: Fingerprint, label: "Privacy & data", sub: "Export or delete your data" },
    { icon: LifeBuoy,    label: "Help & support", sub: "Common questions" },
  ];

  return (
    <>
      <main className="mx-auto max-w-md space-y-4 px-4 pb-32 lg:max-w-2xl lg:px-10 lg:pb-16">
        <motion.div variants={fade} custom={0} initial="hidden" animate="show">
          <PageHeader title="Profile" />
        </motion.div>

        {/* identity */}
        <motion.section variants={fade} custom={1} initial="hidden" animate="show" className="bezel">
          <div className="bezel-core bezel-hero p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-primary text-2xl font-semibold text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p className="truncate text-lg font-semibold">{user?.name}</p>
                <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <button onClick={() => setShowEdit(true)} className="icon-btn" aria-label="Edit profile">
                <Settings2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-3 divide-x divide-white/[0.06]">
              {stats.map(s => (
                <div key={s.label} className="px-3 first:pl-0 last:pr-0">
                  {loading
                    ? <div className="skeleton h-7 w-12 rounded-lg" />
                    : <p className="num-display text-2xl font-semibold">{s.value}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[11px] text-muted-foreground/70">Member since {joinedDate}</p>
          </div>
        </motion.section>

        {/* menu */}
        <motion.section variants={fade} custom={2} initial="hidden" animate="show" className="bezel">
          <div className="bezel-core overflow-hidden p-1.5">
            {menu.map(m => (
              <button key={m.label} onClick={() => setActiveModal(m.label)}
                className="group flex w-full items-center gap-3 rounded-[1.1rem] px-3 py-3 text-left transition-colors duration-300 hover:bg-white/[0.04]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white/[0.05] text-foreground/70 ring-1 ring-inset ring-white/[0.06]">
                  <m.icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{m.sub}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 ease-premium group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </motion.section>

        <motion.button variants={fade} custom={3} initial="hidden" animate="show"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium text-destructive ring-1 ring-inset ring-destructive/20 transition-all duration-300 ease-premium hover:bg-destructive/10 active:scale-[0.98]">
          <LogOut className="h-4 w-4" /> Log out
        </motion.button>

        <p className="pt-2 text-center text-[11px] text-muted-foreground/50">Cash Flow IQ · v1.0</p>
      </main>

      {/* edit profile */}
      <BottomSheet open={showEdit} onClose={() => setShowEdit(false)} title="Edit profile">
        <div>
          <label htmlFor="pf-name" className="field-label">Full name</label>
          <input id="pf-name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="field w-full" />
        </div>
        <div>
          <label htmlFor="pf-email" className="field-label">Email</label>
          <input id="pf-email" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="field w-full" />
        </div>
        {saved && (
          <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2.5 text-primary">
            <Check className="h-4 w-4" />
            <p className="text-xs font-medium">Profile updated</p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Name changes apply on next login.</p>
        <button onClick={() => { setSaved(true); setTimeout(() => { setSaved(false); setShowEdit(false); }, 1500); }}
          className="btn-primary w-full justify-between">
          <span>Save changes</span>
          <span className="btn-primary-icon"><ArrowUpRight className="h-4 w-4" /></span>
        </button>
      </BottomSheet>

      {/* info sheets */}
      <BottomSheet open={!!activeModal} onClose={() => setActiveModal(null)} title={activeModal || ""}>
        {activeModal === "Notifications" && (
          <div>
            <div className="divide-y divide-white/[0.05]">
              {["Transaction alerts", "Budget warnings", "Weekly summary", "AI insights"].map(n => (
                <div key={n} className="flex items-center justify-between py-3">
                  <p className="text-sm text-foreground/80">{n}</p>
                  <span className="flex h-6 w-11 items-center rounded-full bg-primary/30 px-0.5" aria-hidden>
                    <span className="ml-auto h-5 w-5 rounded-full bg-primary" />
                  </span>
                </div>
              ))}
            </div>
            <p className="pt-3 text-center text-[11px] text-muted-foreground">Notification controls are coming soon.</p>
          </div>
        )}
        {activeModal === "Privacy & data" && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">Your financial data is stored in your Cash Flow IQ account. We never sell it.</p>
            <button disabled className="btn-ghost w-full justify-between opacity-60">
              Export all data (CSV) <span className="text-[11px] text-muted-foreground">Soon</span>
            </button>
            <button disabled className="flex w-full items-center justify-between rounded-full px-4 py-2.5 text-sm font-medium text-destructive/70 ring-1 ring-inset ring-destructive/15 opacity-60">
              Delete account and data <span className="text-[11px] text-muted-foreground">Soon</span>
            </button>
          </div>
        )}
        {activeModal === "Help & support" && (
          <div className="divide-y divide-white/[0.05]">
            {[
              { q: "How do I import transactions?", a: "Open the Import tab and upload your bank statement as a PDF, CSV or Excel file." },
              { q: "Which banks are supported?",    a: "HDFC, SBI, ICICI, Axis, Kotak, Yes Bank and most other Indian banks." },
              { q: "Is my data secure?",            a: "Your data is tied to your account and is never shared with third parties." },
              { q: "How do insights work?",         a: "We look at your spending patterns to flag trends, heavy categories and savings gaps." },
            ].map(faq => (
              <div key={faq.q} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium">{faq.q}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
