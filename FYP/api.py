import os
import csv
import difflib
from fastapi import FastAPI
from fastapi import Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv, find_dotenv

# ✅ LIGHTWEIGHT IMPORTS
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings, HarmBlockThreshold, HarmCategory
from langchain_core.messages import HumanMessage, AIMessage 

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

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

# 🟢 FIXED: Use the standard stable model
AGENT_MODEL = "gemini-flash-latest"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VECTORSTORE_PATH = os.path.join(BASE_DIR, "vectorstore", "db_faiss")
DOCTORS_CSV = os.path.join(BASE_DIR, "data", "doctors.csv")

# Disable Safety Filters
SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

chat_history = [] 
conversation_state = {
    "questions_asked": 0,
    "symptom_topic": None,
    "enough_info": False,
    "user_city": None
}

# =============================
# Specialty inference (deterministic, symptom-first)
# =============================

SPECIALTY_KEYWORDS = {
    "Cardiologist": [
        "chest pain", "chest tight", "chest pressure", "heart", "palpitation", "cardiac",
        "high blood pressure", "hypertension", "shortness of breath", "angina"
    ],
    "Pulmonologist": [
        "breathing", "breath", "wheezing", "asthma", "cough", "lungs", "copd", "pneumonia"
    ],
    "Neurologist": [
        "headache", "migraine", "seizure", "stroke", "numb", "tingling", "dizziness", "vertigo"
    ],
    "Dentist": [
        "tooth", "teeth", "toothache", "gum", "cavity", "jaw pain", "dental"
    ],
    "Dermatologist": [
        "skin", "rash", "acne", "eczema", "itch", "hives", "mole"
    ],
    "ENT Specialist": [
        "ear", "throat", "tonsil", "sinus", "nose", "hearing", "ear pain", "sore throat"
    ],
    "Orthopedic Surgeon": [
        "knee", "joint", "bone", "fracture", "back pain", "shoulder", "sprain", "neck pain", "ankle"
    ],
    "Gynecologist": [
        "pregnancy", "period", "menstrual", "vaginal", "pelvic pain", "pregnant"
    ],
    "Pediatrician": [
        "baby", "infant", "child", "kid", "vaccination", "toddler"
    ],
    "Urologist": [
        "urine", "urinary", "kidney", "bladder", "prostate"
    ],
    "Endocrinologist": [
        "diabetes", "thyroid", "hormone", "blood sugar"
    ],
    "Psychiatrist": [
        "anxiety", "depression", "panic", "stress", "insomnia", "mental health"
    ],
    "Gastroenterologist": [
        "stomach", "abdomen", "abdominal pain", "digestive", "nausea", "vomiting", "diarrhea"
    ],
    "Rheumatologist": [
        "arthritis", "joint pain", "autoimmune", "lupus"
    ]
}

def infer_specialty_from_text(text: str) -> str | None:
    if not text:
        return None
    t = text.lower()
    # Prefer more serious / high-priority matches first by ordering in dict above
    for specialty, keywords in SPECIALTY_KEYWORDS.items():
        for kw in keywords:
            if kw in t:
                return specialty
    return None

def extract_city_from_text(text: str) -> str | None:
    """Extract city name from user message"""
    common_cities = [
        "islamabad", "rawalpindi", "lahore", "karachi", "peshawar", 
        "quetta", "multan", "faisalabad", "sialkot", "gujranwala"
    ]
    t = text.lower()
    for city in common_cities:
        if city in t:
            return city.title()
    return None

def _read_doctors_csv() -> list[dict]:
    with open(DOCTORS_CSV, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for r in reader:
            # normalize priority to int if possible
            try:
                r["priority"] = int(r.get("priority", 0))
            except Exception:
                r["priority"] = 0
            rows.append(r)
        return rows

def find_doctors_from_csv(specialty: str | None = None, city: str | None = None, limit: int = 20) -> list[dict]:
    specialty_in = (specialty or "").strip().lower()
    city_in = (city or "").strip().lower()

    rows = _read_doctors_csv()

    # Fuzzy match city if provided
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

    out.sort(key=lambda x: -int(x.get("priority", 0)))
    return out[: max(1, min(limit, 100))]

# =============================
# 2. Load Models
# =============================
# 🟢 FIXED: Use the standard stable embedding model
embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")

try:
    vectorstore = FAISS.load_local(VECTORSTORE_PATH, embeddings, allow_dangerous_deserialization=True)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
except Exception as e:
    print(f"Warning: Could not load vectorstore. Error: {e}")
    retriever = None

# =============================
# 3. Tools
# =============================

@tool
def doctor_lookup(user_specialty: str, city: str) -> dict:
    """Find a doctor by specialty and city. Only use after asking 2-3 clarifying questions."""
    if not user_specialty or not city:
        return {"error": "Please provide both specialty and city."}

    city_in = city.lower().strip()
    spec_in = user_specialty.lower().strip()
    
    results = []
    all_cities = set() 

    try:
        with open(DOCTORS_CSV, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            rows = list(reader)
            
            for row in rows:
                if row['city']:
                    all_cities.add(row['city'].lower())

            # Fuzzy Match City
            if city_in not in all_cities:
                matches = difflib.get_close_matches(city_in, list(all_cities), n=1, cutoff=0.6)
                if matches:
                    city_in = matches[0]

            for row in rows:
                if spec_in in row['specialty'].lower() and city_in == row['city'].lower():
                    results.append(row)

        if not results:
            return {"error": f"No {user_specialty} found in {city_in.title()}."}

        rec_text = f"**Recommended {user_specialty}s in {city_in.title()}:**\n\n"
        for r in results[:3]:
            phone = r.get('phone', 'N/A')
            rec_text += f"👨‍⚕️ **{r['name']}**\n📍 {r['address']}\n📞 {phone}\n\n"
        
        # Return clean specialty for button logic
        found_specialty = results[0]['specialty'] if results else user_specialty
        return {"recommendations": rec_text, "specialty_found": found_specialty}

    except Exception as e:
        return {"error": str(e)}

@tool
def disease_info(query: str) -> str:
    """Find disease info from the encyclopedia."""
    if not retriever: return "Knowledge base not loaded."
    docs = retriever.invoke(query)
    if not docs: return "No information found in encyclopedia."
    return f"ℹ️ **Medical Info:** {docs[0].page_content[:400]}..."

@tool
def list_diseases() -> str:
    """Returns a list of diseases found in the uploaded Encyclopedia."""
    return "I can discuss diseases found in the uploaded Encyclopedia."

# =============================
# 4. Initialize Agent
# =============================
llm = ChatGoogleGenerativeAI(model=AGENT_MODEL, google_api_key=GOOGLE_API_KEY, safety_settings=SAFETY_SETTINGS)
tools = [doctor_lookup, disease_info, list_diseases]

system_prompt = """
You are Medibot, a concise and empathetic AI medical assistant. 

**CRITICAL RULES:**

1. **Keep responses SHORT** (2-4 sentences max)
2. **NEVER suggest doctors immediately** - Always ask 2-3 questions first
3. **Ask ONE question at a time** - Don't overwhelm users
4. **Question sequence:**
   - First: Duration ("How long have you had this?")
   - Second: Severity or other symptoms ("How severe is it? Any other symptoms?")
   - Third: If needed, ask about triggers or medical history

5. **After 2-3 questions:**
   - Give brief advice (1-2 sentences)
   - Suggest the specialist type
   - Ask for their city if not provided

6. **For doctor lookup:**
   - Only use `doctor_lookup` after asking questions AND getting city
   - Always show Name, Address, Phone clearly

**Example Flow:**
User: "I have back pain"
You: "I'm sorry to hear that. How long have you been experiencing this back pain?"

User: "3 days"
You: "Is the pain constant or does it come and go? Do you have any numbness?"

User: "Constant, no numbness"
You: "This could be a muscle strain. I recommend seeing an Orthopedic Surgeon. Which city are you in?"

**Remember:**
- Be empathetic but brief
- One question at a time
- No long explanations
- Get to the point quickly
"""

agent_prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, agent_prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# =============================
# 5. API Endpoint
# =============================
class UserQuery(BaseModel):
    message: str

@app.post("/chat")
async def chat_endpoint(query: UserQuery):
    try:
        global chat_history, conversation_state
        
        if len(chat_history) > 10:
            chat_history = chat_history[-10:]

        user_msg_lower = query.message.lower()
        
        # Detect city in user message
        detected_city = extract_city_from_text(query.message)
        if detected_city:
            conversation_state["user_city"] = detected_city
        
        # Check if this is a new symptom topic
        has_symptom = any(kw in user_msg_lower for specialty_kws in SPECIALTY_KEYWORDS.values() for kw in specialty_kws)
        
        # Detect specialty from user message
        detected_specialty = infer_specialty_from_text(query.message)
        
        # Reset on new topic or greeting
        if has_symptom and conversation_state["questions_asked"] == 0:
            conversation_state["symptom_topic"] = detected_specialty
        elif any(word in user_msg_lower for word in ["hello", "hi", "hey", "start"]):
            conversation_state = {"questions_asked": 0, "symptom_topic": None, "enough_info": False, "user_city": None}

        response = agent_executor.invoke({
            "input": query.message,
            "chat_history": chat_history 
        })
        
        output_text = response.get("output", "I could not process that.")

        chat_history.append(HumanMessage(content=query.message))
        chat_history.append(AIMessage(content=output_text))

        # Count questions asked by bot
        if "?" in output_text:
            # Don't count city questions
            if not any(phrase in output_text.lower() for phrase in ["which city", "what city", "where are you", "your city", "your location"]):
                conversation_state["questions_asked"] += 1
        
        # Check if doctor lookup was called
        if "recommended" in output_text.lower() or "📞" in output_text:
            conversation_state["enough_info"] = True

        # Determine specialty to show button
        specialty_for_button = None
        
        # Show specialty button if:
        # 1. Detected from user message (immediate)
        # 2. OR from conversation state
        # 3. OR after enough questions asked
        if detected_specialty:
            specialty_for_button = detected_specialty
        elif conversation_state["symptom_topic"]:
            specialty_for_button = conversation_state["symptom_topic"]
        
        # Determine if ready to show doctors
        ready_for_doctors = (
            conversation_state["questions_asked"] >= 2 or 
            conversation_state["enough_info"] or
            ("recommend" in user_msg_lower and "doctor" in user_msg_lower)
        )

        return {
            "text": output_text, 
            "specialty": specialty_for_button,  # Always return specialty for button
            "questions_asked": conversation_state["questions_asked"],
            "ready_for_doctors": ready_for_doctors,  # Signal when to enable "See Doctors" button
            "city": conversation_state.get("user_city")
        }

    except Exception as e:
        print(f"Error: {e}")
        return {"text": "Error processing your request.", "specialty": None}

@app.get("/doctors")
def doctors_endpoint(
    specialty: str | None = Query(default=None),
    city: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Return doctors from data/doctors.csv"""
    docs = find_doctors_from_csv(specialty=specialty, city=city, limit=limit)
    return {"doctors": docs, "count": len(docs), "specialty": specialty, "city": city}

@app.post("/reset")
async def reset_conversation():
    """Reset the conversation state"""
    global chat_history, conversation_state
    chat_history = []
    conversation_state = {"questions_asked": 0, "symptom_topic": None, "enough_info": False, "user_city": None}
    return {"status": "Conversation reset successfully"}