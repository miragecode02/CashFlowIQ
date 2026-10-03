import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Sparkles, RotateCcw } from "lucide-react";
import { chatApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { EASE } from "@/lib/design";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const suggestedPrompts = [
  "Can I afford a ₹80k phone?",
  "Why am I not saving money?",
  "Suggest a better monthly budget",
  "Where am I overspending?",
];

export default function Advisor() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data } = await chatApi.history(20);
        if (data.length === 0) {
          setMessages([{
            id: 0,
            role: "assistant",
            content: `Hi ${user?.name?.split(" ")[0] || "there"}. I can see your transactions and fixed costs. Ask me anything about your money.`,
            created_at: new Date().toISOString(),
          }]);
        } else {
          setMessages(data);
        }
      } catch {
        setMessages([{
          id: 0,
          role: "assistant",
          content: "Hi. I'm your AI financial advisor. What would you like to know?",
          created_at: new Date().toISOString(),
        }]);
      } finally {
        setInitializing(false);
      }
    };
    loadHistory();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput("");
    const userMsg: Message = { id: Date.now(), role: "user", content: msg, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const { data } = await chatApi.send(msg);
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: data.reply, created_at: new Date().toISOString() }]);
    } catch {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: "I couldn't reach the AI service. Try again in a moment.", created_at: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    await chatApi.clearHistory();
    setMessages([{ id: 0, role: "assistant", content: "Conversation cleared. What would you like to look at?", created_at: new Date().toISOString() }]);
  };

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col lg:max-w-3xl lg:px-6">
      <header className="flex items-end justify-between px-4 pt-10 pb-4 lg:pt-12">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-none">Advisor</h1>
        </div>
        <button onClick={handleClearHistory} className="btn-ghost px-3 py-2 text-xs" aria-label="Clear conversation">
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pt-2 pb-4" aria-live="polite">
        {initializing ? (
          <div className="space-y-3" aria-busy="true">
            <div className="skeleton h-16 w-[75%] rounded-[1.25rem]" />
            <div className="skeleton ml-auto h-10 w-[55%] rounded-[1.25rem]" />
            <div className="skeleton h-24 w-[80%] rounded-[1.25rem]" />
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 12, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.5, ease: EASE }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" ? (
                  <div className="flex max-w-[88%] gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <div className="whitespace-pre-wrap rounded-[1.25rem] rounded-tl-md bg-card px-4 py-3 text-sm leading-relaxed text-foreground/90 ring-1 ring-inset ring-white/[0.06]">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-[1.25rem] rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                    {msg.content}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="rounded-[1.25rem] rounded-tl-md bg-card px-4 py-3.5 ring-1 ring-inset ring-white/[0.06]">
              <div className="flex gap-1" aria-label="Advisor is typing">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {!initializing && messages.length <= 1 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6, ease: EASE }}
            className="pt-4">
            <h2 className="mb-3 text-sm font-medium text-foreground/80">Try asking</h2>
            <div className="grid gap-2">
              {suggestedPrompts.map((p) => (
                <button key={p} onClick={() => handleSend(p)}
                  className="group flex items-center justify-between rounded-full bg-white/[0.03] px-5 py-3 text-left text-sm text-foreground/80 ring-1 ring-inset ring-white/[0.06] transition-all duration-300 ease-premium hover:bg-white/[0.06] hover:text-foreground active:scale-[0.99]">
                  {p}
                  <ArrowUp className="h-4 w-4 rotate-45 text-muted-foreground transition-transform duration-300 ease-premium group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer — sits above the floating nav */}
      <div className="px-4 pt-2 pb-[6.5rem] lg:pb-8">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2 rounded-full bg-card p-1.5 pl-5 ring-1 ring-inset ring-white/[0.08] transition-shadow duration-300 focus-within:ring-primary/40">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your finances…" aria-label="Message"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            disabled={loading} />
          <button type="submit" disabled={loading || !input.trim()} aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-300 ease-premium hover:brightness-105 active:scale-95 disabled:bg-white/[0.06] disabled:text-muted-foreground">
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
