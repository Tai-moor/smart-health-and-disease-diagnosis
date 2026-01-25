import os
import csv
import difflib
from fastapi import FastAPI, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv, find_dotenv
from groq import Groq  # FREE API with high limits!

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

# Use Groq instead of Google!
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VECTORSTORE_PATH = os.path.join(BASE_DIR, "vectorstore", "db_faiss")
DOCTORS_CSV = os.path.join(BASE_DIR, "data", "doctors.csv")

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

chat_history = [] 
conversation_state = {
    "questions_asked": 0,
    "symptom_topic": None,
    "enough_info": False,
    "user_city": None
}

# =============================
# Specialty Keywords
# =============================
SPECIALTY_KEYWORDS = {
    "Cardiologist": ["chest pain", "heart", "palpitation", "cardiac", "blood pressure"],
    "Pulmonologist": ["breathing", "breath", "cough", "lungs", "asthma"],
    "Neurologist": ["headache", "migraine", "dizziness", "numb", "tingling"],
    "Dentist": ["tooth", "teeth", "gum", "cavity", "jaw pain"],
    "Dermatologist": ["skin", "rash", "acne", "eczema"],
    "ENT Specialist": ["ear", "throat", "nose", "sinus", "hearing"],
    "Orthopedic Surgeon": ["knee", "joint", "bone", "back pain", "shoulder"],
    "Gynecologist": ["pregnancy", "period", "menstrual", "pelvic"],
    "Pediatrician": ["baby", "child", "kid", "infant"],
    "Urologist": ["urine", "kidney", "bladder"],
    "Gastroenterologist": ["stomach", "abdomen", "nausea", "vomiting"],
    "Endocrinologist": ["diabetes", "thyroid", "hormone"],
    "Psychiatrist": ["anxiety", "depression", "stress"]
}

def infer_specialty_from_text(text: str) -> str:
    if not text:
        return None
    t = text.lower()
    for specialty, keywords in SPECIALTY_KEYWORDS.items():
        for kw in keywords:
            if kw in t:
                return specialty
    return None

def extract_city_from_text(text: str) -> str:
    common_cities = ["islamabad", "rawalpindi", "lahore", "karachi", "peshawar"]
    t = text.lower()
    for city in common_cities:
        if city in t:
            return city.title()
    return None

# =============================
# CSV Operations
# =============================
def find_doctors_from_csv(specialty: str = None, city: str = None) -> list:
    try:
        with open(DOCTORS_CSV, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except:
        return []
    
    specialty_in = (specialty or "").strip().lower()
    city_in = (city or "").strip().lower()

    if city_in:
        all_cities = {r.get("city", "").lower() for r in rows if r.get("city")}
        if city_in not in all_cities:
            matches = difflib.get_close_matches(city_in, list(all_cities), n=1, cutoff=0.6)
            if matches:
                city_in = matches[0]

    out = []
    for r in rows:
        r_city = (r.get("city") or "").lower()
        r_spec = (r.get("specialty") or "").lower()
        if specialty_in and specialty_in not in r_spec:
            continue
        if city_in and city_in != r_city:
            continue
        out.append(r)

    return out[:20]

# =============================
# Load RAG
# =============================
print("=" * 60)
print("🚀 Starting Medibot with Groq API (FREE - High Limits)")
print("=" * 60)

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
# RAG Function
# =============================
def get_disease_info_from_rag(query: str) -> dict:
    """Get info from vectorstore using RAG"""
    if not retriever:
        return {"success": False, "content": None, "error": "RAG not loaded"}
    
    try:
        print(f"🔍 RAG Query: {query}")
        docs = retriever.invoke(query)
        
        if not docs:
            print(f"⚠️ No results")
            return {"success": False, "content": None, "error": "No results"}
        
        content = docs[0].page_content.strip()[:700]
        print(f"✅ RAG: Retrieved {len(content)} chars")
        
        return {"success": True, "content": content, "error": None}
        
    except Exception as e:
        print(f"❌ RAG Error: {e}")
        return {"success": False, "content": None, "error": str(e)}

# =============================
# AI Function using Groq
# =============================
def get_ai_response(user_message: str, history: list, rag_content: str = None) -> str:
    """Get response from Groq AI"""
    
    # Build system prompt
    system_msg = """You are Medibot, a medical assistant with RAG capabilities.

RULES:
1. If provided with [RAG_CONTENT], use it and say: "📖 From GALE Encyclopedia: [content]"
2. If no [RAG_CONTENT], provide your own knowledge and say: "🤖 AI Response: [your answer]"
3. For symptoms, ask 2-3 questions before suggesting specialists
4. Keep responses SHORT (2-3 sentences)

Examples:
User asks about disease + RAG available → "📖 From GALE Encyclopedia: [RAG content]"
User asks about disease + no RAG → "🤖 AI Response: [your knowledge]"
User says "I have back pain" → "How long have you had this?"
"""

    # Build user message
    if rag_content:
        user_msg = f"User question: {user_message}\n\n[RAG_CONTENT from medical encyclopedia]: {rag_content}\n\nProvide response using this encyclopedia content."
    else:
        user_msg = user_message
    
    # Build conversation
    messages = [{"role": "system", "content": system_msg}]
    
    # Add history
    for msg in history[-6:]:
        messages.append(msg)
    
    # Add current message
    messages.append({"role": "user", "content": user_msg})
    
    try:
        # Call Groq API
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",  # Fast and free!
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        print(f"❌ Groq Error: {e}")
        return f"Sorry, I encountered an error: {str(e)}"

# =============================
# Check if question is about disease/medical term
# =============================
def is_disease_question(text: str) -> bool:
    """Check if user is asking about a disease/condition"""
    disease_keywords = ["what is", "what are", "tell me about", "explain", "define", "describe"]
    medical_terms = ["disease", "condition", "syndrome", "disorder", "infection", "illness"]
    
    t = text.lower()
    
    # Check for disease question patterns
    if any(kw in t for kw in disease_keywords):
        return True
    
    # Check if asking about medical terms
    if any(term in t for term in medical_terms):
        return True
    
    # Check for specific disease names in specialty keywords
    for keywords_list in SPECIALTY_KEYWORDS.values():
        for kw in keywords_list:
            if kw in t and "what" in t:
                return True
    
    return False

# =============================
# API Endpoints
# =============================
class UserQuery(BaseModel):
    message: str

@app.get("/")
async def root():
    return {
        "status": "running",
        "ai_provider": "Groq (FREE)",
        "rag_enabled": VECTORSTORE_LOADED,
        "quota_limits": "14,400 requests/day (Groq free tier)"
    }

@app.post("/chat")
async def chat_endpoint(query: UserQuery):
    try:
        global chat_history, conversation_state
        
        user_msg = query.message.strip()
        user_msg_lower = user_msg.lower()
        
        # Detect city and specialty
        detected_city = extract_city_from_text(user_msg)
        if detected_city:
            conversation_state["user_city"] = detected_city
        
        detected_specialty = infer_specialty_from_text(user_msg)
        
        # Reset on greeting
        if any(word in user_msg_lower for word in ["hello", "hi", "hey"]):
            chat_history = []
            conversation_state = {"questions_asked": 0, "symptom_topic": None, "enough_info": False, "user_city": None}
        
        # Check if this is a disease question
        is_disease_q = is_disease_question(user_msg)
        rag_content = None
        rag_used = False
        
        if is_disease_q:
            # Try to get info from RAG
            rag_result = get_disease_info_from_rag(user_msg)
            if rag_result["success"]:
                rag_content = rag_result["content"]
                rag_used = True
        
        # Get AI response (with or without RAG content)
        ai_response = get_ai_response(user_msg, chat_history, rag_content)
        
        # Update history
        chat_history.append({"role": "user", "content": user_msg})
        chat_history.append({"role": "assistant", "content": ai_response})
        
        # Keep history manageable
        if len(chat_history) > 12:
            chat_history = chat_history[-12:]
        
        # Count questions
        if "?" in ai_response and not any(p in ai_response.lower() for p in ["which city", "what city"]):
            conversation_state["questions_asked"] += 1
        
        # Check if suggesting doctors
        if detected_specialty and conversation_state["questions_asked"] >= 2:
            if detected_city:
                doctors = find_doctors_from_csv(specialty=detected_specialty, city=detected_city)
                if doctors:
                    ai_response += f"\n\n**Recommended {detected_specialty}s in {detected_city}:**\n\n"
                    for doc in doctors[:3]:
                        ai_response += f"👨‍⚕️ {doc['name']}\n📍 {doc['address']}\n📞 {doc.get('phone', 'N/A')}\n\n"
                    conversation_state["enough_info"] = True
        
        # Determine source
        source = "api"
        if "📖 from gale encyclopedia" in ai_response.lower():
            source = "rag"
            rag_used = True
        elif "🤖 ai response" in ai_response.lower():
            source = "api"
        
        return {
            "text": ai_response,
            "specialty": detected_specialty,
            "questions_asked": conversation_state["questions_asked"],
            "ready_for_doctors": conversation_state.get("enough_info", False),
            "city": conversation_state.get("user_city"),
            "source": source,
            "rag_used": rag_used,
            "vectorstore_available": VECTORSTORE_LOADED,
            "ai_provider": "Groq (FREE)"
        }

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "text": "Sorry, something went wrong.",
            "specialty": None,
            "source": "error"
        }

@app.get("/doctors")
def doctors_endpoint(specialty: str = Query(default=None), city: str = Query(default=None)):
    docs = find_doctors_from_csv(specialty=specialty, city=city)
    return {"doctors": docs, "count": len(docs)}

@app.post("/reset")
async def reset_conversation():
    global chat_history, conversation_state
    chat_history = []
    conversation_state = {"questions_asked": 0, "symptom_topic": None, "enough_info": False, "user_city": None}
    return {"status": "success"}

@app.get("/rag-demo")
async def rag_demo(query: str = Query(default="diabetes")):
    if not retriever:
        return {"error": "RAG not available"}
    
    try:
        docs = retriever.invoke(query)
        results = [{"rank": i+1, "content": doc.page_content[:400]} for i, doc in enumerate(docs[:3])]
        return {"query": query, "results": results, "rag_status": "success"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Using Groq API - 14,400 requests/day FREE!")
    uvicorn.run(app, host="0.0.0.0", port=8000)