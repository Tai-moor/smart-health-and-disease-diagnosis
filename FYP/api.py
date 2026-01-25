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
from fuzzywuzzy import process # For fixing typos

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

# =============================
# 1. Config & Setup
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

# Kaggle Data Paths
MODEL_PATH = os.path.join(BASE_DIR, "data", "disease_model.pkl")
COLS_PATH = os.path.join(BASE_DIR, "data", "symptom_columns.pkl")
LE_PATH = os.path.join(BASE_DIR, "data", "label_encoder.pkl")

# Initialize Groq
groq_client = Groq(api_key=GROQ_API_KEY)

# State
chat_history = [] 
conversation_state = {
    "questions_asked": 0,
    "symptom_topic": None,
    "enough_info": False,
    "user_city": None
}

# =============================
# 2. Load ML Model & Knowledge Base (Kaggle)
# =============================
print("=" * 60)
print("🧠 Loading ML Models & Knowledge Base...")

# Global Variables for Data
ai_model = None
symptom_cols = []
label_encoder = None
readable_symptoms = {}
disease_names_list = [] # Used for spell checking

try:
    # Load ML Files
    if os.path.exists(MODEL_PATH):
        ai_model = joblib.load(MODEL_PATH)
        symptom_cols = joblib.load(COLS_PATH)
        label_encoder = joblib.load(LE_PATH)
        
        # Create readable symptoms map (sharp_chest_pain -> Sharp Chest Pain)
        readable_symptoms = {s.replace("_", " ").title(): s for s in symptom_cols}
        print("✅ XGBoost Model Loaded")
    else:
        print("⚠️ ML Model files missing (Run train script)")

    # Load Knowledge CSVs
    desc_df = pd.read_csv(os.path.join(BASE_DIR, "data", "description.csv"))
    meds_df = pd.read_csv(os.path.join(BASE_DIR, "data", "medications.csv"))
    diets_df = pd.read_csv(os.path.join(BASE_DIR, "data", "diets.csv"))
    prec_df = pd.read_csv(os.path.join(BASE_DIR, "data", "precautions.csv"))
    work_df = pd.read_csv(os.path.join(BASE_DIR, "data", "workout.csv"))
    
    # Extract Disease Names for Spell Checking
    disease_names_list = desc_df.iloc[:, 0].dropna().tolist()
    print("✅ Knowledge Base CSVs Loaded")

except Exception as e:
    print(f"❌ Error loading Data: {e}")

# =============================
# 3. Load RAG (Existing Functionality)
# =============================
print("📚 Loading RAG Vectorstore...")
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={'device': 'cpu'}
)

try:
    vectorstore = FAISS.load_local(VECTORSTORE_PATH, embeddings, allow_dangerous_deserialization=True)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
    print("✅ RAG System loaded!")
    VECTORSTORE_LOADED = True
except Exception as e:
    print(f"⚠️ Vectorstore not loaded: {e}")
    retriever = None
    VECTORSTORE_LOADED = False

print("=" * 60)

# =============================
# 4. Helper Functions
# =============================

def get_csv_info(df, disease):
    """Get info from Kaggle CSVs"""
    if df is None: return []
    # Match disease name (case insensitive)
    row = df[df.iloc[:, 0].str.lower() == disease.lower()]
    if not row.empty:
        return row.iloc[0, 1:].dropna().tolist()
    return []

def fix_spelling(query: str) -> str:
    """
    Fixes typos in disease names before sending to RAG.
    Example: 'diabteas' -> 'Diabetes '
    """
    if not disease_names_list: return query
    
    # Extract best match from the description.csv list
    # limit=1 returns the single best match tuple: [('Diabetes ', 95)]
    match = process.extractOne(query, disease_names_list)
    
    # If match score is high (>80), assume typo and correct it
    if match and match[1] > 80:
        print(f"✨ Auto-Corrected: '{query}' -> '{match[0]}'")
        return match[0]
        
    return query

def get_disease_info_from_rag(query: str) -> dict:
    if not retriever:
        return {"success": False, "error": "RAG not loaded"}
    
    try:
        # 1. FIX SPELLING FIRST
        corrected_query = fix_spelling(query)
        
        # 2. Search RAG with corrected term
        print(f"🔍 RAG Query: {corrected_query}")
        docs = retriever.invoke(corrected_query)
        
        if not docs:
            return {"success": False, "error": "No results"}
        
        content = docs[0].page_content.strip()[:700]
        return {"success": True, "content": content}
        
    except Exception as e:
        return {"success": False, "error": str(e)}

# =============================
# 5. Endpoints
# =============================

# --- A. SYMPTOM SEARCH (For React Dropdown/Argue) ---
class SearchRequest(BaseModel):
    query: str

@app.post("/search_symptom")
def search_symptom(request: SearchRequest):
    """Finds valid symptoms for the ML model based on user input"""
    query = request.query.lower()
    matches = []
    
    # 1. Keyword Match
    for label, internal in readable_symptoms.items():
        if query in label.lower():
            matches.append({"label": label, "value": internal})
    
    # 2. Fuzzy Match (if few results)
    if len(matches) < 5:
        fuzzy_results = process.extract(query, list(readable_symptoms.keys()), limit=5)
        for label, score in fuzzy_results:
            if score > 60:
                if not any(m['label'] == label for m in matches):
                    matches.append({"label": label, "value": readable_symptoms[label]})
    
    return {"matches": matches}

# --- B. PREDICTION (ML Model) ---
class SymptomRequest(BaseModel):
    selected_symptoms: list[str]

@app.post("/predict")
def predict_disease(request: SymptomRequest):
    if not ai_model or not label_encoder:
        return {"error": "Model not loaded"}

    # 1. Prepare Input
    input_data = pd.DataFrame(0, index=[0], columns=symptom_cols)
    for s in request.selected_symptoms:
        if s in symptom_cols:
            input_data[s] = 1

    # 2. Predict Probabilities
    probs = ai_model.predict_proba(input_data)[0]
    
    # 3. Get Top 3
    top_3_indices = np.argsort(probs)[-3:][::-1]
    
    results = []
    for index in top_3_indices:
        confidence = probs[index] * 100
        if confidence > 1.0: # Filter low confidence
            disease_name = label_encoder.inverse_transform([index])[0]
            
            # Fetch details from CSVs
            results.append({
                "disease": disease_name,
                "confidence": f"{confidence:.2f}%",
                "description": get_csv_info(desc_df, disease_name)[0] if get_csv_info(desc_df, disease_name) else "No description available.",
                "medications": get_csv_info(meds_df, disease_name),
                "diets": get_csv_info(diets_df, disease_name),
                "workout": get_csv_info(work_df, disease_name),
                "precautions": get_csv_info(prec_df, disease_name)
            })

    return {"top_diagnosis": results}

# --- C. CHAT (RAG + Groq) ---
class UserQuery(BaseModel):
    message: str

@app.post("/chat")
async def chat_endpoint(query: UserQuery):
    try:
        global chat_history, conversation_state
        user_msg = query.message.strip()
        
        # ... (Existing logic for City/Specialty detection remains here) ...
        # (Omitting for brevity, paste your previous detection logic if needed)

        # RAG Logic with Spell Fix
        rag_content = None
        rag_used = False
        
        # Check simple keywords to trigger RAG
        if any(w in user_msg.lower() for w in ["what is", "tell me about", "describe", "symptoms of"]):
            rag_result = get_disease_info_from_rag(user_msg)
            if rag_result["success"]:
                rag_content = rag_result["content"]
                rag_used = True

        # Build Groq Prompt
        system_msg = "You are Medibot. "
        if rag_content:
            system_msg += f"Use this Encyclopedia info: {rag_content}. Cite it."
        else:
            system_msg += "Answer generally. If unsure, advise seeing a doctor."

        messages = [{"role": "system", "content": system_msg}] + chat_history[-6:] + [{"role": "user", "content": user_msg}]

        # Call Groq
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7
        )
        ai_response = response.choices[0].message.content

        # Update History
        chat_history.append({"role": "user", "content": user_msg})
        chat_history.append({"role": "assistant", "content": ai_response})

        return {
            "text": ai_response,
            "rag_used": rag_used,
            "source": "rag" if rag_used else "api"
        }

    except Exception as e:
        print(f"❌ Error: {e}")
        return {"text": "Error processing request."}

@app.get("/")
def root():
    return {"status": "Active", "ml_model": "Loaded" if ai_model else "Not Loaded"}

if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Medibot Unified Server Running...")
    uvicorn.run(app, host="0.0.0.0", port=8000)