// src/pages/patient/Diagnosis.jsx
//
// Enhanced for FYP testing of the Medibot agentic backend.
//
// What's new vs the previous version:
//   ✅ Stable session_id (persisted in localStorage) — no more cross-tab collision
//   ✅ Chat history persisted in localStorage — survives page reload
//   ✅ Dev panel showing: source, vectorstore used, questions asked,
//      RAG hit, diagnosis candidates, intent classification — so you can
//      SEE what your backend is deciding
//   ✅ Reset button — calls /reset on the backend, clears local state
//   ✅ Emergency styling — red bubble with alert icon for emergency intents
//   ✅ Different bubble colour per intent (encyclopedia / interview / diagnosis)
//   ✅ Loading indicator on send button, auto-scroll, auto-focus
//   ✅ Status indicator — green/red dot showing backend health (/status)
//   ✅ Specialty chip → routes to /find-doctors on click
//   ✅ Keyboard: Enter to send, Shift+Enter for new line
//
// The dev panel is hidden by default and toggles with a small button in
// the header — you can leave it on while testing and flip it off for demos.

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPaperPlane,
  FaRobot,
  FaStethoscope,
  FaHeadSideVirus,
  FaHeartbeat,
  FaTooth,
  FaRunning,
  FaExclamationTriangle,
  FaSyncAlt,
  FaBug,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaUserMd,
} from "react-icons/fa";

// ══════════════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════════════
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

const STORAGE_KEYS = {
  SESSION_ID: "medibot_session_id",
  MESSAGES: "medibot_chat_history",
};

// Generate / retrieve a stable session id so backend state survives reloads
// AND different tabs get different sessions.
function getOrCreateSessionId() {
  let sid = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, sid);
  }
  return sid;
}

// ══════════════════════════════════════════════════════════════
//  STYLES — matches your existing pages (soft clinical, #007bff primary)
// ══════════════════════════════════════════════════════════════
const styles = {
  page: {
    display: "flex",
    gap: "20px",
    maxWidth: "1400px",
    margin: "30px auto",
    padding: "0 20px",
    fontFamily: "'Segoe UI', sans-serif",
    alignItems: "flex-start",
  },
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "85vh",
    border: "1px solid #ddd",
    borderRadius: "12px",
    overflow: "hidden",
    backgroundColor: "white",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },

  // Header
  header: {
    padding: "16px 20px",
    backgroundColor: "#007bff",
    color: "white",
    display: "flex",
    alignItems: "center",
    gap: "15px",
  },
  headerIcon: {
    backgroundColor: "white",
    padding: "8px",
    borderRadius: "50%",
    color: "#007bff",
    display: "flex",
  },
  title: { margin: 0, fontSize: "1.1rem", fontWeight: 600 },
  subtitle: { margin: 0, fontSize: "0.8rem", opacity: 0.85 },
  headerRight: {
    marginLeft: "auto",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  statusDot: (ok) => ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    backgroundColor: ok ? "#28a745" : "#dc3545",
    boxShadow: ok
      ? "0 0 8px rgba(40,167,69,0.6)"
      : "0 0 8px rgba(220,53,69,0.6)",
  }),
  iconBtn: {
    background: "rgba(255,255,255,0.2)",
    border: "none",
    color: "white",
    padding: "6px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
  },

  // Chat area
  chatBox: {
    flex: 1,
    padding: "20px",
    overflowY: "auto",
    backgroundColor: "#f4f7f6",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  messageRow: (isBot) => ({
    display: "flex",
    justifyContent: isBot ? "flex-start" : "flex-end",
    alignItems: "flex-start",
    gap: "8px",
  }),
  botIcon: { marginTop: 5, color: "#007bff", flexShrink: 0 },

  // Bubbles — colour depends on "source" so you can eyeball what happened
  bubble: (msg) => {
    const isBot = msg.sender === "bot";
    const isEmergency = msg.source === "emergency";
    const isDiagnosis = msg.source === "diagnosis";
    const isEncyclopedia = msg.source === "encyclopedia_rag";

    let bg = "white";
    let fg = "#333";
    let border = "1px solid transparent";

    if (!isBot) {
      bg = "#007bff";
      fg = "white";
    } else if (isEmergency) {
      bg = "#fff5f5";
      fg = "#991b1b";
      border = "2px solid #dc3545";
    } else if (isDiagnosis) {
      bg = "#f0fdf4";
      fg = "#14532d";
      border = "1px solid #86efac";
    } else if (isEncyclopedia) {
      bg = "#eff6ff";
      fg = "#1e3a8a";
      border = "1px solid #93c5fd";
    }

    return {
      maxWidth: "75%",
      padding: "12px 16px",
      borderRadius: "12px",
      lineHeight: 1.55,
      fontSize: "15px",
      backgroundColor: bg,
      color: fg,
      border,
      borderTopLeftRadius: isBot ? 0 : 12,
      borderTopRightRadius: isBot ? 12 : 0,
      boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    };
  },

  // Tag shown above a bubble, telling you WHAT path the backend took
  sourceTag: (source) => {
    const map = {
      emergency: { label: "🚨 Emergency", bg: "#dc3545" },
      diagnosis: { label: "🩺 Final Diagnosis", bg: "#28a745" },
      symptom_interview: { label: "❓ Symptom Interview", bg: "#0ea5e9" },
      encyclopedia_rag: { label: "📚 db_faiss (Encyclopedia)", bg: "#6366f1" },
      doctor_referral: { label: "👨‍⚕️ Doctor Referral", bg: "#f59e0b" },
      greeting: { label: "👋 Greeting", bg: "#64748b" },
      general_chat: { label: "💬 General", bg: "#64748b" },
      error: { label: "⚠️ Error", bg: "#dc3545" },
      system: { label: "⚙️ System", bg: "#64748b" },
    };
    const m = map[source] || { label: source, bg: "#64748b" };
    return {
      display: "inline-block",
      fontSize: "10px",
      fontWeight: 700,
      letterSpacing: "0.5px",
      textTransform: "uppercase",
      padding: "3px 8px",
      borderRadius: 10,
      color: "white",
      backgroundColor: m.bg,
      marginBottom: 4,
      label: m.label,
    };
  },

  // Input area
  inputArea: {
    padding: "16px 20px",
    backgroundColor: "white",
    borderTop: "1px solid #eee",
  },
  quickChips: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    paddingBottom: 12,
    marginBottom: 6,
  },
  chip: {
    padding: "6px 12px",
    borderRadius: "20px",
    backgroundColor: "#e3f2fd",
    color: "#007bff",
    border: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontSize: "13px",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  inputRow: { display: "flex", gap: "10px" },
  input: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "25px",
    border: "1px solid #ddd",
    outline: "none",
    fontSize: "15px",
    resize: "none",
    fontFamily: "inherit",
  },
  sendBtn: (disabled) => ({
    width: 48,
    height: 48,
    borderRadius: "50%",
    backgroundColor: disabled ? "#a0c8f0" : "#007bff",
    color: "white",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }),

  // In-chat specialty button — the primary CTA after diagnosis or doctor request
  bookButton: {
    marginTop: 4,
    display: "inline-flex",
    alignItems: "center",
    padding: "11px 22px",
    backgroundColor: "#28a745",
    color: "white",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    boxShadow: "0 2px 6px rgba(40,167,69,0.25)",
    transition: "transform 0.15s, box-shadow 0.15s",
  },

  // Typing indicator
  typing: {
    color: "#94a3b8",
    fontSize: 13,
    marginLeft: 32,
    fontStyle: "italic",
  },

  // ─── DEV PANEL ─────────────────────────────────────────
  devPanel: {
    width: 320,
    height: "85vh",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    borderRadius: 12,
    padding: "16px",
    fontFamily: "'Menlo', 'Monaco', monospace",
    fontSize: 12,
    overflowY: "auto",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  },
  devHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid #334155",
  },
  devTitle: { fontSize: 13, fontWeight: 700, color: "#f1f5f9" },
  devSection: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: "#1e293b",
    borderRadius: 6,
    border: "1px solid #334155",
  },
  devLabel: {
    color: "#94a3b8",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 6,
    display: "block",
  },
  devValue: { color: "#e2e8f0", wordBreak: "break-all" },
  devKey: { color: "#60a5fa" },
  devOk: { color: "#4ade80" },
  devBad: { color: "#f87171" },
};

// ══════════════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════════════
function Diagnosis() {
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Stable session id (survives reload, unique per tab-group)
  const [sessionId] = useState(() => getOrCreateSessionId());

  // Messages — persisted
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      /* ignore */
    }
    return [
      {
        id: 1,
        sender: "bot",
        text: "Hello! I'm Medibot — your AI health assistant. Tell me what's on your mind, or pick a symptom below to start.",
        source: "greeting",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [backendOk, setBackendOk] = useState(null); // null = checking, true/false = known
  const [backendStatus, setBackendStatus] = useState(null);
  const [showDev, setShowDev] = useState(false);
  const [lastResponse, setLastResponse] = useState(null); // full raw backend response

  // ─── Persist messages on change ──────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    } catch (e) {
      /* quota probably */
    }
  }, [messages]);

  // ─── Auto-scroll to bottom ───────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ─── Auto-focus input on mount ───────────────────────────
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ─── Backend health check ────────────────────────────────
  const checkBackend = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBackendStatus(data);
      setBackendOk(true);
    } catch (e) {
      setBackendOk(false);
      setBackendStatus({ error: e.message });
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const id = setInterval(checkBackend, 30000); // re-check every 30s
    return () => clearInterval(id);
  }, [checkBackend]);

  // ─── Send a message ──────────────────────────────────────
  const handleSend = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || isTyping) return;

    // Add user message optimistically
    const userMsg = {
      id: Date.now(),
      sender: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const startedAt = performance.now();

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId, // 🟢 critical — ties to backend state
        }),
      });

      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      const data = await response.json();
      const elapsedMs = Math.round(performance.now() - startedAt);

      setLastResponse({ ...data, _elapsedMs: elapsedMs, _sentMessage: text });

      const botMsg = {
        id: Date.now() + 1,
        sender: "bot",
        text: data.text,
        source: data.source,
        specialty: data.specialty,
        specialty_link: data.specialty_link,
        show_specialty_button: data.show_specialty_button,
        vectorstore_used: data.vectorstore_used,
        questions_asked: data.questions_asked,
        diagnosis_complete: data.diagnosis_complete,
        rag_used: data.rag_used,
        candidates: data.candidates,
        doctors: data.doctors, // 🟢 NEW — array from doctors.csv
        doctor_count: data.doctor_count,
        city: data.city,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "bot",
          source: "error",
          text: `⚠️ Couldn't reach the backend. Is uvicorn running on ${API_BASE}?\n\nDetails: ${error.message}`,
        },
      ]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  // ─── Reset session (both frontend AND backend) ───────────
  const handleReset = async () => {
    if (!window.confirm("Clear this conversation and reset the session?"))
      return;
    try {
      await fetch(
        `${API_BASE}/reset?session_id=${encodeURIComponent(sessionId)}`,
        {
          method: "POST",
        },
      );
    } catch (e) {
      /* backend might be down; clear locally anyway */
    }

    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    setMessages([
      {
        id: 1,
        sender: "bot",
        text: "Conversation reset. How can I help you today?",
        source: "greeting",
      },
    ]);
    setLastResponse(null);
    inputRef.current?.focus();
  };

  // ─── Handle input keys (Enter=send, Shift+Enter=newline) ─
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  // ══════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div style={styles.page}>
      {/* ────────────── MAIN CHAT ────────────── */}
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>
            <FaRobot size={22} />
          </div>
          <div>
            <h2 style={styles.title}>AI Diagnosis Chat</h2>
            <p style={styles.subtitle}>
              Powered by Medibot · session {sessionId.slice(-6)}
            </p>
          </div>

          <div style={styles.headerRight}>
            <div
              style={styles.statusDot(backendOk)}
              title={backendOk ? "Backend OK" : "Backend unreachable"}
            />
            <button
              style={styles.iconBtn}
              onClick={() => setShowDev((v) => !v)}
              title="Toggle developer panel"
            >
              <FaBug /> {showDev ? "Hide" : "Dev"}
            </button>
            <button
              style={styles.iconBtn}
              onClick={handleReset}
              title="Reset conversation"
            >
              <FaSyncAlt /> Reset
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div style={styles.chatBox}>
          {messages.map((msg) => {
            const isBot = msg.sender === "bot";
            const tag =
              isBot && msg.source ? styles.sourceTag(msg.source) : null;

            return (
              <div key={msg.id} style={styles.messageRow(isBot)}>
                {isBot && <FaStethoscope style={styles.botIcon} />}

                <div>
                  {tag && (
                    <div>
                      <span style={tag}>{tag.label}</span>
                      {msg.vectorstore_used && (
                        <span
                          style={{
                            ...tag,
                            backgroundColor: "#334155",
                            marginLeft: 4,
                          }}
                        >
                          {msg.vectorstore_used}
                        </span>
                      )}
                      {typeof msg.questions_asked === "number" && (
                        <span
                          style={{
                            ...tag,
                            backgroundColor: "#334155",
                            marginLeft: 4,
                          }}
                        >
                          Q {msg.questions_asked}/4
                        </span>
                      )}
                    </div>
                  )}

                  <div style={styles.bubble(msg)}>
                    {msg.source === "emergency" && (
                      <FaExclamationTriangle
                        style={{ marginRight: 8, color: "#dc3545" }}
                      />
                    )}
                    {msg.text}

                    {/* Find {Specialty} button — the only doctor CTA */}
                    {msg.show_specialty_button && msg.specialty && (
                      <div style={{ marginTop: 12 }}>
                        <button
                          style={styles.bookButton}
                          onClick={() =>
                            navigate(
                              msg.specialty_link ||
                                `/find-doctors?specialty=${encodeURIComponent(msg.specialty)}${
                                  msg.city
                                    ? `&city=${encodeURIComponent(msg.city)}`
                                    : ""
                                }`,
                            )
                          }
                        >
                          <FaUserMd style={{ marginRight: 8 }} />
                          Find Best {msg.specialty}
                          {msg.city ? ` in ${msg.city}` : ""} →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isTyping && <div style={styles.typing}>Medibot is typing…</div>}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={styles.inputArea}>
          <div style={styles.quickChips}>
            <button
              style={styles.chip}
              onClick={() => handleSend("I have a severe headache")}
            >
              <FaHeadSideVirus /> Headache
            </button>
            <button
              style={styles.chip}
              onClick={() => handleSend("I've had a dry cough for a week")}
            >
              <FaStethoscope /> Cough
            </button>
            <button
              style={styles.chip}
              onClick={() => handleSend("My tooth hurts")}
            >
              <FaTooth /> Toothache
            </button>
            <button
              style={styles.chip}
              onClick={() => handleSend("My knee hurts when I walk")}
            >
              <FaRunning /> Joint Pain
            </button>
            <button
              style={styles.chip}
              onClick={() => handleSend("What is diabetes?")}
            >
              <FaInfoCircle /> Ask about diabetes
            </button>
          </div>

          <div style={styles.inputRow}>
            <textarea
              ref={inputRef}
              rows={1}
              style={styles.input}
              placeholder="Type your symptoms or question… (Shift+Enter for newline)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button
              style={styles.sendBtn(isTyping || !input.trim())}
              onClick={() => handleSend()}
              disabled={isTyping || !input.trim()}
            >
              <FaPaperPlane size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ────────────── DEV / TEST PANEL ────────────── */}
      {showDev && (
        <div style={styles.devPanel}>
          <div style={styles.devHeader}>
            <span style={styles.devTitle}>🔬 Backend Inspector</span>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>Live</span>
          </div>

          {/* Connection */}
          <div style={styles.devSection}>
            <span style={styles.devLabel}>Connection</span>
            <div style={styles.devValue}>
              URL: <span style={styles.devKey}>{API_BASE}</span>
              <br />
              Status:{" "}
              {backendOk === null ? (
                <span style={{ color: "#fbbf24" }}>checking…</span>
              ) : backendOk ? (
                <span style={styles.devOk}>
                  <FaCheckCircle /> ONLINE
                </span>
              ) : (
                <span style={styles.devBad}>
                  <FaTimesCircle /> OFFLINE
                </span>
              )}
              <br />
              Session: <span style={styles.devKey}>{sessionId}</span>
            </div>
          </div>

          {/* Backend capabilities */}
          {backendStatus && (
            <div style={styles.devSection}>
              <span style={styles.devLabel}>Backend Capabilities</span>
              <div style={styles.devValue}>
                {backendStatus.encyclopedia_rag !== undefined && (
                  <>
                    db_faiss (Encyclopedia):{" "}
                    {backendStatus.encyclopedia_rag ? (
                      <span style={styles.devOk}>✓</span>
                    ) : (
                      <span style={styles.devBad}>✗</span>
                    )}
                    <br />
                  </>
                )}
                {backendStatus.disease_symptoms_rag !== undefined && (
                  <>
                    disease_faiss (Symptoms):{" "}
                    {backendStatus.disease_symptoms_rag ? (
                      <span style={styles.devOk}>✓</span>
                    ) : (
                      <span style={styles.devBad}>✗</span>
                    )}
                    <br />
                  </>
                )}
                {backendStatus.ml_model !== undefined && (
                  <>
                    XGBoost model:{" "}
                    {backendStatus.ml_model ? (
                      <span style={styles.devOk}>✓</span>
                    ) : (
                      <span style={styles.devBad}>✗</span>
                    )}
                    <br />
                  </>
                )}
                {backendStatus.csv_data !== undefined && (
                  <>
                    Clinical CSVs:{" "}
                    {backendStatus.csv_data ? (
                      <span style={styles.devOk}>✓</span>
                    ) : (
                      <span style={styles.devBad}>✗</span>
                    )}
                    <br />
                  </>
                )}
                {backendStatus.router_model && (
                  <>
                    Router:{" "}
                    <span style={styles.devKey}>
                      {backendStatus.router_model}
                    </span>
                    <br />
                  </>
                )}
                {backendStatus.conversation_model && (
                  <>
                    Convo:{" "}
                    <span style={styles.devKey}>
                      {backendStatus.conversation_model}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Last response */}
          {lastResponse && (
            <div style={styles.devSection}>
              <span style={styles.devLabel}>Last /chat response</span>
              <div style={styles.devValue}>
                <div>
                  sent:{" "}
                  <span style={styles.devKey}>
                    "{lastResponse._sentMessage?.slice(0, 40)}…"
                  </span>
                </div>
                <div>
                  latency:{" "}
                  <span style={styles.devKey}>
                    {lastResponse._elapsedMs} ms
                  </span>
                </div>
                <div>
                  source:{" "}
                  <span style={styles.devKey}>
                    {lastResponse.source || "?"}
                  </span>
                </div>
                {lastResponse.vectorstore_used && (
                  <div>
                    vectorstore:{" "}
                    <span style={styles.devKey}>
                      {lastResponse.vectorstore_used}
                    </span>
                  </div>
                )}
                {typeof lastResponse.questions_asked === "number" && (
                  <div>
                    questions_asked:{" "}
                    <span style={styles.devKey}>
                      {lastResponse.questions_asked}
                    </span>
                  </div>
                )}
                {lastResponse.specialty && (
                  <div>
                    specialty:{" "}
                    <span style={styles.devKey}>{lastResponse.specialty}</span>
                  </div>
                )}
                {lastResponse.rag_used !== undefined && (
                  <div>
                    rag_used:{" "}
                    <span style={styles.devKey}>
                      {String(lastResponse.rag_used)}
                    </span>
                  </div>
                )}
                {lastResponse.candidates &&
                  lastResponse.candidates.length > 0 && (
                    <div>
                      candidates:{" "}
                      <span style={styles.devKey}>
                        {lastResponse.candidates.join(", ")}
                      </span>
                    </div>
                  )}
                {lastResponse.diagnosis_complete && (
                  <div>
                    <span style={styles.devOk}>✓ DIAGNOSIS COMPLETE</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw JSON */}
          {lastResponse && (
            <div style={styles.devSection}>
              <span style={styles.devLabel}>Raw response JSON</span>
              <pre
                style={{
                  ...styles.devValue,
                  whiteSpace: "pre-wrap",
                  fontSize: 10,
                  margin: 0,
                  maxHeight: 200,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(lastResponse, null, 2)}
              </pre>
            </div>
          )}

          {/* Test suggestions */}
          <div style={styles.devSection}>
            <span style={styles.devLabel}>Suggested tests</span>
            <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.6 }}>
              <div>• "hi" → greeting</div>
              <div>
                • "what is diabetes?" →{" "}
                <span style={styles.devKey}>db_faiss</span>
              </div>
              <div>
                • "I have fever and chills" →{" "}
                <span style={styles.devKey}>disease_faiss</span>
              </div>
              <div>
                • "chest pain" → <span style={styles.devBad}>emergency</span>
              </div>
              <div>• "find me a doctor" → doctor referral</div>
              <div>• After diagnosis: "thanks" → general</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Diagnosis;
