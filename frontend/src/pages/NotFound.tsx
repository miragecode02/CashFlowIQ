import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { BrandMark, EASE } from "@/lib/design";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 pb-24">
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-20%] h-[26rem] w-[26rem] rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 65%)" }} />
      <motion.div
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative w-full max-w-sm"
      >
        <BrandMark className="mb-10 h-10 w-10" />
        <p className="num-display text-[6rem] font-semibold leading-none text-foreground/90">404</p>
        <h1 className="mt-4 text-xl font-semibold">This page doesn't exist</h1>
        <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-muted-foreground">
          It may have moved, or the link might be wrong. Your data is safe.
        </p>
        <p className="mt-4 inline-block rounded-full bg-white/[0.04] px-3 py-1 text-[11px] text-muted-foreground font-mono-nums ring-1 ring-inset ring-white/[0.06]">
          {location.pathname}
        </p>
        <div className="mt-8">
          <button onClick={() => navigate("/")} className="btn-primary flex-row-reverse pl-1.5 pr-5">
            <span>Back to dashboard</span>
            <span className="btn-primary-icon"><ArrowLeft className="h-4 w-4" /></span>
          </button>
        </div>
      </motion.div>
    </main>
  );
};

export default NotFound;
