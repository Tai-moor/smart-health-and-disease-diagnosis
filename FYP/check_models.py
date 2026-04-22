import google.generativeai as genai
import os
from dotenv import load_dotenv

# 1. Load Key
load_dotenv()
api_key = os.environ.get("GOOGLE_API_KEY")

if not api_key:
    print("❌ Error: No API Key found in .env file.")
    exit()

# 2. Configure
genai.configure(api_key=api_key)

print(f"🔑 Key found. Asking Google for available models...\n")

try:
    # 3. List Models that support chat/content generation
    found_any = False
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            found_any = True
            clean_name = m.name.replace("models/", "")
            print(f"✅ AVAILABLE: {m.name}")
            print(f"   👉 Use this in your code: AGENT_MODEL = \"{clean_name}\"\n")

    if not found_any:
        print("⚠️ No chat models found. Your API key might be restricted or invalid.")

except Exception as e:
    print(f"❌ Error connecting to Google API: {e}")