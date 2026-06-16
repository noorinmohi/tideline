import React, { useState, useEffect, useRef } from "react";
import { BookOpen, Target, Plus, Check, Trash2, Sparkles, Loader2, ChevronDown, ChevronUp, Wind, Send, RefreshCw, Bookmark } from "lucide-react";
import { callClaude } from "./api.js";
import { loadKey, saveKey } from "./storage.js";

// ── Design tokens ───────────────────────────────────────────────
const C = {
  bg: "#F4F1EB",
  paper: "#FBFAF6",
  ink: "#312E2A",
  inkSoft: "#6E6A62",
  inkFaint: "#9A968C",
  line: "#E5DFD3",
  clay: "#B5654A",
  clayDeep: "#9A5038",
  teal: "#3F756B",
  tealSoft: "#E6EFEB",
  claySoft: "#F3E7E0",
  shadow: "0 1px 2px rgba(49,46,42,0.04), 0 8px 24px rgba(49,46,42,0.06)",
};

const SERIF = "'Fraunces', Georgia, serif";
const SANS = "'Inter', -apple-system, system-ui, sans-serif";

const MOODS = [
  { key: "calm", label: "Calm", c1: "#A9C7C0", c2: "#CFE0DA" },
  { key: "content", label: "Content", c1: "#E3C98B", c2: "#F0E0B5" },
  { key: "hopeful", label: "Hopeful", c1: "#E8B98F", c2: "#F4D9BE" },
  { key: "tired", label: "Tired", c1: "#B7B2C4", c2: "#D8D4E0" },
  { key: "anxious", label: "Anxious", c1: "#C9A98F", c2: "#E0CBB6" },
  { key: "low", label: "Low", c1: "#9FA9BC", c2: "#C4CCD8" },
  { key: "frustrated", label: "Frustrated", c1: "#C98F8A", c2: "#E3BDB8" },
  { key: "numb", label: "Numb", c1: "#C2C3BE", c2: "#DAD9D3" },
];
const moodOf = (k) => MOODS.find((m) => m.key === k);

// ── Companion prompts ───────────────────────────────────────────
const REFLECT_SYSTEM = `You are a warm, grounded journaling companion having a gentle, ongoing reflective conversation inside a private journaling app. You help the person feel heard and explore their own thoughts — you do not fix, diagnose, or advise.

In every reply:
- Keep it short: 2–4 sentences, like a thoughtful friend, not a therapist's monologue.
- Reflect the core feeling you notice in plain human language. Name it gently, without exaggerating or dwelling on the negative.
- Validate that it makes sense, without judging it good or bad.
- End with exactly ONE open, gentle question that invites them to notice or explore a little more — never a list of questions.
- Build naturally on what they said earlier in the conversation; don't repeat yourself or re-ask what they've answered.
- Do NOT diagnose, label conditions, or give medical/clinical advice, and do not tell them what to do.
- Warm, natural tone. No clinical jargon, no toxic positivity, no platitudes.
- If anything suggests the person may be in crisis, thinking about harming themselves, or in danger: gently and briefly encourage them to reach out to someone they trust or a professional, and note that immediate support is available (in the US, call or text 988; otherwise local emergency services). Stay caring and human, and still acknowledge their feelings.
- Never imply you replace human connection or professional care.`;

const STEPS_SYSTEM = `You are a supportive goal coach. Break the user's goal into 3–5 small, concrete, achievable first steps. Keep each step to one short line, action-first, encouraging but not preachy. Return ONLY the steps, one per line, no numbering, no extra commentary, no markdown.`;

const WRAPUP_SYSTEM = `You are helping someone gently close out a journaling reflection. You'll receive the full back-and-forth of one reflection between "Me" (the person) and "Companion" (you, earlier). Write a brief takeaway they can keep.

- 1–3 short sentences, in second person ("you").
- Name the core feeling or realization they reached, and any gentle intention or next step THEY expressed — only if they actually said it. Never invent one.
- Do NOT add advice, instructions, diagnoses, or new suggestions they didn't raise.
- Warm and plain. Affirming without being saccharine. No clichés or platitudes.
- Return only the takeaway text — no preamble, no quotation marks.`;

// ── Local helpers ───────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// ════════════════════════════════════════════════════════════════
export default function ReflectJournal() {
  const [view, setView] = useState("journal");
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState([]);
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    (async () => {
      const raw = await loadKey("journal:entries", []);
      // Migrate older {text, reflection} entries into message threads
      const migrated = raw.map((e) =>
        e.messages
          ? e
          : {
              id: e.id, mood: e.mood, createdAt: e.createdAt,
              messages: [
                { role: "user", content: e.text || "" },
                ...(e.reflection ? [{ role: "assistant", content: e.reflection }] : []),
              ],
            }
      );
      setEntries(migrated);
      setGoals(await loadKey("journal:goals", []));
      setReady(true);
    })();
  }, []);

  const updateEntries = (next) => {
    setEntries((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      saveKey("journal:entries", resolved);
      return resolved;
    });
  };
  const updateGoals = (next) => {
    setGoals((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      saveKey("journal:goals", resolved);
      return resolved;
    });
  };

  return (
    <div style={{ minHeight: "100%", background: C.bg, fontFamily: SANS, color: C.ink }}>
      <style>{`
        * { box-sizing: border-box; }
        textarea, input, button { font-family: inherit; }
        textarea:focus, input:focus { outline: 2px solid ${C.teal}; outline-offset: 1px; }
        button:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 2px; }
        @keyframes breathe { 0%,100%{ transform: scale(1); } 50%{ transform: scale(1.06); } }
        @keyframes fadeUp { from{ opacity:0; transform: translateY(6px);} to{opacity:1; transform:none;} }
        .fade { animation: fadeUp .4s ease both; }
        @media (prefers-reduced-motion: reduce){ .orb{ animation:none !important; } .fade{ animation:none !important; } }
      `}</style>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 80px" }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div className="orb" style={{
              width: 34, height: 34, borderRadius: "50%",
              background: `radial-gradient(circle at 32% 30%, #F0E0B5, ${C.clay})`,
              boxShadow: "inset 0 0 8px rgba(255,255,255,.4)", animation: "breathe 6s ease-in-out infinite",
            }} />
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, lineHeight: 1 }}>Tideline</div>
              <div style={{ fontSize: 12, color: C.inkFaint, marginTop: 3 }}>a place to notice and grow</div>
            </div>
          </div>
          <nav style={{ display: "flex", gap: 4, background: C.paper, padding: 4, borderRadius: 12, border: `1px solid ${C.line}` }}>
            <Tab active={view === "journal"} onClick={() => setView("journal")} icon={<BookOpen size={15} />} label="Journal" />
            <Tab active={view === "goals"} onClick={() => setView("goals")} icon={<Target size={15} />} label="Goals" />
          </nav>
        </header>

        {!ready ? (
          <div style={{ textAlign: "center", padding: 60, color: C.inkFaint }}>
            <Loader2 size={20} className="orb" style={{ animation: "breathe 1.5s linear infinite" }} /> Loading your space…
          </div>
        ) : view === "journal" ? (
          <JournalView entries={entries} setEntries={updateEntries} goals={goals} />
        ) : (
          <GoalsView goals={goals} setGoals={updateGoals} />
        )}

        <footer style={{ marginTop: 40, paddingTop: 18, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.inkFaint, lineHeight: 1.6 }}>
          This is a companion for reflection, not a substitute for professional care. If you're in crisis or thinking about harming yourself, please reach out — in the US call or text <strong style={{ color: C.inkSoft }}>988</strong>, or contact local emergency services.
        </footer>
      </div>
    </div>
  );
}

function Tab({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer",
      padding: "7px 13px", borderRadius: 9, fontSize: 13.5, fontWeight: 500,
      background: active ? C.ink : "transparent", color: active ? C.paper : C.inkSoft,
      transition: "all .15s",
    }}>
      {icon}{label}
    </button>
  );
}

// ── Journal ─────────────────────────────────────────────────────
function JournalView({ entries, setEntries, goals }) {
  const [text, setText] = useState("");
  const [mood, setMood] = useState(null);
  const [generating, setGenerating] = useState(() => new Set()); // entry ids awaiting a reply
  const [summarizing, setSummarizing] = useState(() => new Set()); // entry ids being wrapped up
  const taRef = useRef(null);

  // Give the companion gentle awareness of the goals the person is tracking,
  // so it can connect feelings to what they're working toward — without nagging.
  const reflectSystem = () => {
    if (!goals || goals.length === 0) return REFLECT_SYSTEM;
    const lines = goals.map((g) => {
      if (g.done) return `- ${g.title} (completed)`;
      const prog = g.steps && g.steps.length ? ` — ${g.steps.filter((s) => s.done).length}/${g.steps.length} steps done` : "";
      return `- ${g.title}${g.why ? ` (because: ${g.why})` : ""}${prog}`;
    });
    return `${REFLECT_SYSTEM}

--- The person's current goals, for context ---
${lines.join("\n")}

Guidance on these goals: Only bring a goal up if the entry naturally connects to it — to gently acknowledge progress, encourage, or help them notice a link between how they feel and what they're working toward. Never nag, pressure, guilt-trip, or grade them on progress, and never make them feel behind. If the entry has nothing to do with their goals, don't mention them at all.`;
  };

  // Generate the assistant's reply for a thread that currently ends with a
  // user message. On success, append it. On failure, leave the thread
  // ending with the user turn so the card can offer a retry.
  const generate = async (entryId, history) => {
    setGenerating((s) => new Set(s).add(entryId));
    try {
      const reply = await callClaude(reflectSystem(), history);
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, messages: [...e.messages, { role: "assistant", content: reply }] } : e))
      );
    } catch {
      /* leave awaiting → card shows retry */
    } finally {
      setGenerating((s) => { const n = new Set(s); n.delete(entryId); return n; });
    }
  };

  const save = () => {
    if (!text.trim()) return;
    const messages = [{ role: "user", content: text.trim() }];
    const entry = { id: uid(), mood, createdAt: Date.now(), messages };
    setEntries([entry, ...entries]); // saved right away, before the reflection
    setText(""); setMood(null);
    taRef.current && taRef.current.blur();
    generate(entry.id, messages);
  };

  const remove = (id) => setEntries(entries.filter((e) => e.id !== id));

  const reply = (entryId, replyText) => {
    const target = entries.find((e) => e.id === entryId);
    if (!target) return;
    const history = [...target.messages, { role: "user", content: replyText }];
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, messages: history } : e)));
    generate(entryId, history);
  };

  const retry = (entryId) => {
    const target = entries.find((e) => e.id === entryId);
    if (target) generate(entryId, target.messages);
  };

  const summarize = async (entryId) => {
    const target = entries.find((e) => e.id === entryId);
    if (!target) return;
    setSummarizing((s) => new Set(s).add(entryId));
    try {
      const transcript = target.messages
        .map((mm) => `${mm.role === "user" ? "Me" : "Companion"}: ${mm.content}`)
        .join("\n\n");
      const takeaway = await callClaude(WRAPUP_SYSTEM, [{ role: "user", content: `Here is my reflection:\n\n${transcript}` }]);
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, takeaway } : e)));
    } catch {
      /* leave no takeaway → the wrap-up button stays so they can retry */
    } finally {
      setSummarizing((s) => { const n = new Set(s); n.delete(entryId); return n; });
    }
  };

  const activeMood = mood ? moodOf(mood) : null;

  return (
    <div className="fade">
      {/* Composer */}
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, boxShadow: C.shadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
            background: activeMood
              ? `radial-gradient(circle at 32% 30%, ${activeMood.c2}, ${activeMood.c1})`
              : `radial-gradient(circle at 32% 30%, #ECE6DB, #D6CFC0)`,
            transition: "background .4s",
          }} />
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500 }}>How are you, right now?</div>
            <div style={{ fontSize: 12.5, color: C.inkFaint }}>Write freely. Nothing here is graded.</div>
          </div>
        </div>

        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Today I've been feeling…"
          rows={5}
          style={{
            width: "100%", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px",
            fontSize: 15, lineHeight: 1.6, resize: "vertical", background: "#fff", color: C.ink,
          }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, margin: "14px 0 4px" }}>
          {MOODS.map((m) => (
            <button key={m.key} onClick={() => setMood(mood === m.key ? null : m.key)} style={{
              display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
              padding: "6px 12px 6px 8px", borderRadius: 20, fontSize: 13,
              border: `1px solid ${mood === m.key ? C.ink : C.line}`,
              background: mood === m.key ? C.ink : "#fff",
              color: mood === m.key ? C.paper : C.inkSoft, transition: "all .12s",
            }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: `linear-gradient(135deg, ${m.c2}, ${m.c1})` }} />
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={save} disabled={!text.trim()} style={{
            display: "flex", alignItems: "center", gap: 7, border: "none", cursor: text.trim() ? "pointer" : "default",
            padding: "10px 18px", borderRadius: 11, fontSize: 14, fontWeight: 500,
            background: text.trim() ? C.clay : "#E2DDD3", color: "#fff", transition: "all .15s",
          }}>
            <Sparkles size={15} /> Save & reflect
          </button>
        </div>
      </div>

      {/* Timeline */}
      {entries.length === 0 ? (
        <div style={{ textAlign: "center", color: C.inkFaint, padding: "46px 20px", fontSize: 14 }}>
          <Wind size={26} style={{ opacity: .5, marginBottom: 8 }} /><br />
          Your entries will gather here, like a tideline marking what's passed through.
        </div>
      ) : (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 12.5, color: C.inkFaint, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14, paddingLeft: 2 }}>
            Your thread · {entries.length}
          </div>
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} onDelete={() => remove(e.id)} onReply={reply} onRetry={retry} onWrapUp={summarize} generating={generating.has(e.id)} summarizing={summarizing.has(e.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function EntryCard({ entry, onDelete, onReply, onRetry, onWrapUp, generating, summarizing }) {
  const [openBody, setOpenBody] = useState(false);
  const [draft, setDraft] = useState("");
  const m = entry.mood ? moodOf(entry.mood) : null;

  const msgs = entry.messages || [];
  const first = msgs[0]?.content || "";
  const rest = msgs.slice(1); // alternating assistant / user follow-ups
  const longFirst = first.length > 160;
  const firstShown = longFirst && !openBody ? first.slice(0, 160) + "…" : first;

  // The thread is "awaiting" a reply when its last message is from the user:
  // either a reflection is in flight (generating) or the last attempt failed.
  const awaiting = msgs.length > 0 && msgs[msgs.length - 1].role === "user";
  const failed = awaiting && !generating;
  // Wrap-up is offered once there's at least one reflection and the thread is at rest.
  const canWrap = !awaiting && msgs.some((mm) => mm.role === "assistant");

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    onReply(entry.id, t);
  };

  return (
    <div className="fade" style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 12, boxShadow: C.shadow }}>
      {/* meta */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          {m && <span style={{ width: 11, height: 11, borderRadius: "50%", background: `linear-gradient(135deg, ${m.c2}, ${m.c1})` }} />}
          <span style={{ fontSize: 12.5, color: C.inkFaint }}>{fmtDate(entry.createdAt)}{m ? ` · ${m.label}` : ""}</span>
        </div>
        <button onClick={onDelete} aria-label="Delete entry" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.inkFaint, padding: 4 }}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* original entry */}
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: C.ink, whiteSpace: "pre-wrap" }}>{firstShown}</p>
      {longFirst && (
        <button onClick={() => setOpenBody(!openBody)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.teal, fontSize: 13, padding: "6px 0 0", display: "flex", alignItems: "center", gap: 3 }}>
          {openBody ? <>Less <ChevronUp size={13} /></> : <>More <ChevronDown size={13} /></>}
        </button>
      )}

      {/* conversation thread */}
      {(rest.length > 0 || awaiting) && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${C.line}`, display: "flex", flexDirection: "column", gap: 14 }}>
          {rest.map((msg, i) =>
            msg.role === "assistant" ? <Reflection key={i} text={msg.content} /> : <UserBubble key={i} text={msg.content} />
          )}
          {generating && <Reflection thinking />}
          {failed && <RetryRow onRetry={() => onRetry(entry.id)} />}
        </div>
      )}

      {/* takeaway / wrap-up */}
      {entry.takeaway ? (
        <div style={{ marginTop: 14 }}>
          <Takeaway text={entry.takeaway} busy={summarizing} onRedo={() => onWrapUp(entry.id)} />
        </div>
      ) : canWrap ? (
        <button onClick={() => onWrapUp(entry.id)} disabled={summarizing} style={{
          display: "flex", alignItems: "center", gap: 7, marginTop: 14, border: `1px solid ${C.line}`,
          background: C.tealSoft, cursor: summarizing ? "default" : "pointer", padding: "8px 13px",
          borderRadius: 10, fontSize: 13, fontWeight: 500, color: C.teal,
        }}>
          {summarizing
            ? <><Loader2 size={14} style={{ animation: "breathe 1.2s linear infinite" }} /> Summarizing…</>
            : <><Bookmark size={14} /> Wrap up this reflection</>}
        </button>
      ) : null}

      {/* reply box — hidden while a turn is awaiting a reply */}
      {!awaiting && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Reply to keep reflecting…"
            style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 22, padding: "9px 15px", fontSize: 14, background: "#fff", color: C.ink }}
          />
          <button onClick={send} disabled={!draft.trim()} aria-label="Send reply" style={{
            width: 38, height: 38, flexShrink: 0, borderRadius: "50%", border: "none",
            cursor: draft.trim() ? "pointer" : "default",
            background: draft.trim() ? C.clay : "#E2DDD3", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s",
          }}>
            <Send size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function Takeaway({ text, busy, onRedo }) {
  return (
    <div style={{ background: C.tealSoft, border: "1px solid #D4E2DC", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: C.teal, fontWeight: 600 }}>
          <Bookmark size={12} /> Takeaway
        </span>
        <button onClick={onRedo} disabled={busy} aria-label="Regenerate takeaway" style={{ border: "none", background: "transparent", cursor: busy ? "default" : "pointer", color: C.teal, padding: 2, display: "flex" }}>
          {busy ? <Loader2 size={13} style={{ animation: "breathe 1.2s linear infinite" }} /> : <RefreshCw size={12} />}
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.ink }}>{text}</p>
    </div>
  );
}

function RetryRow({ onRetry }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: C.inkSoft }}>
      <span>Couldn't reach your companion.</span>
      <button onClick={onRetry} style={{
        display: "flex", alignItems: "center", gap: 5, border: `1px solid ${C.line}`, background: "#fff",
        cursor: "pointer", padding: "5px 11px", borderRadius: 9, fontSize: 13, fontWeight: 500, color: C.teal,
      }}>
        <RefreshCw size={13} /> Try again
      </button>
    </div>
  );
}

function Reflection({ text, thinking }) {
  return (
    <div style={{ display: "flex", gap: 11 }}>
      <div style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%", background: `radial-gradient(circle at 32% 30%, #F0E0B5, ${C.clay})` }} />
      {thinking ? (
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.inkFaint, fontStyle: "italic", fontFamily: SERIF, fontSize: 14.5 }}>
          <Loader2 size={13} style={{ animation: "breathe 1.2s linear infinite" }} /> reflecting…
        </span>
      ) : (
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.6, color: C.inkSoft, fontStyle: "italic" }}>{text}</p>
      )}
    </div>
  );
}

function UserBubble({ text }) {
  return (
    <div style={{ alignSelf: "flex-end", maxWidth: "86%", background: C.claySoft, border: `1px solid ${C.line}`, borderRadius: "14px 14px 4px 14px", padding: "9px 13px" }}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.ink, whiteSpace: "pre-wrap" }}>{text}</p>
    </div>
  );
}

// ── Goals ───────────────────────────────────────────────────────
function GoalsView({ goals, setGoals }) {
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const add = () => {
    if (!title.trim()) return;
    const g = { id: uid(), title: title.trim(), why: why.trim(), steps: [], done: false, createdAt: Date.now() };
    setGoals([g, ...goals]);
    setTitle(""); setWhy(""); setAdding(false);
  };
  const update = (id, patch) => setGoals(goals.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const remove = (id) => setGoals(goals.filter((g) => g.id !== id));

  const suggestSteps = async (g) => {
    setBusyId(g.id);
    try {
      const out = await callClaude(STEPS_SYSTEM, [{ role: "user", content: `Goal: ${g.title}${g.why ? `\nWhy it matters: ${g.why}` : ""}` }]);
      const steps = out.split("\n").map((s) => s.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean).map((t) => ({ id: uid(), text: t, done: false }));
      update(g.id, { steps });
    } catch { /* ignore */ }
    setBusyId(null);
  };

  const toggleStep = (g, sid) =>
    update(g.id, { steps: g.steps.map((s) => (s.id === sid ? { ...s, done: !s.done } : s)) });

  return (
    <div className="fade">
      {!adding ? (
        <button onClick={() => setAdding(true)} style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center",
          border: `1.5px dashed ${C.line}`, background: C.paper, cursor: "pointer",
          padding: "14px", borderRadius: 16, fontSize: 14, fontWeight: 500, color: C.teal,
        }}>
          <Plus size={16} /> Set a new goal
        </button>
      ) : (
        <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, boxShadow: C.shadow }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What do you want to work toward?"
            style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 15, marginBottom: 9, background: "#fff" }} />
          <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why does it matter to you? (optional)"
            style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, marginBottom: 12, background: "#fff" }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setAdding(false); setTitle(""); setWhy(""); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.inkSoft, fontSize: 14, padding: "9px 14px" }}>Cancel</button>
            <button onClick={add} disabled={!title.trim()} style={{ border: "none", cursor: title.trim() ? "pointer" : "default", background: title.trim() ? C.teal : "#E2DDD3", color: "#fff", fontSize: 14, fontWeight: 500, padding: "9px 16px", borderRadius: 10 }}>Add goal</button>
          </div>
        </div>
      )}

      {goals.length === 0 && !adding && (
        <div style={{ textAlign: "center", color: C.inkFaint, padding: "46px 20px", fontSize: 14 }}>
          <Target size={26} style={{ opacity: .5, marginBottom: 8 }} /><br />
          No goals yet. Start with one small thing you'd like to move toward.
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {goals.map((g) => {
          const done = g.steps.filter((s) => s.done).length;
          const pct = g.steps.length ? Math.round((done / g.steps.length) * 100) : (g.done ? 100 : 0);
          return (
            <div key={g.id} className="fade" style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 12, boxShadow: C.shadow, opacity: g.done ? 0.7 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <button onClick={() => update(g.id, { done: !g.done })} aria-label="Mark goal complete" style={{
                      width: 20, height: 20, flexShrink: 0, borderRadius: "50%", cursor: "pointer",
                      border: `1.5px solid ${g.done ? C.teal : C.inkFaint}`, background: g.done ? C.teal : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                    }}>{g.done && <Check size={12} color="#fff" />}</button>
                    <span style={{ fontFamily: SERIF, fontSize: 16.5, fontWeight: 500, textDecoration: g.done ? "line-through" : "none" }}>{g.title}</span>
                  </div>
                  {g.why && <div style={{ fontSize: 13, color: C.inkFaint, marginTop: 5, marginLeft: 29 }}>{g.why}</div>}
                </div>
                <button onClick={() => remove(g.id)} aria-label="Delete goal" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.inkFaint, padding: 4 }}><Trash2 size={14} /></button>
              </div>

              {g.steps.length > 0 && (
                <>
                  <div style={{ height: 5, background: C.line, borderRadius: 4, margin: "14px 0 12px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: C.teal, borderRadius: 4, transition: "width .3s" }} />
                  </div>
                  {g.steps.map((s) => (
                    <button key={s.id} onClick={() => toggleStep(g, s.id)} style={{
                      display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                      border: "none", background: "transparent", cursor: "pointer", padding: "6px 0", fontSize: 14, color: C.ink,
                    }}>
                      <span style={{ width: 17, height: 17, flexShrink: 0, borderRadius: 5, border: `1.5px solid ${s.done ? C.teal : C.inkFaint}`, background: s.done ? C.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {s.done && <Check size={11} color="#fff" />}
                      </span>
                      <span style={{ color: s.done ? C.inkFaint : C.ink, textDecoration: s.done ? "line-through" : "none" }}>{s.text}</span>
                    </button>
                  ))}
                </>
              )}

              {g.steps.length === 0 && !g.done && (
                <button onClick={() => suggestSteps(g)} disabled={busyId === g.id} style={{
                  display: "flex", alignItems: "center", gap: 7, marginTop: 13, border: `1px solid ${C.line}`,
                  background: C.tealSoft, cursor: "pointer", padding: "8px 13px", borderRadius: 10, fontSize: 13, fontWeight: 500, color: C.teal,
                }}>
                  {busyId === g.id ? <><Loader2 size={14} style={{ animation: "breathe 1.2s linear infinite" }} /> Thinking…</> : <><Sparkles size={14} /> Break into steps</>}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
