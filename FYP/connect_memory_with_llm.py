import os
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_MODEL_NAME = "llama-3.1-8b-instant"
DB_FAISS_PATH = "vectorstore/db_faiss"
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

PROMPT_TEMPLATE = """
Use the pieces of information provided in the context to answer the question.
If you don't know the answer, just say that you don't know.
Don't provide anything outside the given context.

Context: {context}
Question: {input}

Start the answer directly. No small talk please.
"""

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

def main():
    if not GROQ_API_KEY:
        print("❌ GROQ_API_KEY not found in .env file")
        return

    if not os.path.exists(DB_FAISS_PATH):
        print(f"❌ Vector database not found at: {DB_FAISS_PATH}")
        print("💡 Run create_vectorstore.py first.")
        return

    print("Loading embedding model...")
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)

    print("Loading vector database...")
    db = FAISS.load_local(DB_FAISS_PATH, embeddings, allow_dangerous_deserialization=True)
    retriever = db.as_retriever(search_kwargs={'k': 3})

    llm = ChatGroq(model_name=GROQ_MODEL_NAME, api_key=GROQ_API_KEY)
    prompt = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)

    # Modern LCEL chain — no deprecated imports needed
    chain = (
        {"context": retriever | format_docs, "input": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    print("✅ Chatbot ready. Type your query.\n")

    while True:
        user_query = input("Write Query Here (or 'exit' to quit): ").strip()
        if user_query.lower() == 'exit':
            print("Goodbye!")
            break
        if not user_query:
            continue

        print("\n--- RESULT ---")
        response = chain.invoke(user_query)
        print(response)
        print("---------------\n")

if __name__ == "__main__":
    main()