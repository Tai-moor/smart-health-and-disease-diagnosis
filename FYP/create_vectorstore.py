
import os
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from pathlib import Path

def create_vectorstore_from_book():
    """
    Create vector database from medical encyclopedia
    Uses HuggingFace embeddings (FREE - runs locally, no API calls!)
    """
    
    print("🚀 Starting Vector Database Creation...")
    print("=" * 60)
    
    # Paths
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    BOOK_PATH = os.path.join(BASE_DIR, "data", "The_GALE_ENCYCLOPEDIA_of_MEDICINE_SECOND.pdf")
    VECTORSTORE_PATH = os.path.join(BASE_DIR, "vectorstore", "db_faiss")
    
    # Check if book exists
    if not os.path.exists(BOOK_PATH):
        print(f"❌ Book not found at: {BOOK_PATH}")
        print("\n📁 Looking for PDF files in data folder...")
        data_dir = os.path.join(BASE_DIR, "data")
        if os.path.exists(data_dir):
            pdf_files = [f for f in os.listdir(data_dir) if f.endswith('.pdf')]
            if pdf_files:
                print(f"Found these PDF files:")
                for i, pdf in enumerate(pdf_files, 1):
                    print(f"  {i}. {pdf}")
                print(f"\n💡 Please rename your medical book to: The_GALE_ENCYCLOPEDIA_of_MEDICINE_SECOND.pdf")
            else:
                print("❌ No PDF files found in data folder!")
        else:
            print("❌ Data folder doesn't exist!")
            print(f"Please create: {data_dir}")
        return
    
    print(f"✅ Found book at: {BOOK_PATH}")
    
    # Step 1: Load the PDF
    print("\n📖 Loading PDF document...")
    try:
        loader = PyPDFLoader(BOOK_PATH)
        documents = loader.load()
        print(f"✅ Loaded {len(documents)} pages from the encyclopedia")
    except Exception as e:
        print(f"❌ Error loading PDF: {e}")
        return
    
    # Step 2: Split into chunks (NO API CALL - Pure text processing)
    print("\n✂️  Splitting document into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    
    chunks = text_splitter.split_documents(documents)
    print(f"✅ Created {len(chunks)} text chunks")
    
    # Add metadata to each chunk
    for i, chunk in enumerate(chunks):
        chunk.metadata["source"] = "medical_encyclopedia"
        chunk.metadata["chunk_id"] = i
        chunk.metadata["book_name"] = "GALE Encyclopedia of Medicine"
    
    # Step 3: Create embeddings using HuggingFace (FREE - Runs locally!)
    print("\n🤖 Creating embeddings (this may take a few minutes)...")
    print("Using HuggingFace model: sentence-transformers/all-MiniLM-L6-v2")
    print("⚡ This runs LOCALLY - No API calls or quota used!")
    
    try:
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
        print("✅ Embeddings model loaded successfully")
        
    except Exception as e:
        print(f"❌ Error loading embeddings model: {e}")
        print("\n💡 Installing required package...")
        os.system("pip install sentence-transformers")
        print("\n🔄 Please run this script again after installation.")
        return
    
    # Step 4: Create FAISS vector database
    print("\n💾 Creating FAISS vector database...")
    print("⏳ This will take several minutes for large books...")
    try:
        vectorstore = FAISS.from_documents(chunks, embeddings)
        print("✅ Vector database created in memory")
        
        # Save to disk
        os.makedirs(os.path.dirname(VECTORSTORE_PATH), exist_ok=True)
        vectorstore.save_local(VECTORSTORE_PATH)
        print(f"✅ Vector database saved to: {VECTORSTORE_PATH}")
        
    except Exception as e:
        print(f"❌ Error creating vector database: {e}")
        return
    
    # Step 5: Test the database
    print("\n🧪 Testing vector database...")
    test_query = "What is diabetes?"
    results = vectorstore.similarity_search(test_query, k=2)
    
    print(f"\nTest Query: '{test_query}'")
    print(f"Found {len(results)} relevant chunks:")
    print("\nSample Result:")
    print("-" * 60)
    print(results[0].page_content[:300] + "...")
    print("-" * 60)
    
    print("\n" + "=" * 60)
    print("✅ VECTOR DATABASE CREATED SUCCESSFULLY!")
    print("=" * 60)
    print("\nStatistics:")
    print(f"  📄 Total Pages: {len(documents)}")
    print(f"  📦 Total Chunks: {len(chunks)}")
    print(f"  💾 Storage Location: {VECTORSTORE_PATH}")
    print(f"  💿 Disk Space Used: ~{os.path.getsize(VECTORSTORE_PATH) / (1024*1024):.2f} MB" if os.path.exists(VECTORSTORE_PATH) else "")
    print(f"  🔍 Ready for semantic search!")
    print("\n✅ You can now run your FastAPI server:")
    print("   uvicorn main:app --reload")

if __name__ == "__main__":
    create_vectorstore_from_book()

