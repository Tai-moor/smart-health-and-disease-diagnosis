import os
import csv
import difflib
import joblib
import pandas as pd
import numpy as np
from fastapi import FastAPI, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv, find_dotenv
from groq import Groq 
from fuzzywuzzy import process

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

# =============================
# Config & Setup
# =============================
load_dotenv(find_dotenv())

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Paths
VECTORSTORE_PATH = os.path.join(BASE_DIR, "vectorstore", "db_faiss")
DOCTORS_CSV = os.path.join(BASE_DIR, "data", "doctors.csv")
MODEL_PATH = os.path.join(BASE_DIR, "data", "disease_model.pkl")
COLS_PATH = os.path.join(BASE_DIR, "data", "symptom_columns.pkl")
LE_PATH = os.path.join(BASE_DIR, "data", "label_encoder.pkl")

# Initialize Groq
groq_client = Groq(api_key=GROQ_API_KEY)

# State
chat_sessions = {} 

# =============================
# Specialty Keywords
# =============================
SPECIALTY_KEYWORDS = {
    "Cardiologist": ["chest pain", "heart", "palpitation", "cardiac", "angina"],
    "Pulmonologist": ["breathing", "cough", "lungs", "asthma", "breath"],
    "Neurologist": ["headache", "migraine", "dizziness", "tingling", "numbness", "seizure", "stroke"],
    "Dentist": ["tooth", "teeth", "gum", "cavity", "jaw"],
    "Dermatologist": ["skin", "rash", "acne", "eczema", "itch", "lesion"],
    "ENT Specialist": ["ear", "throat", "nose", "sinus", "hearing", "swallow"],
    "Orthopedic Surgeon": ["knee", "joint", "bone", "back pain", "shoulder", "fracture", "muscle"],
    "Gynecologist": ["pregnancy", "period", "menstrual", "pelvic", "vaginal"],
    "Pediatrician": ["baby", "child", "infant"],
    "Urologist": ["urine", "kidney", "bladder", "uti"],
    "Gastroenterologist": ["stomach", "abdomen", "nausea", "vomit", "digestion", "bowel", "acid"],
    "Endocrinologist": ["diabetes", "thyroid", "hormone", "sugar"],
    "Psychiatrist": ["anxiety", "depression", "stress", "mental", "panic"]
}

# =============================
# Load Data
# =============================
print("=" * 60)
print("🧠 Loading ML Models & Knowledge Base...")

ai_model = None
symptom_cols = []
label_encoder = None
readable_symptoms = {}
disease_names_list = []
desc_df = None
meds_df = None
diets_df = None
prec_df = None
work_df = None

try:
    if os.path.exists(MODEL_PATH):
        ai_model = joblib.load(MODEL_PATH)
        symptom_cols = joblib.load(COLS_PATH)
        label_encoder = joblib.load(LE_PATH)
        readable_symptoms = {s.replace("_", " ").title(): s for s in symptom_cols}
        print("✅ XGBoost Model Loaded")
    
    desc_df = pd.read_csv(os.path.join(BASE_DIR, "data", "description.csv"))
    meds_df = pd.read_csv(os.path.join(BASE_DIR, "data", "medications.csv"))
    diets_df = pd.read_csv(os.path.join(BASE_DIR, "data", "diets.csv"))
    prec_df = pd.read_csv(os.path.join(BASE_DIR, "data", "precautions.csv"))
    work_df = pd.read_csv(os.path.join(BASE_DIR, "data", "workout.csv"))
    disease_names_list = desc_df.iloc[:, 0].dropna().tolist()
    print("✅ Knowledge Base CSVs Loaded")
except Exception as e:
    print(f"❌ Error loading Data: {e}")

# =============================
# Load RAG
# =============================
print("📚 Loading RAG Vectorstore...")
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={'device': 'cpu'}
)

try:
    vectorstore = FAISS.load_local(VECTORSTORE_PATH, embeddings, allow_dangerous_deserialization=True)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 2})
    print("✅ RAG System loaded!")
    VECTORSTORE_LOADED = True
except Exception as e:
    print(f"⚠️ Vectorstore not loaded: {e}")
    retriever = None
    VECTORSTORE_LOADED = False

print("=" * 60)

# =============================
# Helper Functions
# =============================

def get_csv_info(df, disease):
    if df is None: return []
    row = df[df.iloc[:, 0].str.lower() == disease.lower()]
    if not row.empty:
        return row.iloc[0, 1:].dropna().tolist()
    return []

def fix_spelling(query: str) -> str:
    if not disease_names_list: return query
    match = process.extractOne(query, disease_names_list)
    if match and match[1] > 80:
        return match[0]
    return query

def get_disease_info_from_rag(query: str) -> dict:
    if not retriever: return {"success": False, "content": None}
    try:
        corrected_query = fix_spelling(query)
        docs = retriever.invoke(corrected_query)
        if not docs: return {"success": False, "content": None}
        content = docs[0].page_content.strip()[:350]
        return {"success": True, "content": content, "corrected": corrected_query}
    except Exception as e:
        return {"success": False, "content": None}

def is_direct_disease_question(text: str) -> bool:
    keywords = ["what is", "tell me about", "explain", "define", "describe", "treatment for"]
    return any(kw in text.lower() for kw in keywords)

def is_symptom_description(text: str) -> bool:
    symptom_words = ["i have", "i feel", "i am", "my", "pain", "ache", "hurt", "sick", "suffering", "itch", "swollen", "bleeding", "rash", "fever"]
    return any(sw in text.lower() for sw in symptom_words)

def find_doctors_from_csv(specialty: str = None, city: str = None) -> list:
    try:
        with open(DOCTORS_CSV, mode="r", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
    except:
        return []
    
    specialty_in = (specialty or "").strip().lower()
    city_in = (city or "").strip().lower()

    out = []
    for r in rows:
        r_city = (r.get("city") or "").lower()
        r_spec = (r.get("specialty") or "").lower()
        if specialty_in and specialty_in not in r_spec:
            continue
        if city_in and city_in != r_city:
            continue
        out.append(r)
    return out[:10]

def infer_specialty_from_text(text: str) -> str:
    text_lower = text.lower()
    for specialty, keywords in SPECIALTY_KEYWORDS.items():
        if specialty.lower() in text_lower:
            return specialty
        for kw in keywords:
            if kw in text_lower:
                return specialty
    return "General Physician"

# =============================
# API Endpoints
# =============================

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
        fuzzy_results = process.extract(query, list(readable_symptoms.keys()), limit=5)
        for label, score in fuzzy_results:
            if score > 60 and not any(m['label'] == label for m in matches):
                matches.append({"label": label, "value": readable_symptoms[label]})
    return {"matches": matches[:10]}

class SymptomRequest(BaseModel):
    selected_symptoms: list[str]

@app.post("/predict")
def predict_disease(request: SymptomRequest):
    if not ai_model or not label_encoder:
        return {"error": "Model not loaded"}
    input_data = pd.DataFrame(0, index=[0], columns=symptom_cols)
    for s in request.selected_symptoms:
        if s in symptom_cols:
            input_data[s] = 1
    probs = ai_model.predict_proba(input_data)[0]
    top_3_indices = np.argsort(probs)[-3:][::-1]
    results = []
    for index in top_3_indices:
        confidence = probs[index] * 100
        if confidence > 1.0:
            disease_name = label_encoder.inverse_transform([index])[0]
            results.append({
                "disease": disease_name,
                "confidence": f"{confidence:.2f}%",
                "description": get_csv_info(desc_df, disease_name)[0] if get_csv_info(desc_df, disease_name) else "No description.",
                "medications": get_csv_info(meds_df, disease_name)[:3],
                "diets": get_csv_info(diets_df, disease_name)[:3],
                "workout": get_csv_info(work_df, disease_name)[:3],
                "precautions": get_csv_info(prec_df, disease_name)[:3]
            })
    return {"top_diagnosis": results, "source": "ml_model"}

class UserQuery(BaseModel):
    message: str
    session_id: str = "default"

@app.post("/chat")
async def chat_endpoint(query: UserQuery):
    try:
        # 1. Initialize Session
        if query.session_id not in chat_sessions:
            chat_sessions[query.session_id] = {
                "history": [],
                "questions_asked": 0,
                "symptoms_collected": [],
                "diagnosis_made": False
            }
        
        session = chat_sessions[query.session_id]
        user_msg = query.message.strip()
        user_msg_lower = user_msg.lower()
        
        # 2. Reset / Greeting Check
        if any(word in user_msg_lower for word in ["hello", "hi", "hey", "start over", "reset"]):
            session["history"] = []
            session["questions_asked"] = 0
            session["symptoms_collected"] = []
            session["diagnosis_made"] = False
            
            return {
                "text": "Hello! I'm Medibot. 👋\n\nI can help you:\n1️⃣ Learn about diseases (e.g., 'What is Dengue?')\n2️⃣ Diagnose symptoms (e.g., 'My bones hurt')\n\nHow can I help you today?",
                "source": "system",
                "show_specialty_button": False
            }
        
        # 3. RAG Flow (Direct Medical Questions)
        if is_direct_disease_question(user_msg) and session["questions_asked"] == 0:
            rag_result = get_disease_info_from_rag(user_msg)
            if rag_result["success"]:
                disease_name = rag_result.get("corrected", user_msg)
                meds = get_csv_info(meds_df, disease_name)[:2]
                diets = get_csv_info(diets_df, disease_name)[:2]
                
                response = f"📖 **From Encyclopedia:**\n{rag_result['content']}\n\n"
                if meds: response += f"💊 **Meds:** {', '.join(meds)}\n"
                if diets: response += f"🥗 **Diet:** {', '.join(diets)}\n"
                
                return {
                    "text": response,
                    "source": "rag",
                    "rag_used": True,
                    "show_specialty_button": False
                }

        # 4. DIAGNOSTIC FLOW LOGIC (Dynamic AI Questions)
        is_flow_active = session["questions_asked"] > 0
        is_new_symptom = is_symptom_description(user_msg)

        if (is_flow_active or is_new_symptom) and not session["diagnosis_made"]:
            
            # Update Session History
            if session["questions_asked"] == 0:
                session["symptoms_collected"].append(f"Initial Complaint: {user_msg}")
            else:
                session["symptoms_collected"].append(f"Patient Answer Q{session['questions_asked']}: {user_msg}")

            session["questions_asked"] += 1

            # --- ASK 5 QUESTIONS (Dynamic) ---
            if session["questions_asked"] <= 5:
                # Ask Groq to generate the NEXT relevant question
                history_text = "\n".join(session["symptoms_collected"])
                
                system_msg = f"""You are a doctor interviewing a patient. 
                Based on the patient's history below, ask the ONE most important follow-up question to narrow down the diagnosis.
                
                Patient History:
                {history_text}
                
                Rules:
                - Ask ONLY ONE question.
                - Be concise and professional.
                - If they mentioned pain, ask about severity or location.
                - If they mentioned fever, ask about duration or other symptoms.
                - Do NOT give a diagnosis yet.
                """
                
                messages = [{"role": "system", "content": system_msg}]
                
                response = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages,
                    temperature=0.5,
                    max_tokens=60
                )
                
                next_question = response.choices[0].message.content
                
                return {
                    "text": f"❓ {next_question}",
                    "source": "system",
                    "questions_asked": session["questions_asked"]
                }
            
            # --- FINAL STEP: GENERATE DIAGNOSIS (After 5 Qs) ---
            else:
                session["diagnosis_made"] = True
                
                history_text = "\n".join(session["symptoms_collected"])
                system_msg = f"""You are an expert Medical AI. 
                Based on the interview below, identify the MOST LIKELY suspected condition and the Medical Specialist they should see.

                Interview:
                {history_text}

                Strictly follow this format:
                🔬 **Possible Cause:** [Name of condition]
                📝 **Explanation:** [1 sentence explanation]
                👨‍⚕️ **Recommended Specialist:** [Specialist Name]
                ⚠️ **Advice:** [1 short safety warning]
                """

                messages = [{"role": "system", "content": system_msg}]
                
                response = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages,
                    temperature=0.3,
                    max_tokens=250
                )
                
                diagnosis_text = response.choices[0].message.content
                specialty = infer_specialty_from_text(diagnosis_text)
                diagnosis_text += f"\n\n👇 **Click below to find a {specialty} near you.**"

                # Reset
                session["questions_asked"] = 0 
                session["symptoms_collected"] = []
                session["diagnosis_made"] = False

                return {
                    "text": diagnosis_text,
                    "source": "diagnosis",
                    "show_specialty_button": True,
                    "specialty": specialty,
                    "specialty_link": f"/doctors?specialty={specialty}",
                    "diagnosis_complete": True
                }

        # 5. GENERAL CHAT (Fallback)
        messages = [
            {"role": "system", "content": "You are Medibot. Be helpful and concise."}
        ] + session["history"][-4:] + [{"role": "user", "content": user_msg}]

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=150
        )
        ai_response = response.choices[0].message.content
        
        session["history"].append({"role": "user", "content": user_msg})
        session["history"].append({"role": "assistant", "content": ai_response})

        return {
            "text": ai_response,
            "source": "api",
            "show_specialty_button": False
        }

    except Exception as e:
        print(f"❌ Error: {e}")
        return {"text": "I encountered an error. Please try asking again.", "source": "error"}

@app.get("/doctors")
def doctors_endpoint(specialty: str = Query(default=None), city: str = Query(default=None)):
    docs = find_doctors_from_csv(specialty=specialty, city=city)
    return {
        "doctors": docs,
        "count": len(docs),
        "specialty": specialty,
        "city": city
    }

@app.post("/reset")
async def reset_session(session_id: str = "default"):
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {"status": "success", "message": "Session reset"}

@app.get("/")
def root():
    return {"status": "running"}

if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Medibot Dynamic Flow Running...")
    uvicorn.run(app, host="0.0.0.0", port=8000)