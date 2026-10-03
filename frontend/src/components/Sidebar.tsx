import { NavLink } from "react-router-dom";
import { LayoutGrid, MessageSquareText, FileUp, CalendarRange, Activity, Plus, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BrandMark } from "@/lib/design";

const items = [
  { to: "/",        label: "Overview", icon: LayoutGrid        },
  { to: "/advisor", label: "Advisor",  icon: MessageSquareText },
  { to: "/planner", label: "Planner",  icon: CalendarRange     },
  { to: "/upload",  label: "Import",   icon: FileUp            },
  { to: "/health",  label: "Health",   icon: Activity          },
];

// Desktop-only navigation rail (lg and up). Phones use the floating BottomNav.
export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-nav hidden w-[248px] flex-col border-r border-white/[0.06] bg-[#0b0b0d]/80 px-4 py-6 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <BrandMark className="h-7 w-7" />
        <span className="text-[15px] font-semibold tracking-tight">Cash Flow IQ</span>
      </div>

      <button onClick={() => window.dispatchEvent(new Event("open-add-txn"))}
        className="mt-8 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-all duration-300 ease-premium hover:brightness-105 active:scale-[0.98]">
        <Plus className="h-4 w-4" /> Add transaction
      </button>

      <nav aria-label="Primary" className="mt-8 space-y-0.5">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"}
            className={({ isActive }) =>
              `group flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200 ${isActive
                ? "bg-white/[0.07] font-medium text-foreground"
                : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"}`}>
            {({ isActive }) => (
              <>
                <Icon className={`h-[18px] w-[18px] ${isActive ? "text-primary" : ""}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <NavLink to="/profile"
        className={({ isActive }) =>
          `group mt-auto flex items-center gap-3 rounded-2xl p-2.5 transition-colors duration-200 ${isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white/[0.08] text-sm font-semibold ring-1 ring-inset ring-white/[0.08]">
          {user?.name?.[0]?.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user?.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{user?.email}</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 ease-premium group-hover:translate-x-0.5" />
      </NavLink>
    </aside>
  );
}
