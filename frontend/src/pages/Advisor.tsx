import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { chatApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

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
            content: `Hey ${user?.name?.split(" ")[0] || "there"}! 👋 I'm your AI Financial Advisor powered by Gemini. Ask me anything about your finances!`,
            created_at: new Date().toISOString(),
          }]);
        } else {
          setMessages(data);
        }
      } catch {
        setMessages([{
          id: 0,
          role: "assistant",
          content: "Hi! I'm your AI Financial Advisor. How can I help you today?",
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
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: "Sorry, I couldn't connect to the AI service. Please try again.", created_at: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    await chatApi.clearHistory();
    setMessages([{ id: 0, role: "assistant", content: "Chat history cleared. How can I help you?", created_at: new Date().toISOString() }]);
  };

  if (initializing) return (
    <div className="flex h-[calc(100dvh-72px)] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-72px)] max-w-md mx-auto">
      <div className="px-4 pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">AI Advisor</h1>
          <p className="text-xs text-muted-foreground">Powered by Gemini · Context-aware</p>
        </div>
        <button onClick={handleClearHistory} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors">
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="h-7 w-7 rounded-full gradient-accent flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
              <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "gradient-accent text-primary-foreground rounded-br-md" : "glass-card text-foreground rounded-bl-md"}`}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
            <div className="h-7 w-7 rounded-full gradient-accent flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="glass-card px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {messages.length <= 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-2 mt-2">
            {suggestedPrompts.map((p) => (
              <button key={p} onClick={() => handleSend(p)} className="text-[11px] px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors">{p}</button>
            ))}
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 pb-4 pt-2 border-t border-border/40">
        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Ask about your finances..." className="bg-secondary border-border/50 text-foreground text-xs" disabled={loading} />
          <button onClick={() => handleSend()} disabled={loading || !input.trim()} className="h-10 w-10 rounded-xl gradient-accent flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity disabled:opacity-50">
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
