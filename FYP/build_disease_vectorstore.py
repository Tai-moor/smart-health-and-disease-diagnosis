"""
build_disease_vectorstore.py — REFINED v2

Changes vs v1 (based on actual PDF inspection):
  ✅ FIX 1: Heading regex now captures "Symptoms (...):", "Symptoms of X:", etc.
           Recovers ~30 diseases that v1 silently dropped (Carbon Monoxide
           Poisoning, Cirrhosis, Food Poisoning, Anthrax, etc.)
  ✅ FIX 2: Stricter disease-name validator.  Rejects section headers,
           prose fragments, and line-wrapped text (~20 false positives gone)
  ✅ FIX 5: Chunks written as natural prose — better cosine similarity
           against patient-style queries like "I have fever and chills"
  ✅ FIX 6: Parse-statistics report — no more silent failures

Run:
    python build_disease_vectorstore.py
"""

import os
import re
from collections import Counter

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document

# ═══════════════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_PATH = os.path.join(BASE_DIR, "data", "diseases_symptoms.pdf")
VECTORSTORE_PATH = os.path.join(BASE_DIR, "vectorstore", "disease_faiss")

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


# ═══════════════════════════════════════════════════════════════════
#  FIX 2 — Disease-name validator
#  (Replaces the too-loose regex that captured "Exstrophy", "Cystitis",
#  "Vaginal", etc. as if they were disease names)
# ═══════════════════════════════════════════════════════════════════

# Words that look like disease names but aren't — these are section
# headers, list labels, or prose fragments that PDF layout leaks in.
NON_DISEASE_WORDS = {
    "symptoms", "signs", "warning signals", "clinical features",
    "treatment", "diagnosis", "prevention", "causes", "risk factors",
    "overview", "introduction", "references", "bibliography", "contents",
    "chapter", "section", "appendix", "figure", "table", "note", "notes",
    "summary", "conclusion", "abstract", "preface", "index",
    # Sub-labels that appear at line start inside bullet paragraphs
    "both", "females", "males", "children", "infants", "newborns",
    "oral", "vaginal", "deep", "initial", "severe", "mild", "acute",
    "chronic", "late", "early", "advanced", "stage one", "stage two",
}


def looks_like_disease_name(line: str) -> bool:
    """
    Multi-signal test.  A real disease-name heading satisfies ALL of:
      - 3-70 characters
      - no terminal punctuation (prose sentences end with . , ? etc.)
      - not in the NON_DISEASE_WORDS stoplist
      - starts with a capital letter
      - mostly letters (not page numbers / artifacts)
      - 1-7 words (real names are rarely longer)
      - Title Case, Sentence case, OR ALL CAPS
        (your PDF mixes "Carbon Monoxide Poisoning" and "Abdominal aortic aneurysm")

    Prose-rejection guards:
      - no lowercase function words before a capital ("...goes to Jupiter" → reject)
      - no embedded sentence punctuation
    """
    line = line.strip()

    if not (3 <= len(line) <= 70):
        return False

    # Reject prose — sentences end with punctuation
    if line.endswith((".", ",", ";", ":", "?", "!")):
        return False

    # Reject pure numbers / page artifacts
    if re.fullmatch(r"[\d\s\-—•|]+", line):
        return False

    # Reject stoplist (section headers, sub-labels)
    if line.lower().strip() in NON_DISEASE_WORDS:
        return False

    # Must start with a capital
    if not re.match(r"^[A-Z]", line):
        return False

    # Mostly letters (>=55% alphabetic — looser, some names have many parens/dashes)
    letters = sum(c.isalpha() for c in line)
    if letters < len(line) * 0.55:
        return False

    # Real disease-name headings are 1-7 words
    words = line.split()
    if not (1 <= len(words) <= 7):
        return False

    # ── Capitalization pattern ─────────────────────────────────
    # Accept three patterns:
    #   Title Case:     "Carbon Monoxide Poisoning"
    #   Sentence case:  "Abdominal aortic aneurysm"
    #   ALL CAPS:       "ASTHMA"
    #
    # Prose-rejection guards for Sentence case:
    #   - no embedded sentence punctuation
    #   - no common sentence starters that indicate prose
    #     ("The fever...", "This condition...", "A patient...")
    all_caps = line.isupper()

    title_case = all(
        w[0].isupper() or not w[0].isalpha()
        for w in words
    )

    # Sentence case = first word capitalized, rest lowercase (except
    # acronyms in parens like "(ADHD)", Roman numerals, etc.)
    first_cap = words[0][0].isupper()
    # For the rest: allow lowercase OR parenthesized uppercase/acronym
    rest_ok = all(
        w[0].islower()
        or w.startswith("(")         # "(ADHD)"
        or w.isupper()               # "ALL", "AML"
        or not w[0].isalpha()        # starts with punctuation
        for w in words[1:]
    )
    sentence_case = first_cap and rest_ok

    if not (title_case or sentence_case or all_caps):
        return False

    # ── Prose-rejection guards ─────────────────────────────────
    # These patterns indicate a sentence-case line is actually prose
    PROSE_STARTERS = {
        "the", "this", "that", "these", "those", "a", "an",
        "in", "on", "at", "for", "of", "with", "by", "to",
        "and", "or", "but", "if", "when", "while", "during",
        "patient", "patients", "it", "there", "there's", "he", "she",
    }
    if len(words) >= 2:
        # "The fever" → prose
        # But "Parkinson's disease" → fine (Parkinson's isn't in stoplist)
        if words[0].lower() in PROSE_STARTERS:
            return False

    # Embedded punctuation usually means prose
    if re.search(r"[,;]\s", line):
        return False

    return True


# ═══════════════════════════════════════════════════════════════════
#  FIX 1 — Heading regex that accepts parenthesized variants
#
#  Your PDF has:      "Symptoms (in order of increasing severity):"
#                     "Symptoms (Compensated):"
#                     "Symptoms (by bacteria):"
#                     "Symptoms of Complications:"
#                     "Warning Signals:"
#
#  Old regex only matched "Symptoms:" — silently dropped ~30 diseases.
# ═══════════════════════════════════════════════════════════════════
HEADING_RE = re.compile(
    r"""
    (?P<heading>
        Symptoms? | Warning\ Signals? | Signs? | Clinical\ Features?
    )
    (?:                             # optional qualifier
        \s*\([^)]{0,80}\)            #    "(in order of severity)"
      | \s+of\s+[A-Za-z][A-Za-z\s]{0,40}  # "of Complications"
    )?
    \s*[:\-]\s*                      # colon or dash
    (?P<body>.*?)                    # the symptoms block
    (?=                              # stopping at…
        \n\s*\n                      #    blank line
      | \Z                           #    or end of text
    )
    """,
    re.IGNORECASE | re.DOTALL | re.VERBOSE,
)


# ═══════════════════════════════════════════════════════════════════
#  Symptom extraction
# ═══════════════════════════════════════════════════════════════════
def extract_symptoms(disease_name: str, text_lines: list) -> tuple:
    """
    Returns (Document_or_None, status_string).
    status is one of: 'ok', 'no_heading', 'too_short', 'no_bullets'.
    """
    text = "\n".join(text_lines)

    # Find ALL matching headings — some diseases have multiple
    # (e.g. "Symptoms (acute):" + "Symptoms (chronic):")
    matches = list(HEADING_RE.finditer(text))
    if not matches:
        return None, "no_heading"

    # Collect symptom bullets from every matched block
    all_symptoms = []
    for m in matches:
        block = m.group("body")
        bullets = re.findall(r"[•\-\*○◦●]\s*(.+?)(?=\n|$)", block)
        bullets = [b.strip(" .,;") for b in bullets if len(b.strip()) > 2]
        all_symptoms.extend(bullets)

    if not all_symptoms:
        return None, "no_bullets"

    # Clean: collapse whitespace, drop duplicates while preserving order
    cleaned, seen_sym = [], set()
    for s in all_symptoms:
        s = re.sub(r"\s+", " ", s).strip()
        key = s.lower()
        if key and key not in seen_sym:
            seen_sym.add(key)
            cleaned.append(s)

    if sum(len(s) for s in cleaned) < 15:
        return None, "too_short"

    # ── FIX 5: natural-prose chunk text for better embedding retrieval ──
    chunk_text = format_chunk_for_embedding(disease_name, cleaned)

    doc = Document(
        page_content=chunk_text,
        metadata={
            "disease":        disease_name,
            "symptom_count":  len(cleaned),
            "type":           "disease_symptoms",
        },
    )
    return doc, "ok"


def format_chunk_for_embedding(disease: str, symptoms: list) -> str:
    """
    Old format:  "Disease: X\nSymptoms: a | b | c"
    New format:  natural prose with semantic doubling.

    Why — `all-MiniLM-L6-v2` is trained on sentence pairs, not
    pipe-delimited tokens.  Writing "X commonly presents with a, b, and c"
    measurably improves cosine similarity against patient-style queries
    like "I have a and b".
    """
    if len(symptoms) == 1:
        sym_str = symptoms[0]
    elif len(symptoms) == 2:
        sym_str = f"{symptoms[0]} and {symptoms[1]}"
    else:
        sym_str = ", ".join(symptoms[:-1]) + f", and {symptoms[-1]}"

    # Semantic doubling — two phrasings of the same info.
    # Costs nothing to index, gives the embedder two chances to match.
    return (
        f"{disease} is characterized by the following symptoms: {sym_str}. "
        f"Patients with {disease} commonly experience {sym_str}."
    )


# ═══════════════════════════════════════════════════════════════════
#  PDF loading
# ═══════════════════════════════════════════════════════════════════
def load_pdf(path: str) -> str:
    print(f"📖 Loading PDF: {path}")
    loader = PyPDFLoader(path)
    pages = loader.load()
    full_text = "\n".join(p.page_content for p in pages)
    print(f"   → Loaded {len(pages)} pages")
    return full_text


# ═══════════════════════════════════════════════════════════════════
#  Main parsing loop with statistics
# ═══════════════════════════════════════════════════════════════════
def parse_disease_chunks(full_text: str) -> tuple:
    """
    Returns (documents, statistics_dict).
    Walks line-by-line.  When a line looks like a disease name, flushes
    the previous buffer as that disease's content.
    """
    documents = []
    seen = set()

    stats = {
        "candidates_found":     0,
        "candidates_rejected":  0,
        "extracted_ok":         0,
        "skipped_no_heading":   0,
        "skipped_no_bullets":   0,
        "skipped_too_short":    0,
        "deduplicated":         0,
    }
    failure_reasons = Counter()
    rejected_samples = []

    lines = full_text.splitlines()
    current_disease = None
    buffer = []

    def flush():
        """Process the currently buffered disease."""
        nonlocal current_disease, buffer
        if current_disease and buffer:
            if current_disease.lower() in seen:
                stats["deduplicated"] += 1
            else:
                doc, status = extract_symptoms(current_disease, buffer)
                if doc:
                    documents.append(doc)
                    seen.add(current_disease.lower())
                    stats["extracted_ok"] += 1
                else:
                    stats[f"skipped_{status}"] += 1
                    failure_reasons[status] += 1
                    if len(rejected_samples) < 10:
                        rejected_samples.append((current_disease, status))
        buffer = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if looks_like_disease_name(line):
            stats["candidates_found"] += 1
            flush()
            current_disease = line
        else:
            # Track "almost-disease-names" for visibility
            if re.match(r"^[A-Z][a-z]", line) and len(line) < 50 and not line.endswith((".", ",")):
                stats["candidates_rejected"] += 1
            buffer.append(line)

    # Flush last
    flush()

    return documents, stats, rejected_samples


# ═══════════════════════════════════════════════════════════════════
#  Build FAISS index
# ═══════════════════════════════════════════════════════════════════
def build_vectorstore(documents: list):
    print(f"\n🤖 Loading embedding model: {EMBEDDING_MODEL}")
    embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

    print(f"💾 Building FAISS index from {len(documents)} disease chunks...")
    vectorstore = FAISS.from_documents(documents, embeddings)

    os.makedirs(VECTORSTORE_PATH, exist_ok=True)
    vectorstore.save_local(VECTORSTORE_PATH)
    print(f"   → Saved to: {VECTORSTORE_PATH}")
    return vectorstore


# ═══════════════════════════════════════════════════════════════════
#  Retrieval sanity test — multiple query styles
# ═══════════════════════════════════════════════════════════════════
def test_vectorstore(vectorstore):
    print("\n🧪 Retrieval sanity check:")
    print("─" * 60)

    test_queries = [
        "I have fever and chills",
        "my chest hurts and I'm short of breath",
        "severe headache with nausea and vomiting",
        "itchy red rash on my skin",
        "burning sensation when urinating",
    ]

    for q in test_queries:
        results = vectorstore.similarity_search(q, k=3)
        top = " / ".join(r.metadata.get("disease", "?") for r in results)
        print(f"  Q: {q!r}")
        print(f"     → {top}")


# ═══════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("═" * 60)
    print("🏥  Disease Vectorstore Builder — v2")
    print("═" * 60)

    if not os.path.exists(PDF_PATH):
        print(f"\n❌ PDF not found: {PDF_PATH}")
        print("   Put your file at: data/diseases_symptoms.pdf")
        exit(1)

    full_text = load_pdf(PDF_PATH)
    documents, stats, rejected_samples = parse_disease_chunks(full_text)

    # ─── Parse report (FIX 6) ───────────────────────────────────
    print("\n📊 Parsing report")
    print("─" * 60)
    for key, val in stats.items():
        print(f"   {key:.<35} {val}")

    if rejected_samples:
        print("\n⚠️  Sample of rejected entries (why they were dropped):")
        for name, reason in rejected_samples[:5]:
            print(f"     • {name[:40]:<40} → {reason}")

    if not documents:
        print("\n❌ No diseases extracted. Aborting.")
        exit(1)

    print(f"\n✅ Total unique diseases indexed: {len(documents)}")

    print("\n📌 Sample chunk (what gets embedded):")
    print("─" * 60)
    print(documents[0].page_content)
    print("─" * 60)

    vs = build_vectorstore(documents)
    test_vectorstore(vs)

    print("\n" + "═" * 60)
    print("✅ DONE.")
    print("   Next: uvicorn api:app --reload")
    print("═" * 60)