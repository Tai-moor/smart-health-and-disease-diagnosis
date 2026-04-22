import os
from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings  # FIXED: use HuggingFace to match api.py

load_dotenv()

DATA_PATH = "data/"
DB_FAISS_PATH = "vectorstore/db_faiss"

def create_vector_db():
    # Validate data folder exists
    if not os.path.exists(DATA_PATH):
        print(f"❌ Data folder '{DATA_PATH}' not found. Please create it and add your .txt files.")
        return

    print("📂 Loading text files from data/...")
    loader = DirectoryLoader(DATA_PATH, glob="*.txt", loader_cls=TextLoader)
    documents = loader.load()

    if not documents:
        print("❌ No .txt files found in data/ folder.")
        return

    print(f"✅ Loaded {len(documents)} document(s)")

    print("✂️ Splitting text...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    texts = text_splitter.split_documents(documents)
    print(f"📊 Total Chunks: {len(texts)}")

    # FIXED: Use HuggingFace embeddings (FREE, local, consistent with api.py and create_vectorstore.py)
    print("🤖 Loading embedding model (runs locally — no API key needed)...")
    try:
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        print("✅ Embedding model loaded")
    except Exception as e:
        print(f"❌ Failed to load embedding model: {e}")
        print("💡 Try: pip install sentence-transformers")
        return

    print("🚀 Building vector database...")

    try:
        # Build in one shot — much faster and simpler without API rate limits
        vector_db = FAISS.from_documents(texts, embeddings)
        print("✅ Vector database created in memory")
    except Exception as e:
        print(f"❌ Error creating vector database: {e}")
        return

    # Ensure output directory exists
    os.makedirs(os.path.dirname(DB_FAISS_PATH), exist_ok=True)

    vector_db.save_local(DB_FAISS_PATH)
    print(f"\n✅ Success! Vector database saved to: {DB_FAISS_PATH}")

if __name__ == "__main__":
    create_vector_db()