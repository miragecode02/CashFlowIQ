import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudUpload, FileText, Check, TriangleAlert, Loader2, X, ArrowUpRight, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { AxiosError } from "axios";
import { EASE, fade, PageHeader } from "@/lib/design";

const BANKS = ["HDFC", "SBI", "ICICI", "Axis", "Kotak", "Yes Bank", "IDFC", "PNB"];

export default function StatementUpload() {
  const [dragging, setDragging]   = useState(false);
  const [file, setFile]           = useState<File | null>(null);
  const [status, setStatus]       = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [result, setResult]       = useState<any>(null);
  const [error, setError]         = useState("");
  const [progress, setProgress]   = useState(0);

  const handleFile = (f: File) => {
    const allowed = [".pdf", ".csv", ".xlsx", ".xls"];
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setError("Only PDF, CSV, and Excel files are supported.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("That file is over 10 MB. Try a shorter date range.");
      return;
    }
    setFile(f);
    setError("");
    setStatus("idle");
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(0);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 8, 90));
    }, 300);

    try {
      const res = await api.post("/statements/upload", formData);

      clearInterval(interval);
      setProgress(100);
      setResult(res.data);
      setStatus("done");
      window.dispatchEvent(new Event("txn-added"));
    } catch (e) {
      clearInterval(interval);
      const errorMessage = e instanceof AxiosError
        ? (e.response?.data?.detail || e.response?.data?.message || e.message || "Upload failed")
        : "Upload failed";
      setError(errorMessage);
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setResult(null);
    setError("");
    setProgress(0);
  };

  const openPicker = () => document.getElementById("file-input")?.click();

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-32 lg:grid lg:max-w-[1180px] lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-5 lg:space-y-0 lg:px-10 lg:pb-16">
      <motion.div variants={fade} custom={0} initial="hidden" animate="show" className="lg:col-span-12">
        <PageHeader title="Import a statement" sub="Upload a statement and we'll pull out every transaction and categorise it." />
      </motion.div>

      {/* drop zone */}
      {!file && (
        <motion.div variants={fade} custom={1} initial="hidden" animate="show" className="bezel lg:col-span-7">
          <div
            role="button" tabIndex={0} aria-label="Choose a statement file"
            onKeyDown={e => (e.key === "Enter" || e.key === " ") && openPicker()}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={openPicker}
            className={`bezel-core group relative cursor-pointer overflow-hidden px-6 py-12 text-center transition-all duration-500 ease-premium ${dragging ? "bg-primary/[0.06] ring-1 ring-inset ring-primary/40" : "hover:bg-white/[0.02]"}`}>
            <div aria-hidden className="pointer-events-none absolute inset-3 rounded-[1.1rem] border border-dashed border-white/[0.08]" />
            <span className={`relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[18px] ring-1 ring-inset transition-all duration-500 ease-premium ${dragging ? "bg-primary text-primary-foreground ring-primary scale-105" : "bg-white/[0.05] text-foreground/70 ring-white/[0.08] group-hover:-translate-y-1"}`}>
              <CloudUpload className="h-6 w-6" />
            </span>
            <p className="relative text-base font-semibold">{dragging ? "Drop to add" : "Drop your statement here"}</p>
            <p className="relative mt-1 text-sm text-muted-foreground">or <span className="lg:hidden">tap</span><span className="hidden lg:inline">click</span> to browse</p>
            <p className="relative mt-5 text-[11px] text-muted-foreground/70">PDF, CSV or Excel, up to 10 MB</p>
            <input id="file-input" type="file" accept=".pdf,.csv,.xlsx,.xls"
              className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        </motion.div>
      )}

      {/* file selected */}
      {file && status !== "done" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="bezel lg:col-span-7">
          <div className="bezel-core space-y-4 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground font-mono-nums">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              {status !== "uploading" && (
                <button onClick={reset} className="icon-btn h-8 w-8" aria-label="Remove file">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {status === "uploading" && (
              <div>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div className="h-full origin-left rounded-full bg-primary"
                    animate={{ scaleX: progress / 100 }} initial={{ scaleX: 0 }}
                    transition={{ duration: 0.4, ease: EASE }} />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground font-mono-nums">Reading transactions… {progress}%</p>
              </div>
            )}

            <button onClick={handleUpload} disabled={status === "uploading"} className="btn-primary w-full justify-between">
              <span>{status === "uploading" ? "Importing…" : status === "error" ? "Try again" : "Import transactions"}</span>
              <span className="btn-primary-icon">
                {status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              </span>
            </button>
          </div>
        </motion.div>
      )}

      {/* error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert"
            className="flex items-start gap-3 rounded-2xl bg-destructive/10 px-4 py-3 ring-1 ring-inset ring-destructive/20 lg:col-span-7">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-xs leading-relaxed text-destructive">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* result */}
      <AnimatePresence>
        {result && status === "done" && (
          <motion.section initial={{ opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: EASE }} className="bezel lg:col-span-7">
            <div className="bezel-core bezel-hero space-y-5 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold">Import complete</h2>
                  <p className="text-xs text-muted-foreground">{result.message}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
                {[
                  { label: "Found",   value: result.total_found, tone: "text-foreground" },
                  { label: "Saved",   value: result.saved,       tone: "text-primary" },
                  { label: "Skipped", value: result.skipped,     tone: "text-muted-foreground" },
                ].map(s => (
                  <div key={s.label} className="px-3 first:pl-0">
                    <p className={`num-display text-3xl font-semibold ${s.tone}`}>{s.value}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Link to="/" className="btn-primary flex-1 justify-between">
                  <span>See dashboard</span>
                  <span className="btn-primary-icon"><ArrowUpRight className="h-4 w-4" /></span>
                </Link>
                <button onClick={reset} className="btn-ghost"><RotateCcw className="h-3.5 w-3.5" /> Another</button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* banks + how-to */}
      {status === "idle" && !file && (
        <motion.section variants={fade} custom={2} initial="hidden" animate="show" className="space-y-6 pt-2 lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:pt-2">
          <div>
            <h2 className="mb-3 text-sm font-medium text-foreground/80">Works with</h2>
            <div className="flex flex-wrap gap-1.5">
              {BANKS.map(b => (
                <span key={b} className="rounded-full bg-white/[0.04] px-3 py-1 text-xs text-foreground/70 ring-1 ring-inset ring-white/[0.05]">{b}</span>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-medium text-foreground/80">Getting your statement</h2>
            <ol className="space-y-3">
              {[
                "Log in to your bank's net banking portal",
                "HDFC: Accounts → Request → Account Statement",
                "SBI: e-Statement → Email Statement",
                "Pick a date range and download as PDF or CSV",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground/70">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-[10px] text-muted-foreground font-mono-nums">{i + 1}</span>
                  {tip}
                </li>
              ))}
            </ol>
          </div>
        </motion.section>
      )}
    </main>
  );
}
