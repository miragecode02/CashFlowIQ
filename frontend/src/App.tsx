import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
import { lazy, Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { BrandMark, SkeletonPage } from "@/lib/design";
import { prefetchHome } from "@/lib/prefetch";

// screens load on demand so phones parse only what they show
const loadHome        = () => import("./pages/Home");
const Home            = lazy(loadHome);
// start fetching the dashboard alongside the auth check instead of after it
if (typeof window !== "undefined" && window.location.pathname === "/") { loadHome(); prefetchHome(); }
const Planner         = lazy(() => import("./pages/Planner"));
const Advisor         = lazy(() => import("./pages/Advisor"));
const FinancialHealth = lazy(() => import("./pages/FinancialHealth"));
const Profile         = lazy(() => import("./pages/Profile"));
const AuthPage        = lazy(() => import("./pages/Auth"));
const StatementUpload = lazy(() => import("./pages/StatementUpload"));
const NotFound        = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Loading">
      <BrandMark className="h-10 w-10 animate-pulse" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-dvh lg:pl-[248px]">
      <Sidebar />
      <Suspense fallback={<SkeletonPage />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/advisor" element={<Advisor />} />
        <Route path="/health" element={<FinancialHealth />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/upload" element={<StatementUpload />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      <BottomNav />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* honours the OS "reduce motion" setting for every Motion animation */}
    <MotionConfig reducedMotion="user">
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Suspense fallback={null}><AuthPage /></Suspense>} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </MotionConfig>
  </QueryClientProvider>
);

export default App;