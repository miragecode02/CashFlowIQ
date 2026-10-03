import type { LucideIcon } from "lucide-react";
import {
  UtensilsCrossed, ShoppingBag, Car, Clapperboard, HeartPulse, Shapes, Zap,
  GraduationCap, LineChart, Wallet, House, Repeat, Umbrella, Briefcase, Laptop,
  Building2, Store, PieChart, Landmark, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";

/* ── behaviour ──────────────────────────────────────────── */

// closes a sheet / overlay on Escape while it is open
export function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

// true at the desktop breakpoint (Tailwind lg, 1024px)
export function useIsDesktop() {
  const q = "(min-width: 1024px)";
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const h = () => setMatch(m.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  return match;
}

/* ── motion ─────────────────────────────────────────────── */

export const EASE = [0.32, 0.72, 0, 1] as const;

// blur-in is a desktop-only flourish: animating filter is costly on phone GPUs
export const richMotion = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export const fade = richMotion
  ? {
      hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
      show: (i = 0) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { delay: i * 0.06, duration: 0.8, ease: EASE } }),
    }
  : {
      hidden: { opacity: 0, y: 14 },
      show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.45, ease: EASE } }),
    };

// Apple-style springs: critically damped for taps (no overshoot); a little
// bounce only where a gesture carries momentum (sheets, flicks).
export const SPRING = { type: "spring", bounce: 0, visualDuration: 0.35 } as const;
export const sheetSpring = { type: "spring", bounce: 0.15, visualDuration: 0.32 } as const;

// where a flick would come to rest (Apple's scroll-deceleration projection)
export const project = (velocity: number, rate = 0.998) =>
  ((velocity / 1000) * rate) / (1 - rate);

/* ── bottom sheet ───────────────────────────────────────── */

// Dimmed modal sheet. Drag the grabber/header down (or flick it) to dismiss;
// the dismiss decision uses projected momentum, not just release position.
export function BottomSheet({ open, onClose, title, children, headerExtra }: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; headerExtra?: React.ReactNode;
}) {
  const controls = useDragControls();
  const desktop = useIsDesktop();
  useEscape(open, onClose);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const landing = info.offset.y + project(info.velocity.y);
    if (landing > 160 || info.velocity.y > 900) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-overlay bg-black/70 backdrop-blur-md" onClick={onClose} />
          <motion.div key="sheet" role="dialog" aria-modal="true" aria-label={title}
            initial={desktop ? { opacity: 0, scale: 0.96, y: 8 } : { y: "100%" }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.96, y: 8 } : { y: "100%" }}
            transition={desktop ? SPRING : sheetSpring}
            drag={desktop ? false : "y"} dragControls={controls} dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.06, bottom: 0.9 }}
            dragSnapToOrigin onDragEnd={onDragEnd}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-sheet flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:inset-0 lg:items-center lg:p-6">
            <div className="sheet pointer-events-auto">
              <div className="sheet-core space-y-5">
                {/* grab zone: grabber + header start the drag; content stays scrollable/selectable */}
                <div onPointerDown={(e) => !desktop && controls.start(e)} className="-mx-5 -mt-5 cursor-grab touch-none px-5 pt-3 active:cursor-grabbing lg:cursor-auto lg:pt-5">
                  <div className="mb-4 flex justify-center lg:hidden"><div className="h-1 w-10 rounded-full bg-white/15" /></div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    {headerExtra ?? (
                      <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="icon-btn h-8 w-8" aria-label="Close">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── colour ─────────────────────────────────────────────── */

// hex mirrors of the CSS tokens, for recharts / inline SVG
export const COLOR = {
  accent: "#c5e478",
  income: "#c5e478",
  expense: "#ec8a72",
  caution: "#e9b35a",
  neutral: "#8a8a93",
  ink: "rgba(250,250,247,0.72)",
  track: "rgba(255,255,255,0.06)",
  grid: "rgba(255,255,255,0.05)",
  tick: "rgba(255,255,255,0.32)",
  surface: "#111113",
  // chart-series steps (validated pair: CVD ΔE 10.8, normal ΔE 22.6 on #111113)
  seriesIncome: "#a3c44f",
  seriesSpend: "#d9725a",
};

export const tooltipStyle = {
  backgroundColor: "#141416",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  fontSize: 11,
  color: "#fafaf7",
  boxShadow: "0 12px 32px -12px rgba(0,0,0,0.6)",
  padding: "8px 12px",
};

/* ── categories ─────────────────────────────────────────── */

// fixed-order categorical hues (validated dark palette) — colour follows the entity
const CATEGORY_META: Record<string, { icon: LucideIcon; color: string }> = {
  "Food & Dining": { icon: UtensilsCrossed, color: "#d95926" },
  Food:            { icon: UtensilsCrossed, color: "#d95926" },
  Shopping:        { icon: ShoppingBag,     color: "#d55181" },
  Transport:       { icon: Car,             color: "#3987e5" },
  Entertainment:   { icon: Clapperboard,    color: "#9085e9" },
  Fun:             { icon: Clapperboard,    color: "#9085e9" },
  Health:          { icon: HeartPulse,      color: "#e66767" },
  Utilities:       { icon: Zap,             color: "#c98500" },
  Education:       { icon: GraduationCap,   color: "#199e70" },
  Investments:     { icon: LineChart,       color: "#2f9e44" },
  Invest:          { icon: LineChart,       color: "#2f9e44" },
  Income:          { icon: Wallet,          color: COLOR.income },
  Other:           { icon: Shapes,          color: COLOR.neutral },
  // fixed-entry categories (planner)
  Housing:         { icon: House,           color: "#3987e5" },
  Subscriptions:   { icon: Repeat,          color: "#9085e9" },
  Insurance:       { icon: Umbrella,        color: "#199e70" },
  Salary:          { icon: Briefcase,       color: COLOR.income },
  Freelance:       { icon: Laptop,          color: COLOR.income },
  Rental:          { icon: Building2,       color: COLOR.income },
  Business:        { icon: Store,           color: COLOR.income },
  Dividends:       { icon: PieChart,        color: COLOR.income },
  Pension:         { icon: Landmark,        color: COLOR.income },
};

export const categoryMeta = (name?: string) =>
  CATEGORY_META[name || ""] || CATEGORY_META.Other;

export function CategoryIcon({
  name, size = "md", tone, className,
}: { name?: string; size?: "sm" | "md" | "lg"; tone?: string; className?: string }) {
  const { icon: Icon, color } = categoryMeta(name);
  const c = tone || color;
  const box = size === "sm" ? "h-8 w-8 rounded-[10px]" : size === "lg" ? "h-12 w-12 rounded-[16px]" : "h-10 w-10 rounded-[13px]";
  const ico = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center", box, className)}
      style={{ background: `${c}1f`, boxShadow: `inset 0 0 0 1px ${c}26` }}
      aria-hidden
    >
      <Icon className={ico} style={{ color: c }} />
    </span>
  );
}

/* ── page scaffolding ───────────────────────────────────── */

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="18" fill="hsl(var(--primary))" />
      <path d="M18 40 L28 30 L35 36 L46 23" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="46" cy="23" r="3.5" fill="hsl(var(--primary-foreground))" />
    </svg>
  );
}

export function PageHeader({ eyebrow, title, sub, action }: {
  eyebrow?: string; title: string; sub?: string; action?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-4 pt-10 pb-2 lg:pt-12 lg:pb-4">
      <div className="min-w-0">
        {eyebrow && <span className="eyebrow mb-3">{eyebrow}</span>}
        <h1 className="text-[1.75rem] leading-[1.1] font-semibold text-foreground lg:text-[2rem]">{title}</h1>
        {sub && <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function SkeletonPage({ blocks = ["h-48", "h-28", "h-64"] }: { blocks?: string[] }) {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 pt-10 pb-32 lg:max-w-[1180px] lg:px-10 lg:pt-12" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-3 w-24 rounded-full" />
      <div className="skeleton h-8 w-44 rounded-xl" />
      {blocks.map((h, i) => <div key={i} className={cn("skeleton rounded-[1.75rem]", h)} />)}
    </div>
  );
}
