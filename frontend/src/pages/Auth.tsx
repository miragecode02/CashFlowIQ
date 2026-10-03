import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowUpRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { BrandMark, EASE, SPRING } from "@/lib/design";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError("");
    if (!email || !password || (mode === "register" && !name)) {
      setError("Fill in every field to continue.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate("/");
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(", "));
      } else if (!e.response) {
        setError("Can't reach the server. Check your connection and try again.");
      } else {
        setError(mode === "login" ? "We couldn't sign you in. Try again." : "We couldn't create your account. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && handleSubmit();

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      {/* ambient light */}
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-20%] h-[28rem] w-[28rem] rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 65%)" }} />
      <div aria-hidden className="pointer-events-none absolute bottom-[-30%] left-[-25%] h-[26rem] w-[26rem] rounded-full opacity-[0.06] blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(0 0% 100%), transparent 65%)" }} />

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        {/* brand */}
        <div className="mb-10">
          <BrandMark className="mb-8 h-11 w-11" />
          <span className="eyebrow mb-4">Cash Flow IQ</span>
          <h1 className="text-[2.25rem] font-semibold leading-[1.05]">
            {mode === "login" ? <>Know where every<br />rupee goes.</> : <>Create your<br />account.</>}
          </h1>
          <p className="mt-3 max-w-[32ch] text-sm leading-relaxed text-muted-foreground">
            Import statements, track recurring costs, and ask an AI advisor about your spending.
          </p>
        </div>

        {/* form */}
        <div className="bezel">
          <form className="bezel-core space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} noValidate>
            <div className="segmented" role="tablist">
              {(["login", "register"] as const).map((m) => (
                <button type="button" key={m} role="tab" aria-selected={mode === m}
                  onClick={() => { setMode(m); setError(""); }}
                  className={`segmented-item py-2 text-sm ${mode === m ? "text-foreground" : ""}`}>
                  {mode === m && (
                    <motion.span layoutId="auth-mode" className="absolute inset-0 rounded-full bg-white/[0.09] ring-1 ring-inset ring-white/[0.06]"
                      transition={SPRING} />
                  )}
                  <span className="relative">{m === "login" ? "Sign in" : "Create account"}</span>
                </button>
              ))}
            </div>

            <AnimatePresence initial={false}>
              {mode === "register" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="overflow-hidden"
                >
                  <label htmlFor="name" className="field-label pt-1">Full name</label>
                  <input id="name" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Ishaan Kapoor" autoComplete="name" className="field w-full" onKeyDown={onEnter} />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label htmlFor="email" className="field-label">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ishaan@gmail.com" autoComplete="email" className="field w-full" onKeyDown={onEnter} />
            </div>

            <div>
              <label htmlFor="password" className="field-label">Password</label>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="field w-full pr-12" onKeyDown={onEnter} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p role="alert"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="rounded-2xl bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading} className="btn-primary mt-2 w-full justify-between">
              <span>{loading ? (mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Sign in" : "Create account"}</span>
              <span className="btn-primary-icon">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              </span>
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
          By continuing you agree to the Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </main>
  );
}
