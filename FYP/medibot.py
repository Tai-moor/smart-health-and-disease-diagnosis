import os
import csv
import re
import streamlit as st
from dotenv import load_dotenv, find_dotenv
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains import create_retrieval_chain                          # FIXED: was langchain_classic
from langchain.chains.combine_documents import create_stuff_documents_chain  # FIXED: was langchain_classic
from langchain_core.tools import tool
from langchain.agents import create_tool_calling_agent, AgentExecutor        # FIXED: was langchain_classic
from langchain_core.messages import HumanMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from google.generativeai.types import HarmCategory, HarmBlockThreshold       # FIXED: proper safety imports
from sentence_transformers import SentenceTransformer, util
import pandas as pd

# =============================
# Environment & Config
# =============================
load_dotenv(find_dotenv())

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
AGENT_MODEL = "gemini-2.0-flash"
VECTORSTORE_PATH = "vectorstore/db_faiss"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
DOCTORS_CSV = "data/doctors.csv"

# FIXED: Use proper HarmCategory enums instead of raw integers
SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

# =============================
# Semantic Mapping Model
# =============================
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

SPECIALTY_DESCRIPTIONS = {
    "Cardiologist": "Heart specialist, cardiology, cardiac doctor, heart problems, chest pain, heart attack",
    "Dentist": "Teeth doctor, dental care, tooth problems, gum issues, cavities, oral health",
    "Dermatologist": "Skin doctor, acne, rash, eczema, skin problems, dermatology, moles",
    "Pediatrician": "Child doctor, pediatrician, baby, kids, children, infant care, vaccinations",
    "Gynecologist": "Women doctor, pregnancy, gynecologist, obgyn, women's health, menstrual issues",
    "Neurologist": "Brain specialist, nerve doctor, headache, seizure, neurologist, stroke, epilepsy",
    "Orthopedic Surgeon": "Bone, joint, fracture, orthopedic surgeon, back pain, arthritis, sports injuries",
    "ENT Specialist": "Ear, nose, throat, ENT, hearing, tonsils, sinus, allergies",
    "Urologist": "Urinary, kidney, bladder, urologist, urine problems, prostate, incontinence",
    "Endocrinologist": "Hormone, thyroid, diabetes, endocrinologist, metabolism, glands",
    "Psychiatrist": "Mental health, depression, anxiety, stress, psychiatrist, therapy, counseling",
    "Pulmonologist": "Lung specialist, breathing problems, asthma, pulmonologist, COPD, pneumonia",
    "Oncologist": "Cancer, tumor, oncologist, oncology, chemotherapy, radiation"
}

def map_input_to_specialty_semantic(user_input: str) -> str:
    user_emb = embedding_model.encode(user_input, convert_to_tensor=True)
    best_score = 0
    best_specialty = None
    for specialty, desc in SPECIALTY_DESCRIPTIONS.items():
        desc_emb = embedding_model.encode(desc, convert_to_tensor=True)
        score = util.pytorch_cos_sim(user_emb, desc_emb).item()
        if score > best_score:
            best_score = score
            best_specialty = specialty
    if best_score >= 0.4:
        return best_specialty
    return None

# =============================
# Helper Functions
# =============================
def is_greeting(text: str) -> bool:
    greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "howdy"]
    return any(greet in text.lower() for greet in greetings)

def check_relevance_via_vectorstore(query: str, retrieval_chain) -> bool:
    """Check if the query is relevant by querying the vectorstore."""
    try:
        response = retrieval_chain.invoke({"input": query})
        answer = response.get("answer", "").strip()
        if len(answer) > 50 and "i don't know" not in answer.lower():
            return True
        return False
    except Exception:
        return False

def extract_disease_name(query: str) -> str:
    """Extract disease name from queries like 'tell about the X' or 'what is X'."""
    patterns = [
        r"(?:tell|can you tell) (?:me )?about (?:the )?([a-zA-Z\s]+)",
        r"what is ([a-zA-Z\s]+)",
        r"information on ([a-zA-Z\s]+)",
        r"about ([a-zA-Z\s]+)"
    ]
    for pattern in patterns:
        match = re.search(pattern, query.lower())
        if match:
            disease = match.group(1).strip()
            if len(disease.split()) <= 4:
                return disease
    return None

# =============================
# Doctor Lookup Tool
# =============================
@tool(description="Find a doctor by specialty and city. Returns recommendations based on priority (higher priority shown first).")
def doctor_lookup(user_specialty: str, city: str) -> dict:
    if not user_specialty or not city:
        return {"error": "Please provide both the specialty and city."}

    city_input = city.lower().strip()
    specialty_mapped = map_input_to_specialty_semantic(user_specialty)

    if not specialty_mapped:
        return {"error": f"Sorry, I could not understand the specialty from '{user_specialty}'. Try being more specific, e.g., 'heart doctor'."}

    results = []

    try:
        with open(DOCTORS_CSV, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                if specialty_mapped.lower() in row['specialty'].lower() and city_input == row['city'].lower():
                    row_priority = int(row.get("priority", 0))
                    results.append({
                        "name": row["name"],
                        "specialty": row["specialty"],
                        "city": row["city"],
                        "address": row["address"],
                        "phone": row["phone"],
                        "priority": row_priority
                    })

        if not results:
            alt_cities = set()
            with open(DOCTORS_CSV, mode='r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    if specialty_mapped.lower() in row['specialty'].lower():
                        alt_cities.add(row['city'].title())
            alt_msg = (
                f" Try nearby cities: {', '.join(list(alt_cities)[:3])}."
                if alt_cities else ""
            )
            return {"error": f"No doctors found for '{specialty_mapped}' in '{city_input.title()}'.{alt_msg}"}

        # Sort by priority descending
        results.sort(key=lambda x: -x["priority"])

        # Top 3 recommendations with labels
        top_recs = results[:3]
        rec_lines = []
        for r in top_recs:
            if r["priority"] == 5:
                label = "Most Recommended"
            elif r["priority"] == 4:
                label = "Recommended"
            elif r["priority"] == 3:
                label = "Good Option"
            else:
                label = "Available"
            rec_lines.append(
                f"- {r['name']} ({r['specialty']}, {label}) - Address: {r['address']}, Phone: {r['phone']}"
            )
        rec_text = "Top Recommendations:\n" + "\n".join(rec_lines)

        return {"recommendations": rec_text}

    except Exception as e:
        return {"error": f"Error reading doctor data: {e}"}

# =============================
# Medical Knowledge Retrieval
# =============================
embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
vectorstore = FAISS.load_local(VECTORSTORE_PATH, embeddings, allow_dangerous_deserialization=True)
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

qa_prompt = ChatPromptTemplate.from_template("""
You are a professional medical assistant. Answer the following medical question based ONLY on the provided context.
Be informative, accurate, and professional. If the context does not contain relevant information about the query,
respond with "I don't know" and do not make up information.

Context: {context}
Question: {input}

Answer:
""")

# Build retrieval chain at module level (not inside main())
_llm_for_chain = ChatGoogleGenerativeAI(
    model=AGENT_MODEL,
    google_api_key=GOOGLE_API_KEY,
    safety_settings=SAFETY_SETTINGS
)
combine_docs_chain = create_stuff_documents_chain(_llm_for_chain, qa_prompt)
retrieval_chain = create_retrieval_chain(retriever, combine_docs_chain)

# =============================
# Tools
# =============================
@tool(description="Retrieve detailed information about a specific disease from the medical knowledge base.")
def disease_info(disease_name: str) -> str:
    """Retrieve information about a disease by querying each section separately."""
    if not disease_name:
        return "Please specify a disease name."

    sections = {
        "Description": f"What is the description of {disease_name}?",
        "Causes": f"What are the causes of {disease_name}?",
        "Symptoms": f"What are the symptoms of {disease_name}?",
        "Prevention": f"What are the prevention methods for {disease_name}?"
    }

    structured_info = []

    try:
        for section, query in sections.items():
            response = retrieval_chain.invoke({"input": query})
            answer = response.get("answer", "").strip()
            if answer and len(answer) > 10 and "i don't know" not in answer.lower():
                structured_info.append(f"**{section}:**\n{answer}")

        if not structured_info:
            return f"I don't have information on '{disease_name}' in my knowledge base."

        full_answer = "\n\n".join(structured_info)
        return (
            f"**Information on {disease_name.title()}:**\n\n{full_answer}\n\n"
            f"*Note: This is based on general medical knowledge. Consult a doctor for personalized advice.*"
        )
    except Exception as e:
        return f"Error retrieving information: {e}"

@tool(description="List diseases available in the medical knowledge base.")
def list_diseases() -> str:
    """List diseases by querying the vectorstore for a broad medical term."""
    try:
        docs = retriever.invoke("list of diseases medical conditions")
        # Extract any disease-like proper nouns from retrieved docs
        seen = set()
        lines = []
        for doc in docs:
            # Pull first line of each chunk as a hint at its topic
            first_line = doc.page_content.strip().split("\n")[0][:80]
            if first_line and first_line not in seen:
                seen.add(first_line)
                lines.append(f"- {first_line}")
        if lines:
            return "Sample topics in my knowledge base:\n" + "\n".join(lines[:10])
        return "Knowledge base is loaded but topics could not be listed. Try asking about a specific disease."
    except Exception as e:
        return f"Error listing diseases: {e}"

# =============================
# Streamlit App
# =============================
def main():
    st.set_page_config(page_title="Medibot Pro", page_icon="🧑‍⚕️")
    st.title("Medibot Pro")
    st.markdown("AI assistant for medical questions, symptoms, doctor lookup, and more. Ask me anything!")

    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []

    # FIXED: Cache agent in session_state — don't recreate on every rerun
    if "agent_executor" not in st.session_state:
        llm = ChatGoogleGenerativeAI(
            model=AGENT_MODEL,
            google_api_key=GOOGLE_API_KEY,
            safety_settings=SAFETY_SETTINGS
        )
        tools = [doctor_lookup, disease_info, list_diseases]

        system_prompt = (
            "You are Medibot, a professional medical assistant. "
            "Answer medical queries, provide doctor info, and use tools when needed. "
            "For doctor lookups, extract specialty and city from user input. "
            "For disease queries, use the disease_info tool. "
            "If unsure, say 'I don't know'. Always provide helpful responses."
        )
        agent_prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])

        agent = create_tool_calling_agent(llm, tools, agent_prompt)
        st.session_state.agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

    agent_executor = st.session_state.agent_executor

    # Display chat messages
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if "extra" in msg and "recommendations" in msg["extra"]:
                st.write(msg["extra"]["recommendations"])

    # Handle user input
    if user_input := st.chat_input("Enter your query..."):
        st.session_state.messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        with st.chat_message("assistant"):
            with st.spinner("Processing..."):
                try:
                    extra_data = None

                    if is_greeting(user_input):
                        reply = "Hello! How can I help you with a medical query, doctor search, or disease information today?"
                    else:
                        # Check relevance via vectorstore
                        if not check_relevance_via_vectorstore(user_input, retrieval_chain):
                            reply = (
                                "I can only answer medical-related questions, assist with doctor lookups, "
                                "or provide disease information. Please ask something related to health or medicine."
                            )
                        else:
                            # Check for disease query and handle directly
                            disease_name = extract_disease_name(user_input)
                            if disease_name:
                                reply = disease_info.invoke({"disease_name": disease_name})
                            else:
                                # Use agent for other queries
                                response = agent_executor.invoke({
                                    "input": user_input,
                                    "chat_history": st.session_state.chat_history
                                })
                                reply = response.get("output", "I could not process your request.")

                                # Parse doctor lookup results for display
                                if "doctor_lookup" in str(response) or "doctor" in user_input.lower():
                                    specialty_match = re.search(r"(\w+) doctor", user_input.lower())
                                    city_match = re.search(r"in (\w+)", user_input.lower())
                                    if specialty_match and city_match:
                                        tool_result = doctor_lookup.invoke({
                                            "user_specialty": specialty_match.group(1),
                                            "city": city_match.group(1)
                                        })
                                        if "error" not in tool_result:
                                            extra_data = tool_result
                                            reply = "Here are the doctors I found based on your query:"
                                        else:
                                            reply = tool_result["error"]

                    # Append to messages
                    msg_dict = {"role": "assistant", "content": reply}
                    if extra_data:
                        msg_dict["extra"] = extra_data
                    st.session_state.messages.append(msg_dict)
                    st.session_state.chat_history.append(HumanMessage(content=user_input))
                    st.session_state.chat_history.append(AIMessage(content=reply))

                    st.markdown(reply)
                    if extra_data and "recommendations" in extra_data:
                        st.write(extra_data["recommendations"])

                except Exception as e:
                    st.error(f"Error: {e}")

if __name__ == "__main__":
    main()