import { MessageCircle, Mic, Send, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { respond, type ChatLang } from "@/lib/chatAgent";
import { submitRequest } from "@/lib/requests";
import { audit, useDB, useSession } from "@/lib/store";
import { btn, input } from "./AppShell";

interface SpeechResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechEventLike {
  resultIndex: number;
  results: SpeechResultLike[];
}
interface SpeechErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: SpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const SPEECH_ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "I don't have microphone access. Please allow microphone permission for this site in your browser settings and try again.",
  "service-not-allowed": "I don't have microphone access. Please allow microphone permission for this site in your browser settings and try again.",
  "no-speech": "I didn't hear anything. Try again and speak once the mic button turns red.",
  "audio-capture": "I can't find a microphone on this device.",
  "language-not-supported": "Voice input isn't available in this language here — retrying in English.",
  network: "Voice input needs an internet connection to work in this browser.",
  aborted: "",
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

interface Msg {
  from: "user" | "bot";
  text: string;
}

const LANGUAGES: { code: ChatLang; label: string; bcp47: string }[] = [
  { code: "en", label: "English", bcp47: "en-ZA" },
  { code: "af", label: "Afrikaans", bcp47: "af-ZA" },
  { code: "zu", label: "isiZulu", bcp47: "zu-ZA" },
  { code: "xh", label: "isiXhosa", bcp47: "xh-ZA" },
];

function bcp47For(lang: ChatLang): string {
  return LANGUAGES.find((l) => l.code === lang)?.bcp47 ?? "en-ZA";
}

function speak(text: string, lang: ChatLang) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = bcp47For(lang);
  window.speechSynthesis.speak(utterance);
}

export function ChatAgent() {
  const db = useDB();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<ChatLang>("en");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (open && messages.length === 0 && session) {
      const greeting = respond("", { db, session, lang }).text;
      setMessages([{ from: "bot", text: greeting }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  if (!session || session.role !== "client") return null;

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { from: "user", text: trimmed }]);
    setDraft("");
    const reply = respond(trimmed, { db, session, lang });
    setMessages((m) => [...m, { from: "bot", text: reply.text }]);
    if (voiceOut) speak(reply.text, lang);
    if (reply.escalate) {
      const client = db.clients.find((c) => c.id === session.userId);
      submitRequest({
        clientId: session.userId,
        adviserId: client?.adviser_id ?? 1,
        type: "consultation_request",
        details: { preferred_date: "", topic: `Escalated from AI chat: "${trimmed}"` },
        stepUpVerified: false,
      });
      audit("chat_escalated", "session", { message: trimmed });
    }
  };

  const startRecognition = (bcp47: string, retryOnUnsupportedLang: boolean) => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setMessages((m) => [...m, { from: "bot", text: "Voice input isn't supported in this browser." }]);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = bcp47;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (last) setDraft(last[0].transcript);
    };
    recognition.onerror = (e) => {
      if (e.error === "language-not-supported" && retryOnUnsupportedLang) {
        setMessages((m) => [...m, { from: "bot", text: SPEECH_ERROR_MESSAGES[e.error]! }]);
        startRecognition("en-ZA", false);
        return;
      }
      const msg = SPEECH_ERROR_MESSAGES[e.error];
      if (msg) setMessages((m) => [...m, { from: "bot", text: msg }]);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    setDraft("");
    startRecognition(bcp47For(lang), true);
  };

  return (
    <div className="fixed bottom-24 right-4 z-40">
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-border p-3">
            <p className="text-sm font-bold">Royal Square Assistant</p>
            <div className="flex items-center gap-2">
              <select
                className="rounded-md border border-input bg-card px-1 py-1 text-xs"
                value={lang}
                onChange={(e) => setLang(e.target.value as ChatLang)}
                aria-label="Assistant language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setVoiceOut((v) => !v);
                  if (voiceOut) window.speechSynthesis?.cancel();
                }}
                className={"text-muted-foreground hover:text-foreground " + (voiceOut ? "text-primary" : "")}
                aria-label={voiceOut ? "Turn off spoken replies" : "Turn on spoken replies"}
                title={voiceOut ? "Spoken replies on" : "Spoken replies off"}
              >
                {voiceOut ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close assistant">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  "max-w-[85%] rounded-md px-3 py-2 text-sm font-medium " +
                  (m.from === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")
                }
              >
                {m.text}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="flex items-center gap-2 border-t border-border p-3">
            <button
              type="button"
              onClick={toggleVoice}
              className={"shrink-0 rounded-md border border-border p-2 " + (listening ? "animate-pulse bg-danger/15 text-danger" : "hover:bg-muted")}
              title={listening ? "Stop voice input" : "Voice input"}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
            >
              <Mic className="h-4 w-4" />
            </button>
            <input
              className={input + " flex-1 py-2 text-sm"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send(draft);
              }}
              placeholder={listening ? "Listening…" : "Ask about claims, reminders…"}
            />
            <button onClick={() => send(draft)} className={btn + " shrink-0 px-3 py-2"} aria-label="Send message">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
        aria-label="Open assistant chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
