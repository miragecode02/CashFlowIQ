import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import { AxiosError } from "axios";

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] } })
};

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
      setError("File too large. Max size is 10MB.");
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

  return (
    <div className="pb-28 max-w-md mx-auto px-4 pt-8 space-y-5">
      {/* header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <h1 className="text-2xl font-black text-white tracking-tight">Import Statement</h1>
        <p className="text-xs text-white/40 mt-1">Upload your bank statement to import transactions</p>
      </motion.div>

      {/* supported banks */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Supported Banks</p>
        <div className="flex flex-wrap gap-1.5">
          {["HDFC", "SBI", "ICICI", "Axis", "Kotak", "Yes Bank", "IDFC", "PNB"].map(b => (
            <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 font-medium">{b}</span>
          ))}
        </div>
        <p className="text-[10px] text-white/20 mt-2">Supports PDF, CSV, and Excel formats</p>
      </motion.div>

      {/* drop zone */}
      {!file && (
        <motion.div variants={fade} custom={2} initial="hidden" animate="show"
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          className="rounded-3xl p-8 text-center cursor-pointer transition-all"
          style={{
            background: dragging ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
            border: `2px dashed ${dragging ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`,
          }}
          onClick={() => document.getElementById("file-input")?.click()}>
          <Upload className={`h-10 w-10 mx-auto mb-3 ${dragging ? "text-indigo-400" : "text-white/20"}`} />
          <p className="text-sm font-bold text-white/60">Drop your statement here</p>
          <p className="text-xs text-white/30 mt-1">or tap to browse files</p>
          <p className="text-[10px] text-white/20 mt-3">PDF, CSV, Excel — max 10MB</p>
          <input id="file-input" type="file" accept=".pdf,.csv,.xlsx,.xls"
            className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </motion.div>
      )}

      {/* file selected */}
      {file && status !== "done" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{file.name}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button onClick={reset} className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
              <X className="h-3.5 w-3.5 text-white/50" />
            </button>
          </div>

          {/* progress bar */}
          {status === "uploading" && (
            <div className="mt-3">
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full bg-indigo-500"
                  initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }} />
              </div>
              <p className="text-[10px] text-white/30 mt-1 text-center">Parsing transactions... {progress}%</p>
            </div>
          )}
        </motion.div>
      )}

      {/* error */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl p-3 flex items-center gap-2"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </motion.div>
      )}

      {/* upload button */}
      {file && status !== "done" && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={handleUpload} disabled={status === "uploading"}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          {status === "uploading"
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing...</>
            : <><Upload className="h-4 w-4" /> Import Transactions</>}
        </motion.button>
      )}

      {/* result */}
      <AnimatePresence>
        {result && status === "done" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 space-y-4"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="text-sm font-bold text-white">Import Complete!</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Found",   value: result.total_found, color: "text-white" },
                { label: "Saved",   value: result.saved,       color: "text-emerald-400" },
                { label: "Skipped", value: result.skipped,     color: "text-white/40" },
              ].map(s => (
                <div key={s.label} className="text-center rounded-xl p-2"
                  style={{ background: "rgba(255,255,255,0.05)" }}>
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-emerald-400/70 text-center">{result.message}</p>
            <button onClick={reset}
              className="w-full py-3 rounded-2xl font-bold text-sm text-white"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              Import Another
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* tips */}
      {status === "idle" && !file && (
        <motion.div variants={fade} custom={3} initial="hidden" animate="show"
          className="rounded-2xl p-4 space-y-2"
          style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
          <p className="text-xs font-bold text-indigo-400">💡 Tips</p>
          <ul className="space-y-1.5">
            {[
              "Download statement from your bank's net banking portal",
              "HDFC: Accounts → Request → Account Statement",
              "SBI: e-Statement → Email Statement",
              "Select date range and download as CSV or PDF",
            ].map((tip, i) => (
              <li key={i} className="text-[10px] text-white/40 flex items-start gap-1.5">
                <span className="text-indigo-400 shrink-0">→</span>{tip}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
