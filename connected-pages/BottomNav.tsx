import React from "react";
import { Home, BarChart3, Calculator, MessageCircle, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/analytics", icon: BarChart3, label: "Analytics" },
  { path: "/planner", icon: Calculator, label: "Planner" },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdvisorActive = location.pathname === "/advisor";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-2 pb-[env(safe-area-inset-bottom)]">
      {/* Floating AI Advisor button — hidden when already on advisor page */}
      {!isAdvisorActive && (
        <div className="mx-auto max-w-md flex justify-center -mb-1">
          <button
            onClick={() => navigate("/advisor")}
            className="relative -top-3 flex flex-col items-center gap-0.5"
          >
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="h-14 w-14 rounded-full gradient-accent flex items-center justify-center shadow-[0_0_20px_hsl(217_91%_60%/0.4)] ring-4 ring-background"
            >
              <MessageCircle className="h-6 w-6 text-primary-foreground" />
            </motion.div>
            <span className="text-[10px] font-medium text-muted-foreground">
              AI Advisor
            </span>
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="glass-card rounded-none border-t border-border/40 -mx-2 px-2">
        <div className="mx-auto flex max-w-md items-center justify-evenly">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-0.5 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full gradient-accent"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <tab.icon
                  className={`h-5 w-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-[10px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
