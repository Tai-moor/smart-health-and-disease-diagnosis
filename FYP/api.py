"""
============================================================
  MEDIBOT — AGENTIC MEDICAL ASSISTANT (FYP)
============================================================

Architecture
------------
    User message
          │
          ▼
   ┌──────────────┐
   │ Intent Agent │  ← LLM-based router (not keywords)
   └──────────────┘
          │
  ┌───────┼────────────────────┬──────────────────┬─────────────┐
  ▼       ▼                    ▼                  ▼             ▼
EMERGENCY DISEASE_INFO      SYMPTOM_TALK       GENERAL      FOLLOW_UP
          │                    │
          ▼                    ▼
    db_faiss              disease_faiss
  (Encyclopedia)        (Symptoms PDF)
          │                    │
          ▼                    ▼
   Doctor narrates      Doctor interviews
   in own words         like real consult

Two vectorstores, two jobs:
  • db_faiss      → background knowledge for "What is diabetes?"
  • disease_faiss → candidate shortlist for "I feel tired and thirsty"

The LLM is always the speaker. RAG is context, never copy-paste.
============================================================
"""

import os
import re
import csv
import time
import json
import joblib
import pandas as pd
import numpy as np
from fastapi import FastAPI, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv, find_dotenv
from groq import Groq
from rapidfuzz import process, fuzz

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

# ════════════════════════════════════════════════════════════
#  CONFIG
# ════════════════════════════════════════════════════════════
load_dotenv(find_dotenv())

app = FastAPI(title="Medibot Agentic API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Vectorstore paths
ENCYCLOPEDIA_VECTORSTORE_PATH = os.path.join(BASE_DIR, "vectorstore", "db_faiss")
DISEASE_VECTORSTORE_PATH      = os.path.join(BASE_DIR, "vectorstore", "disease_faiss")

# Data paths
DOCTORS_CSV = os.path.join(BASE_DIR, "data", "doctors.csv")
MODEL_PATH  = os.path.join(BASE_DIR, "data", "disease_model.pkl")
COLS_PATH   = os.path.join(BASE_DIR, "data", "symptom_columns.pkl")
LE_PATH     = os.path.join(BASE_DIR, "data", "label_encoder.pkl")

# Models — two tiers so we save tokens on the router
ROUTER_MODEL    = "llama-3.1-8b-instant"       # fast & cheap for intent classification
CONVERSATION_MODEL = "llama-3.3-70b-versatile" # large model for actual doctor replies

groq_client = Groq(api_key=GROQ_API_KEY)

# Session store
chat_sessions = {}
SESSION_TTL_SECONDS = 3600
MAX_HISTORY_MESSAGES = 12  # trim old turns so context stays focused

# ── Symptom-interview dynamics ────────────────────────────────────
# The interview length is dynamic — the agent decides when it has
# enough info, bounded by these safety limits.
MIN_QUESTIONS_BEFORE_DIAGNOSIS = 2  # clinical safety: never conclude after 1 answer
SOFT_TARGET_QUESTIONS          = 5  # encourage wrap-up here (API cost / patience)
MAX_QUESTIONS                  = 8  # hard cap: must diagnose by now no matter what

# Marker the LLM emits to signal "I have enough info, give diagnosis now"
DIAGNOSIS_MARKER = "[DIAGNOSIS]"


# ════════════════════════════════════════════════════════════
#  DOCTOR PERSONA — the soul of Medibot
# ════════════════════════════════════════════════════════════
DOCTOR_PERSONA = """You are Dr. Medibot — a calm, experienced physician in a real consultation room.
You are NOT a chatbot. You are NOT "an AI". You are a doctor speaking with your patient.

HOW YOU SPEAK:
- Natural, unhurried speech — the way a trusted family doctor actually talks.
- Often open with a soft acknowledgment: "Alright, I see." / "Mm-hm." / "That's helpful." / "Okay, noted."
- Validate the patient's concern before moving on: "I understand why that would worry you."
- Occasionally explain WHY you're asking a question — it builds trust:
  "I'm asking about fever because it would change what we're looking at."
- Use "we" and "let's" to make it collaborative: "Let's figure this out together."
- Medical terms are fine — but explain them in plain words:
  "This sounds like bursitis — basically a bit of inflammation in a small fluid sac near the joint."
- When a lot has been said, summarize what you've heard to check you've understood:
  "So let me make sure I've got this — the pain started a week ago, it's sharp, and it's worse when you walk. Is that right?"
- Short sentences when you're being reassuring. Longer, careful sentences when you're explaining.
- Vary your openings naturally — do not start every reply the same way.

WHAT YOU NEVER DO:
- Never say "I'm an AI" / "as a language model" / "I cannot help with that".
- Never give a 100% certain diagnosis. Use soft language: "this sounds like", "it could be", "it's often".
- Never invent drug names, dosages, or statistics you aren't sure of.
- Never dump a bulleted list at the patient — speak in flowing sentences.
- Never break character.

WHEN THINGS ARE URGENT:
- Chest pain, stroke signs, severe bleeding, can't breathe → calmly but firmly tell them to call
  emergency services or go to the ER NOW. Do not ask more questions in that moment.

TONE EXAMPLES:
  BAD  → "Based on the symptoms you described, you may have gastritis. Treatment options include antacids..."
  GOOD → "Alright, so that burning after meals — together with the bloating you mentioned — does sound like it could be gastritis. It's very common, and it usually settles down with the right care. Tell me, is it worse when you eat spicy food or drink tea?"

  BAD  → "Please provide more information regarding your symptoms."
  GOOD → "Mm-hm, I hear you. Can you tell me how long this has been going on?"
"""


# ════════════════════════════════════════════════════════════
#  CLINICAL DATA
# ════════════════════════════════════════════════════════════
SPECIALTY_KEYWORDS = {
    "Cardiologist":       ["chest pain", "heart", "palpitation", "cardiac", "angina"],
    "Pulmonologist":      ["breathing", "cough", "lungs", "asthma", "breath"],
    "Neurologist":        ["headache", "migraine", "dizziness", "tingling", "numbness", "seizure", "stroke"],
    "Dentist":            ["tooth", "teeth", "gum", "cavity", "jaw"],
    "Dermatologist":      ["skin", "rash", "acne", "eczema", "itch", "lesion"],
    "ENT Specialist":     ["ear", "throat", "nose", "sinus", "hearing", "swallow"],
    "Orthopedic Surgeon": ["knee", "joint", "bone", "back pain", "shoulder", "fracture", "muscle"],
    "Gynecologist":       ["pregnancy", "period", "menstrual", "pelvic", "vaginal"],
    "Pediatrician":       ["baby", "child", "infant"],
    "Urologist":          ["urine", "kidney", "bladder", "uti"],
    "Gastroenterologist": ["stomach", "abdomen", "nausea", "vomit", "digestion", "bowel", "acid"],
    "Endocrinologist":    ["diabetes", "thyroid", "hormone", "sugar"],
    "Psychiatrist":       ["anxiety", "depression", "stress", "mental", "panic"],
}

EMERGENCY_KEYWORDS = [
    "chest pain", "heart attack", "cant breathe", "can't breathe", "cannot breathe",
    "difficulty breathing", "stroke", "unconscious", "not breathing",
    "severe bleeding", "overdose", "poisoning", "collapsed", "fainted", "seizure",
    "suicide", "kill myself",
]


# ════════════════════════════════════════════════════════════
#  LOAD KNOWLEDGE BASE
# ════════════════════════════════════════════════════════════
print("=" * 60)
print("🏥  MEDIBOT — Booting Knowledge Base")
print("=" * 60)

ai_model = None
symptom_cols = []
label_encoder = None
readable_symptoms = {}
disease_names_list = []
desc_df = meds_df = diets_df = prec_df = work_df = None

try:
    if os.path.exists(MODEL_PATH):
        ai_model      = joblib.load(MODEL_PATH)
        symptom_cols  = joblib.load(COLS_PATH)
        label_encoder = joblib.load(LE_PATH)
        readable_symptoms = {s.replace("_", " ").title(): s for s in symptom_cols}
        print("✅ XGBoost model loaded")

    desc_df  = pd.read_csv(os.path.join(BASE_DIR, "data", "description.csv"))
    meds_df  = pd.read_csv(os.path.join(BASE_DIR, "data", "medications.csv"))
    diets_df = pd.read_csv(os.path.join(BASE_DIR, "data", "diets.csv"))
    prec_df  = pd.read_csv(os.path.join(BASE_DIR, "data", "precautions.csv"))
    work_df  = pd.read_csv(os.path.join(BASE_DIR, "data", "workout.csv"))
    disease_names_list = desc_df.iloc[:, 0].dropna().tolist()
    print("✅ Clinical CSVs loaded")
except Exception as e:
    print(f"⚠️  Data load warning: {e}")

print("🔧 Loading embedding model...")
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True},
)

# db_faiss — Encyclopedia (for DISEASE INFO questions)
try:
    encyclopedia_vs = FAISS.load_local(
        ENCYCLOPEDIA_VECTORSTORE_PATH, embeddings, allow_dangerous_deserialization=True
    )
    encyclopedia_retriever = encyclopedia_vs.as_retriever(search_kwargs={"k": 3})
    ENCYCLOPEDIA_LOADED = True
    print("✅ db_faiss (Encyclopedia) loaded")
except Exception as e:
    encyclopedia_retriever = None
    ENCYCLOPEDIA_LOADED = False
    print(f"⚠️  db_faiss not loaded: {e}")

# disease_faiss — Symptoms PDF (for SYMPTOM → DISEASE matching)
try:
    disease_vs = FAISS.load_local(
        DISEASE_VECTORSTORE_PATH, embeddings, allow_dangerous_deserialization=True
    )
    disease_retriever = disease_vs.as_retriever(search_kwargs={"k": 4})
    DISEASE_VS_LOADED = True
    print("✅ disease_faiss (Symptoms DB) loaded")
except Exception as e:
    disease_retriever = None
    DISEASE_VS_LOADED = False
    print(f"⚠️  disease_faiss not loaded: {e}")

print("=" * 60)
print("✅ Medibot ready.\n")


# ════════════════════════════════════════════════════════════
#  HELPERS
# ════════════════════════════════════════════════════════════
def cleanup_old_sessions():
    now = time.time()
    expired = [
        sid for sid, s in chat_sessions.items()
        if now - s.get("last_active", now) > SESSION_TTL_SECONDS
    ]
    for sid in expired:
        del chat_sessions[sid]


def get_csv_info(df, disease):
    if df is None:
        return []
    row = df[df.iloc[:, 0].str.lower() == disease.lower()]
    if not row.empty:
        return row.iloc[0, 1:].dropna().tolist()
    return []


def fix_spelling(query: str) -> str:
    if not disease_names_list:
        return query
    match = process.extractOne(query, disease_names_list, scorer=fuzz.WRatio)
    if match and match[1] > 80:
        return match[0]
    return query


def is_emergency(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in EMERGENCY_KEYWORDS)


def search_encyclopedia(query: str) -> dict:
    """db_faiss — 'What is diabetes?' style queries."""
    if not encyclopedia_retriever:
        return {"success": False, "content": None}
    try:
        corrected = fix_spelling(query)
        docs = encyclopedia_retriever.invoke(corrected)
        if not docs:
            return {"success": False, "content": None}
        content = "\n\n".join(d.page_content.strip() for d in docs)[:900]
        return {"success": True, "content": content, "corrected": corrected}
    except Exception:
        return {"success": False, "content": None}


def search_diseases_by_symptom(symptom_text: str) -> list:
    """disease_faiss — 'I feel tired and thirsty' style queries."""
    if not disease_retriever:
        return []
    try:
        docs = disease_retriever.invoke(symptom_text)
        out, seen = [], set()
        for doc in docs:
            disease = doc.metadata.get("disease", "Unknown")
            if disease not in seen:
                seen.add(disease)
                out.append({
                    "disease": disease,
                    "symptoms_text": doc.page_content,
                })
        return out
    except Exception:
        return []


def find_doctors_from_csv(specialty: str = None, city: str = None) -> list:
    try:
        with open(DOCTORS_CSV, mode="r", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
    except Exception:
        return []
    sp = (specialty or "").strip().lower()
    ci = (city or "").strip().lower()
    out = []
    for r in rows:
        r_city = (r.get("city") or "").lower()
        r_spec = (r.get("specialty") or "").lower()
        if sp and sp not in r_spec:
            continue
        if ci and ci != r_city:
            continue
        out.append(r)
    return out[:10]


# ─── Doctor directory helpers ─────────────────────────────────────
def _load_known_cities():
    """Build a set of unique cities from doctors.csv for text extraction."""
    cities = set()
    try:
        with open(DOCTORS_CSV, mode="r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                c = (r.get("city") or "").strip()
                if c:
                    cities.add(c)
    except Exception as e:
        print(f"⚠️  Could not load cities from doctors.csv: {e}")
    return cities


KNOWN_CITIES = _load_known_cities()
if KNOWN_CITIES:
    print(f"🏙️  Loaded {len(KNOWN_CITIES)} unique cities from doctors.csv")


def extract_city_from_text(text: str) -> str:
    """
    Find a city mention in free text. Uses the actual city list from
    doctors.csv so we only match cities that would yield results anyway.
    Returns "" if no match.
    """
    if not KNOWN_CITIES:
        return ""
    t = text.lower()
    # Longer names first so "Islamabad Capital" doesn't match "Islam"
    for city in sorted(KNOWN_CITIES, key=len, reverse=True):
        if re.search(rf"\b{re.escape(city.lower())}\b", t):
            return city
    return ""


def normalize_doctor_row(row: dict) -> dict:
    """
    Convert a doctors.csv row into a stable shape for the frontend.
    Tolerates missing columns — defaults are chosen so the UI degrades
    gracefully (no Book button when there's no id, etc.).
    """
    # "registered" field: supports bool-ish strings; defaults to True
    # if the column doesn't exist at all (= everything in CSV is bookable).
    reg_raw = row.get("registered")
    if reg_raw is None:
        registered = True
    else:
        registered = str(reg_raw).strip().lower() in ("true", "1", "yes", "y")

    doctor_id = (
        row.get("id")
        or row.get("doctor_id")
        or row.get("docId")
        or ""
    ).strip()

    return {
        "id":         doctor_id,
        "name":       (row.get("name") or "").strip(),
        "specialty":  (row.get("specialty") or "").strip(),
        "hospital":   (row.get("hospital") or row.get("clinic") or "").strip(),
        "city":       (row.get("city") or "").strip(),
        "fee":        (row.get("fee") or "").strip(),
        "experience": (row.get("experience") or "").strip(),
        "phone":      (row.get("phone") or "").strip(),
        "rating":     (row.get("rating") or row.get("averageRating") or "").strip(),
        "registered": registered and bool(doctor_id),   # must have id to be bookable
    }


def find_and_normalize_doctors(specialty: str, city: str = "", limit: int = 5) -> list:
    """One-call helper: query CSV + normalize + limit."""
    rows = find_doctors_from_csv(specialty=specialty, city=city)
    return [normalize_doctor_row(r) for r in rows[:limit]]



def infer_specialty(text: str) -> str:
    t = text.lower()
    for specialty, keywords in SPECIALTY_KEYWORDS.items():
        if specialty.lower() in t:
            return specialty
        for kw in keywords:
            if kw in t:
                return specialty
    return "General Physician"


def _ensure_ends_on_user_turn(messages: list) -> list:
    """
    Groq Llama sometimes returns an EMPTY string if the last message
    isn't a user turn. This guard rewrites the message list so that:
      - it always contains at least one user message
      - the final message is always from the user
    If the last message is from the assistant, we merge its content
    into a trailing user "nudge" so the model has something to answer.
    """
    if not messages:
        return [{"role": "user", "content": "Please respond."}]

    # Ensure at least one user turn exists
    has_user = any(m.get("role") == "user" for m in messages)
    if not has_user:
        messages = messages + [{"role": "user", "content": "Please go ahead."}]
        return messages

    # Final message must be from the user
    if messages[-1].get("role") != "user":
        messages = messages + [{"role": "user", "content": "Please continue."}]
    return messages


def call_llm(messages: list, model: str = CONVERSATION_MODEL,
             temperature: float = 0.6, max_tokens: int = 350,
             fallback: str = None) -> str:
    """
    Centralized LLM call with:
      • persona injection for the conversation model
      • guaranteed user-final turn (prevents empty responses from Groq Llama)
      • one automatic retry if response is empty
      • safe fallback string so callers never receive ''
    """
    if model == CONVERSATION_MODEL:
        if not messages or messages[0].get("role") != "system":
            messages = [{"role": "system", "content": DOCTOR_PERSONA}] + messages
        else:
            messages[0]["content"] = DOCTOR_PERSONA + "\n\n" + messages[0]["content"]

    messages = _ensure_ends_on_user_turn(messages)

    def _call(msgs, temp):
        resp = groq_client.chat.completions.create(
            model=model,
            messages=msgs,
            temperature=temp,
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip()

    # Attempt 1
    try:
        text = _call(messages, temperature)
    except Exception as e:
        print(f"⚠️  call_llm attempt 1 failed: {e}")
        text = ""

    # Attempt 2 — retry with nudged prompt and slightly higher temp
    if not text:
        print(f"⚠️  Empty LLM response on first try — retrying (model={model})")
        retry_msgs = messages + [
            {"role": "assistant", "content": "..."},
            {"role": "user", "content": "Please answer my previous message now."},
        ]
        try:
            text = _call(retry_msgs, min(temperature + 0.2, 0.95))
        except Exception as e:
            print(f"⚠️  call_llm retry failed: {e}")
            text = ""

    # Final guard — never return '' to the caller
    if not text:
        print("⚠️  LLM returned empty twice — using fallback string")
        return fallback or (
            "I'm sorry, I got a bit distracted. Could you tell me again, in your own words, "
            "what's bothering you? I'd like to understand better."
        )

    return text


# ════════════════════════════════════════════════════════════
#  THE AGENT — intent classifier
# ════════════════════════════════════════════════════════════
INTENT_ROUTER_PROMPT = """You are an intent classifier for a medical chatbot. Read the patient's latest message and the recent conversation, then output ONE of these labels:

- DISEASE_INFO        → patient is asking ABOUT a disease (what is X, tell me about X, causes of X, how is X treated, explain X)
- SYMPTOM_REPORT      → patient is describing something they FEEL (I have X, my X hurts, I've been feeling X, there's a rash on my X)
- INTERVIEW_REPLY     → patient is answering a follow-up question during an ongoing symptom interview (short replies like "yes", "no", "since 2 days", "dull pain", "both sides")
- DOCTOR_REQUEST      → patient wants to find/see/list doctors, get a referral, browse a specialty, or book an appointment.
                         Examples: "find me a cardiologist", "show me dermatologists in Lahore",
                         "I need to see a doctor", "list dentists nearby", "book me an appointment with a heart specialist"
- GREETING            → hello, hi, salam, good morning, thanks, bye
- GENERAL             → anything else (off-topic chit-chat, clarification, unclear)

Output ONLY the single label. No other words.
"""


def classify_intent(user_msg: str, flow_state: str, recent_history: list) -> str:
    """Use the small, fast model to decide intent."""
    # Hard override — if interview is live, short replies are almost always INTERVIEW_REPLY
    if flow_state == "interviewing" and len(user_msg.split()) <= 8:
        return "INTERVIEW_REPLY"

    history_text = ""
    if recent_history:
        last = recent_history[-4:]
        history_text = "\n".join(
            f"{m['role']}: {m['content'][:120]}" for m in last
        )

    messages = [
        {"role": "system", "content": INTENT_ROUTER_PROMPT},
        {"role": "user", "content": (
            f"Conversation so far:\n{history_text or '(none)'}\n\n"
            f"Current flow state: {flow_state}\n\n"
            f"Patient message: \"{user_msg}\"\n\n"
            "Label:"
        )},
    ]
    try:
        raw = call_llm(messages, model=ROUTER_MODEL, temperature=0.0, max_tokens=10)
        label = raw.strip().upper().split()[0].strip(".,:;\"'")
        valid = {"DISEASE_INFO", "SYMPTOM_REPORT", "INTERVIEW_REPLY",
                 "DOCTOR_REQUEST", "GREETING", "GENERAL"}
        if label in valid:
            return label
        # Heuristic fallback if model returns something odd
        return "GENERAL"
    except Exception as e:
        print(f"Router error: {e}")
        return "GENERAL"


# ════════════════════════════════════════════════════════════
#  ENDPOINTS
# ════════════════════════════════════════════════════════════
class SearchRequest(BaseModel):
    query: str


@app.post("/search_symptom")
def search_symptom(request: SearchRequest):
    query = request.query.lower()
    matches = []
    for label, internal in readable_symptoms.items():
        if query in label.lower():
            matches.append({"label": label, "value": internal})
    if len(matches) < 5:
        fuzzy = process.extract(query, list(readable_symptoms.keys()),
                                scorer=fuzz.WRatio, limit=5)
        for label, score, _ in fuzzy:
            if score > 60 and not any(m["label"] == label for m in matches):
                matches.append({"label": label, "value": readable_symptoms[label]})
    return {"matches": matches[:10]}


# ── /predict ──────────────────────────────────────────────
class SymptomRequest(BaseModel):
    selected_symptoms: list[str]


@app.post("/predict")
def predict_disease(request: SymptomRequest):
    """ML-first → RAG fallback. Identical response shape either way."""
    if ai_model and label_encoder:
        input_data = pd.DataFrame(0, index=[0], columns=symptom_cols)
        for s in request.selected_symptoms:
            if s in symptom_cols:
                input_data[s] = 1

        probs = ai_model.predict_proba(input_data)[0]
        top_3 = np.argsort(probs)[-3:][::-1]

        symptom_text = " ".join(s.replace("_", " ") for s in request.selected_symptoms)
        rag_hits = search_diseases_by_symptom(symptom_text)
        rag_map = {r["disease"].lower(): r["symptoms_text"] for r in rag_hits}

        results = []
        for idx in top_3:
            conf = probs[idx] * 100
            if conf > 1.0:
                dn = label_encoder.inverse_transform([idx])[0]
                results.append({
                    "disease":          dn,
                    "confidence":       f"{conf:.2f}%",
                    "description":      (get_csv_info(desc_df, dn) or ["No description available."])[0],
                    "medications":      get_csv_info(meds_df, dn)[:3],
                    "diets":            get_csv_info(diets_df, dn)[:3],
                    "workout":          get_csv_info(work_df, dn)[:3],
                    "precautions":      get_csv_info(prec_df, dn)[:3],
                    "matched_symptoms": rag_map.get(dn.lower()),
                })
        return {"top_diagnosis": results, "source": "ml_model"}

    # Fallback: pure disease_faiss
    if DISEASE_VS_LOADED:
        symptom_text = " ".join(s.replace("_", " ") for s in request.selected_symptoms)
        rag_hits = search_diseases_by_symptom(symptom_text)
        results = []
        for m in rag_hits[:3]:
            dn = m["disease"]
            results.append({
                "disease":          dn,
                "confidence":       "N/A (RAG fallback)",
                "description":      (get_csv_info(desc_df, dn) or ["No description available."])[0],
                "medications":      get_csv_info(meds_df, dn)[:3],
                "diets":            get_csv_info(diets_df, dn)[:3],
                "workout":          get_csv_info(work_df, dn)[:3],
                "precautions":      get_csv_info(prec_df, dn)[:3],
                "matched_symptoms": m["symptoms_text"],
            })
        return {"top_diagnosis": results, "source": "disease_faiss_fallback"}

    return {"error": "Neither ML model nor disease vectorstore is available."}


# ════════════════════════════════════════════════════════════
#  /chat — THE MAIN AGENTIC ENDPOINT
# ════════════════════════════════════════════════════════════

def _deliver_diagnosis(session, user_msg, history_text, candidate_diseases,
                       combined_so_far, forced=False):
    """
    Generate a final diagnosis with the dedicated prompt.
    Called from two places:
      1. Agent self-terminated but its diagnosis body was too short.
      2. Hard question cap (MAX_QUESTIONS) reached — must conclude now.

    Returns the same JSON shape as the agentic diagnosis path so the
    frontend sees a consistent response.
    """
    top_candidates = ", ".join(candidate_diseases) or "unclear"

    diagnosis_prompt = (
        "You have just completed a clinical history-taking with the patient.\n\n"
        f"FULL PATIENT HISTORY:\n{history_text}\n\n"
        f"📊 Database-backed candidates (disease_faiss): {top_candidates}\n\n"
        "Now speak to the patient as Dr. Medibot and share your impression. You must:\n"
        "1. Acknowledge briefly what they went through.\n"
        "2. Name the MOST LIKELY condition using soft language "
        "(\"it sounds like…\", \"this pattern is often…\"). NEVER say \"you have\".\n"
        "3. Briefly explain — in plain words — why you're thinking this.\n"
        "4. Tell them which specialist would be best for them to see.\n"
        "5. Mention ONE red-flag sign that should send them to the ER right away.\n"
        "6. Write as warm, flowing speech — 4 to 6 sentences. No bullets. No headers."
    )

    if forced:
        diagnosis_prompt += (
            "\n\nNote: We have gathered enough history. Give your best impression now — "
            "if the case is genuinely ambiguous, say so honestly and recommend in-person assessment."
        )

    messages = (
        [{"role": "system", "content": diagnosis_prompt}]
        + session["history"][-MAX_HISTORY_MESSAGES:]
        + [{"role": "user", "content": user_msg}]
    )

    diagnosis_text = call_llm(
        messages,
        temperature=0.4,
        max_tokens=500,
        fallback=(
            "From everything you've shared, I think this is worth discussing with a doctor "
            "in person — they can examine you properly and order any tests that might help. "
            "A General Physician is a good starting point; they'll refer you to a specialist "
            "if needed. And if things suddenly get much worse — severe pain, high fever, or "
            "you just feel truly unwell — please go to the nearest emergency room."
        ),
    )

    specialty = infer_specialty(diagnosis_text + " " + combined_so_far)
    diagnosis_text += f"\n\n*Tap below to find a {specialty} near you.*"

    # Transition state — keep history so follow-ups still work
    session["flow_state"] = "diagnosed"
    qn_at_end = session["questions_asked"]
    session["questions_asked"] = 0
    session["symptoms_collected"] = []
    session["history"].append({"role": "user", "content": user_msg})
    session["history"].append({"role": "assistant", "content": diagnosis_text})

    print(f"[Diagnosis] forced={forced} | specialty={specialty} | candidates={candidate_diseases}")

    return {
        "text":                  diagnosis_text,
        "source":                "diagnosis",
        "vectorstore_used":      "disease_faiss",
        "show_specialty_button": True,
        "specialty":             specialty,
        "specialty_link":        f"/find-doctors?specialty={specialty}",
        "diagnosis_complete":    True,
        "candidates":            candidate_diseases,
        "questions_asked":       qn_at_end,
        "forced_conclusion":     forced,
    }


class UserQuery(BaseModel):
    message: str
    session_id: str = "default"


@app.post("/chat")
async def chat_endpoint(query: UserQuery):
    """
    Flow:
      1. Cleanup old sessions
      2. Emergency check (hard override)
      3. Intent classifier (agentic router)
      4. Dispatch to the right handler
      5. Log history + return

    Session flow_state values:
      "idle"         → no active interview
      "interviewing" → mid symptom interview
      "diagnosed"    → just gave diagnosis, ready for follow-up
    """
    try:
        cleanup_old_sessions()

        # ── Session init ──────────────────────────────────
        if query.session_id not in chat_sessions:
            chat_sessions[query.session_id] = {
                "history":            [],
                "flow_state":         "idle",
                "questions_asked":    0,
                "symptoms_collected": [],
                "last_active":        time.time(),
                "last_disease_topic": None,
            }

        session = chat_sessions[query.session_id]
        session["last_active"] = time.time()
        user_msg = query.message.strip()
        flow_state = session["flow_state"]

        # ── Guard: oversized message ──────────────────────
        if len(user_msg) > 1500:
            return {
                "text": "That's a lot to take in at once. Can you tell me the single thing that's bothering you most right now?",
                "source": "system",
                "show_specialty_button": False,
            }

        if not user_msg:
            return {
                "text": "I'm listening — take your time. What would you like to talk about today?",
                "source": "system",
                "show_specialty_button": False,
            }

        # ═══════════════════════════════════════════════════
        #  PATH 0 — EMERGENCY (highest priority, always checked)
        # ═══════════════════════════════════════════════════
        if is_emergency(user_msg):
            urgent_reply = call_llm(
                [
                    {"role": "system", "content": (
                        f'The patient just said: "{user_msg}". '
                        "This sounds like a medical emergency. Respond IMMEDIATELY and calmly. "
                        "Tell them to call emergency services (1122 / 115 in Pakistan, or 911 in the US) right now, "
                        "or get to the nearest ER. Do NOT diagnose. Do NOT ask questions. "
                        "Be brief — 2 short sentences max — and compassionate."
                    )},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.3,
                max_tokens=120,
            )
            session["history"].append({"role": "user", "content": user_msg})
            session["history"].append({"role": "assistant", "content": urgent_reply})
            return {
                "text": f"🚨 {urgent_reply}",
                "source": "emergency",
                "show_specialty_button": False,
            }

        # ═══════════════════════════════════════════════════
        #  AGENTIC ROUTER — classify intent
        # ═══════════════════════════════════════════════════
        intent = classify_intent(user_msg, flow_state, session["history"])
        print(f"[Router] state={flow_state} | intent={intent} | msg={user_msg[:60]!r}")

        # ═══════════════════════════════════════════════════
        #  PATH 1 — GREETING
        # ═══════════════════════════════════════════════════
        if intent == "GREETING" and flow_state != "interviewing":
            # Reset interview state, keep greeting warm
            session["flow_state"] = "idle"
            session["questions_asked"] = 0
            session["symptoms_collected"] = []

            greet_reply = call_llm(
                [{"role": "user", "content": (
                    f'The patient just said: "{user_msg}".\n\n'
                    "Greet them warmly as Dr. Medibot. Make it sound like a real doctor "
                    "welcoming a patient into the clinic — NOT a chatbot listing features. "
                    "Just say hello, maybe ask how they're feeling today or what brings them in. "
                    "One or two short sentences. Natural."
                )}],
                temperature=0.8,
                max_tokens=100,
            )
            session["history"].append({"role": "user", "content": user_msg})
            session["history"].append({"role": "assistant", "content": greet_reply})
            return {
                "text": greet_reply,
                "source": "greeting",
                "show_specialty_button": False,
            }

        # ═══════════════════════════════════════════════════
        #  PATH 2 — DISEASE_INFO → db_faiss (Encyclopedia)
        # ═══════════════════════════════════════════════════
        if intent == "DISEASE_INFO" and flow_state != "interviewing":
            rag = search_encyclopedia(user_msg)

            if rag["success"]:
                disease_name = rag.get("corrected", user_msg)
                session["last_disease_topic"] = disease_name

                meds_info  = get_csv_info(meds_df, disease_name)[:3]
                diets_info = get_csv_info(diets_df, disease_name)[:3]
                prec_info  = get_csv_info(prec_df, disease_name)[:3]

                context_blob = [f"Medical reference material:\n{rag['content']}"]
                if meds_info:
                    context_blob.append(f"Typical medications: {', '.join(meds_info)}")
                if diets_info:
                    context_blob.append(f"Dietary guidance: {', '.join(diets_info)}")
                if prec_info:
                    context_blob.append(f"Precautions: {', '.join(prec_info)}")

                narration = (
                    f'The patient asked: "{user_msg}"\n\n'
                    f"You have this clinical reference material to draw from:\n\n"
                    f"{chr(10).join(context_blob)}\n\n"
                    "Now answer the patient as Dr. Medibot — in your OWN warm, natural words. "
                    "Do NOT paste the reference. Do NOT use bullet points. Speak like a doctor explaining to a worried patient. "
                    "Cover the essential facts (what it is, common causes, what they should do) in 3–5 sentences. "
                    "End by inviting them to share their symptoms or ask anything else."
                )

                ai_reply = call_llm(
                    [{"role": "system", "content": narration}]
                    + session["history"][-4:]
                    + [{"role": "user", "content": user_msg}],
                    temperature=0.6,
                    max_tokens=400,
                )

                session["history"].append({"role": "user", "content": user_msg})
                session["history"].append({"role": "assistant", "content": ai_reply})
                session["flow_state"] = "idle"

                return {
                    "text":                  ai_reply,
                    "source":                "encyclopedia_rag",
                    "vectorstore_used":      "db_faiss",
                    "rag_used":              True,
                    "disease_topic":         disease_name,
                    "show_specialty_button": False,
                }

            # RAG missed — fall through to general conversational reply
            # (handled by the GENERAL path below)

        # ═══════════════════════════════════════════════════
        #  PATH 3 — DOCTOR_REQUEST → simple specialty button
        #  (matches the proven pattern from the original code:
        #  detect specialty, show ONE button, send user to the
        #  dedicated /find-doctors page with rich filtering)
        # ═══════════════════════════════════════════════════
        if intent == "DOCTOR_REQUEST":
            # Infer specialty from current msg + recent conversation
            full_context = user_msg + " " + " ".join(
                m["content"] for m in session["history"][-6:]
                if m.get("role") == "user"
            )
            specialty = infer_specialty(full_context)

            # Extract city — used to deep-link with both specialty AND city
            city = extract_city_from_text(user_msg)
            if not city:
                city = extract_city_from_text(full_context)

            reply_prompt = (
                f'The patient wants to see a doctor. Based on the conversation they need a {specialty}'
                f'{" in " + city if city else ""}.\n\n'
                "Respond as Dr. Medibot in 2 short, warm sentences:\n"
                "- Briefly confirm the specialist type and why it fits\n"
                "- Tell them to tap the button below to see verified doctors they can book\n"
                "- No markdown, no lists, no specific names or fees"
            )

            ai_reply = call_llm(
                [{"role": "system", "content": reply_prompt}]
                + session["history"][-4:]
                + [{"role": "user", "content": user_msg}],
                temperature=0.6,
                max_tokens=180,
                fallback=(
                    f"Alright, a {specialty} is the right person to see for this. "
                    f"Tap the button below and I'll show you verified doctors you can book"
                    f"{' in ' + city if city else ''}."
                ),
            )

            session["history"].append({"role": "user", "content": user_msg})
            session["history"].append({"role": "assistant", "content": ai_reply})

            # Build the link that matches the frontend route
            specialty_link = f"/find-doctors?specialty={specialty}"
            if city:
                specialty_link += f"&city={city}"

            print(f"[DoctorReq] specialty={specialty!r} city={city!r}")

            return {
                "text":                  ai_reply,
                "source":                "doctor_referral",
                "specialty":             specialty,
                "city":                  city,
                "show_specialty_button": True,
                "specialty_link":        specialty_link,
            }

        # ═══════════════════════════════════════════════════
        #  PATH 4 — SYMPTOM INTERVIEW → disease_faiss (DB-FIRST)
        #  Dynamic question count — the agent decides when to stop.
        # ═══════════════════════════════════════════════════
        start_interview = intent == "SYMPTOM_REPORT" and flow_state in ("idle", "diagnosed")
        mid_interview   = intent == "INTERVIEW_REPLY" or flow_state == "interviewing"

        if start_interview or mid_interview:
            # Initialise new interview on first turn
            if flow_state != "interviewing":
                session["flow_state"] = "interviewing"
                session["questions_asked"] = 0
                session["symptoms_collected"] = [f"Initial complaint: {user_msg}"]
            else:
                session["symptoms_collected"].append(
                    f"Patient reply #{session['questions_asked']}: {user_msg}"
                )

            session["questions_asked"] += 1
            qn = session["questions_asked"]

            # ── DB-FIRST: re-query disease_faiss on EVERY turn ─────
            combined_so_far = " ".join(
                s for s in session["symptoms_collected"]
                if not s.startswith("[")
            )
            rag_hits = search_diseases_by_symptom(combined_so_far)
            candidate_diseases = [h["disease"] for h in rag_hits[:3]]

            history_text = "\n".join(
                s for s in session["symptoms_collected"]
                if not s.startswith("[")
            )

            rag_block = (
                f"\n📊 Disease database matches so far (disease_faiss top 3):\n"
                f"   {', '.join(candidate_diseases)}\n"
                if candidate_diseases
                else "\n📊 Disease database: no strong matches yet.\n"
            )

            # ── Decide stopping behaviour for this turn ─────────────
            can_conclude    = qn >= MIN_QUESTIONS_BEFORE_DIAGNOSIS
            should_wrap_up  = qn >= SOFT_TARGET_QUESTIONS
            must_conclude   = qn > MAX_QUESTIONS

            # ── HARD CAP reached — skip agent choice, force diagnosis ──
            if must_conclude:
                print(f"[Interview] Q{qn} hit hard cap ({MAX_QUESTIONS}) — forcing diagnosis")
                return _deliver_diagnosis(
                    session, user_msg, history_text,
                    candidate_diseases, combined_so_far,
                    forced=True,
                )

            # ── Agentic turn: ask follow-up OR self-terminate ──────
            # The LLM chooses between (A) asking another question or
            # (B) wrapping up with [DIAGNOSIS]. Safety floor + soft
            # target guidance is baked into the prompt.
            if can_conclude:
                stopping_guidance = (
                    f"Turn {qn}. You MAY wrap up now if you feel confident about the likely cause.\n"
                    f"{'You SHOULD strongly consider wrapping up unless the case genuinely needs more clarification.' if should_wrap_up else 'Only wrap up if you are confident — otherwise keep asking.'}\n"
                    f"(Soft target: {SOFT_TARGET_QUESTIONS} questions · Hard maximum: {MAX_QUESTIONS})"
                )
            else:
                stopping_guidance = (
                    f"Turn {qn}. You have not yet asked enough to wrap up — keep gathering history.\n"
                    f"(Minimum {MIN_QUESTIONS_BEFORE_DIAGNOSIS} questions before any conclusion can be drawn.)"
                )

            agent_prompt = (
                "You are Dr. Medibot mid-consultation. You have TWO choices this turn:\n\n"
                "──── OPTION A: ASK A FOLLOW-UP QUESTION ────\n"
                "  Use when you need more information.\n"
                "  • Begin with a brief acknowledgment of what they just said.\n"
                "  • Ask exactly ONE question. Not two.\n"
                "  • Reference something they already mentioned — don't ignore their history.\n"
                "  • Under 60 words. Warm, doctorly, unhurried.\n"
                "  • Don't repeat a question already asked.\n\n"
                f"──── OPTION B: WRAP UP WITH YOUR IMPRESSION ────\n"
                f"  Use when you have enough information to give a likely diagnosis.\n"
                f"  • Begin your response with EXACTLY this marker on its own: {DIAGNOSIS_MARKER}\n"
                "  • Then give your impression in 4–6 warm, flowing sentences:\n"
                "     - Acknowledge what they went through\n"
                "     - Name the most likely condition using soft language (\"it sounds like\", \"this pattern is often\")\n"
                "     - Briefly explain why you think this, in plain words\n"
                "     - Recommend the right type of specialist\n"
                "     - Mention ONE red-flag sign that warrants an ER visit\n\n"
                "──── STOPPING GUIDANCE ────\n"
                f"{stopping_guidance}\n\n"
                "──── CLINICAL CONTEXT ────\n"
                f"PATIENT HISTORY:\n{history_text}\n"
                f"{rag_block}\n"
                "Use the database matches to guide your next question OR to ground your diagnosis.\n"
            )

            # Always end on user turn (Groq-empty-response fix)
            messages = (
                [{"role": "system", "content": agent_prompt}]
                + session["history"][-MAX_HISTORY_MESSAGES:]
                + [{"role": "user", "content": user_msg}]
            )

            reply = call_llm(
                messages,
                temperature=0.6,
                max_tokens=500,       # enough for either a question or a full diagnosis
                fallback=(
                    "Thank you for sharing that with me. "
                    "Can you tell me a little more — how long have you been feeling this way, "
                    "and does anything seem to make it worse?"
                ),
            )

            # ── Did the agent choose to wrap up? ────────────────────
            # Check for marker at start (with some tolerance for stray whitespace
            # or a leading quote the model sometimes adds).
            cleaned = reply.lstrip("\"'` \n")
            if can_conclude and cleaned.startswith(DIAGNOSIS_MARKER):
                # Strip marker and any following blank lines
                body = cleaned[len(DIAGNOSIS_MARKER):].lstrip(": \n")

                # Sanity-check the body — if too short, the agent hallucinated
                # a marker without a real diagnosis. Fall back to the dedicated
                # diagnosis prompt.
                if len(body) < 100:
                    print(f"[Interview] Q{qn} agent used marker but body too short "
                          f"({len(body)} chars) — using full diagnosis prompt")
                    return _deliver_diagnosis(
                        session, user_msg, history_text,
                        candidate_diseases, combined_so_far,
                        forced=False,
                    )

                # Normal path — agent gave a proper diagnosis
                print(f"[Interview] Q{qn} AGENT self-terminated | candidates={candidate_diseases}")
                specialty = infer_specialty(body + " " + combined_so_far)
                body += f"\n\n*Tap below to find a {specialty} near you.*"

                session["flow_state"] = "diagnosed"
                session["questions_asked"] = 0
                session["symptoms_collected"] = []
                session["history"].append({"role": "user", "content": user_msg})
                session["history"].append({"role": "assistant", "content": body})

                return {
                    "text":                  body,
                    "source":                "diagnosis",
                    "vectorstore_used":      "disease_faiss",
                    "show_specialty_button": True,
                    "specialty":             specialty,
                    "specialty_link":        f"/find-doctors?specialty={specialty}",
                    "diagnosis_complete":    True,
                    "candidates":            candidate_diseases,
                    "questions_asked":       qn,
                }

            # ── Otherwise: it's a follow-up question ────────────────
            session["history"].append({"role": "user", "content": user_msg})
            session["history"].append({"role": "assistant", "content": reply})

            print(
                f"[Interview] Q{qn} follow-up | "
                f"can_stop={can_conclude} | "
                f"candidates={candidate_diseases} | "
                f"reply_len={len(reply)}"
            )

            return {
                "text":                  reply,
                "source":                "symptom_interview",
                "vectorstore_used":      "disease_faiss",
                "questions_asked":       qn,
                "candidates":            candidate_diseases,
                "show_specialty_button": False,
            }

        # ═══════════════════════════════════════════════════
        #  PATH 5 — GENERAL / fallback
        # ═══════════════════════════════════════════════════
        full_messages = (
            [{"role": "system", "content": DOCTOR_PERSONA}]
            + session["history"][-MAX_HISTORY_MESSAGES:]
            + [{"role": "user", "content": user_msg}]
        )
        ai_reply = call_llm(full_messages, temperature=0.7, max_tokens=250)

        session["history"].append({"role": "user", "content": user_msg})
        session["history"].append({"role": "assistant", "content": ai_reply})

        return {
            "text":                  ai_reply,
            "source":                "general_chat",
            "show_specialty_button": False,
        }

    except Exception as e:
        print(f"❌ /chat error: {e}")
        import traceback; traceback.print_exc()
        return {
            "text": "I'm sorry — I had a little trouble just then. Could you tell me again, in your own words, what's going on?",
            "source": "error",
            "show_specialty_button": False,
        }


# ════════════════════════════════════════════════════════════
#  /symptom_search_rag — direct disease_faiss access
# ════════════════════════════════════════════════════════════
class SymptomTextRequest(BaseModel):
    symptoms: str


@app.post("/symptom_search_rag")
def symptom_search_rag(request: SymptomTextRequest):
    if not DISEASE_VS_LOADED:
        return {"error": "Disease-Symptoms vectorstore not loaded."}
    matches = search_diseases_by_symptom(request.symptoms)
    if not matches:
        return {"results": [], "message": "No matching diseases found."}
    enriched = []
    for m in matches:
        dn = m["disease"]
        enriched.append({
            "disease":          dn,
            "matched_symptoms": m["symptoms_text"],
            "description":      (get_csv_info(desc_df, dn) or ["No description."])[0],
            "medications":      get_csv_info(meds_df, dn)[:3],
            "precautions":      get_csv_info(prec_df, dn)[:3],
        })
    return {"results": enriched, "source": "disease_faiss", "count": len(enriched)}


# ════════════════════════════════════════════════════════════
#  /doctors
# ════════════════════════════════════════════════════════════
@app.get("/doctors")
def doctors_endpoint(specialty: str = Query(default=None),
                     city: str = Query(default=None)):
    docs = find_doctors_from_csv(specialty=specialty, city=city)
    return {"doctors": docs, "count": len(docs), "specialty": specialty, "city": city}


# ════════════════════════════════════════════════════════════
#  /reset  — user or client can wipe a session
# ════════════════════════════════════════════════════════════
@app.post("/reset")
async def reset_session(session_id: str = "default"):
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {"status": "success", "message": "Session reset"}


# ════════════════════════════════════════════════════════════
#  /status
# ════════════════════════════════════════════════════════════
@app.get("/status")
def status():
    return {
        "status":               "running",
        "encyclopedia_rag":     ENCYCLOPEDIA_LOADED,
        "disease_symptoms_rag": DISEASE_VS_LOADED,
        "ml_model":             ai_model is not None,
        "csv_data":             desc_df is not None,
        "router_model":         ROUTER_MODEL,
        "conversation_model":   CONVERSATION_MODEL,
    }


@app.get("/")
def root():
    return {"status": "running", "app": "Medibot Agentic API", "version": "2.0"}


if __name__ == "__main__":
    import uvicorn
    print("\n🏥  Medibot AI — listening on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)