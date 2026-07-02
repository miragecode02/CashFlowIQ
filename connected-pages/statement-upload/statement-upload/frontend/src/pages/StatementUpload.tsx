import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, CheckCircle, AlertCircle, Sparkles,
  X, CloudUpload, Building2, Loader2
} from "lucide-react";
import api from "@/lib/api";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const SUPPORTED_BANKS = [
  { name: "HDFC Bank", color: "bg-blue-500/20 text-blue-400" },
  { name: "SBI", color: "bg-sky-500/20 text-sky-400" },
  { name: "ICICI Bank", color: "bg-orange-500/20 text-orange-400" },
  { name: "Axis Bank", color: "bg-purple-500/20 text-purple-400" },
];

type UploadState = "idle" | "uploading" | "success" | "error";

interface UploadResult {
  saved: number;
  total_found: number;
  skipped: number;
  message: string;
}

const StatementUpload = () => {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const allowed = [".pdf", ".csv", ".xlsx", ".xls"];
    const valid = allowed.some(ext => f.name.toLowerCase().endsWith(ext));
    if (!valid) {
      setError("Only PDF, CSV, or Excel files are supported.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File too large. Max 10MB.");
      return;
    }
    setFile(f);
    setError("");
    setState("idle");
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setState("uploading");
    setProgress(0);

    // Simulate progress while uploading
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 12, 85));
    }, 300);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/statements/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      clearInterval(interval);
      setProgress(100);
      setResult(data);
      setState("success");
    } catch (e: any) {
      clearInterval(interval);
      setError(e.response?.data?.detail || "Upload failed. Please try again.");
      setState("error");
    }
  };

  const reset = () => {
    setFile(null);
    setState("idle");
    setResult(null);
    setError("");
    setProgress(0);
  };

  const fileIcon = (name: string) => {
    if (name.endsWith(".pdf")) return "📄";
    if (name.endsWith(".csv")) return "📊";
    return "📗";
  };

  return (
    <motion.div
      className="space-y-4 pb-24 px-4 pt-6 max-w-md mx-auto"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h1 className="text-xl font-bold text-foreground">Import Statement</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Upload your bank statement to auto-import transactions</p>
      </motion.div>

      {/* Supported Banks */}
      <motion.div variants={item} className="flex flex-wrap gap-2">
        {SUPPORTED_BANKS.map(b => (
          <span key={b.name} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${b.color}`}>
            {b.name}
          </span>
        ))}
      </motion.div>

      {/* Drop Zone */}
      <motion.div variants={item}>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer
            ${dragOver ? "border-primary bg-primary/10" : "border-border/40 bg-secondary/30 hover:border-primary/50 hover:bg-primary/5"}
            ${file ? "cursor-default" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-2xl gradient-accent/20 border border-primary/30 flex items-center justify-center">
                  <CloudUpload className="h-7 w-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Drop your statement here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                </div>
                <p className="text-[10px] text-muted-foreground">Supports PDF · CSV · Excel (.xlsx/.xls) · Max 10MB</p>
              </motion.div>
            ) : (
              <motion.div key="file" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 w-full">
                <span className="text-4xl">{fileIcon(file.name)}</span>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={e => { e.stopPropagation(); reset(); }} className="absolute top-3 right-3 h-7 w-7 rounded-full bg-secondary flex items-center justify-center hover:bg-destructive/20 transition-colors">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Progress Bar */}
      <AnimatePresence>
        {state === "uploading" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-xs font-medium text-foreground">Parsing your statement...</p>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full gradient-accent rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Detecting bank format · Extracting transactions · Auto-categorizing</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Result */}
      <AnimatePresence>
        {state === "success" && result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 border border-mint/20 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-mint/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-mint" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Import Successful!</p>
                <p className="text-xs text-muted-foreground">{result.message}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-secondary/50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-foreground">{result.total_found}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Found</p>
              </div>
              <div className="bg-mint/10 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-mint">{result.saved}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Saved</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-muted-foreground">{result.skipped}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Skipped</p>
              </div>
            </div>

            <div className="glass-card p-3 border-l-2 border-l-primary flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your AI Advisor now has context of all imported transactions. Go to <span className="text-primary font-medium">Analytics</span> to see your spending breakdown!
              </p>
            </div>

            <button onClick={reset} className="w-full py-2.5 rounded-xl bg-secondary text-sm font-medium text-foreground hover:bg-secondary/70 transition-colors">
              Upload Another Statement
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {(state === "error" || error) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-card p-4 border border-destructive/30 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-destructive">Upload Failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError("")}><X className="h-4 w-4 text-muted-foreground" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Button */}
      {file && state === "idle" && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleUpload}
          className="w-full gradient-accent text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Upload className="h-4 w-4" /> Import Transactions
        </motion.button>
      )}

      {/* How it works */}
      {state === "idle" && !file && (
        <motion.div variants={item} className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">How it works</p>
          </div>
          {[
            ["1", "Download your statement from your bank's app or website"],
            ["2", "Upload the PDF or Excel/CSV file here"],
            ["3", "Transactions are auto-detected, categorized & saved"],
            ["4", "AI Advisor uses your real data for smarter advice"],
          ].map(([num, text]) => (
            <div key={num} className="flex items-start gap-3">
              <span className="h-5 w-5 rounded-full gradient-accent text-[10px] font-bold text-primary-foreground flex items-center justify-center shrink-0">{num}</span>
              <p className="text-xs text-muted-foreground">{text}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Tips */}
      {state === "idle" && !file && (
        <motion.div variants={item} className="glass-card p-4 border-l-2 border-l-chart-amber space-y-2">
          <p className="text-xs font-semibold text-foreground">💡 Tips for best results</p>
          <ul className="space-y-1.5">
            {[
              "HDFC: Net Banking → Accounts → Last 6 months statement",
              "SBI: YONO app → e-Statement → Download PDF",
              "ICICI: iMobile → Accounts → Statement → Export CSV",
              "Axis: Mobile Banking → Accounts → Download Statement",
            ].map(tip => (
              <li key={tip} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span className="text-chart-amber mt-0.5">•</span>{tip}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
};

export default StatementUpload;
