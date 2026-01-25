import React, { useState } from "react";
import { FaSearch, FaTimes, FaStethoscope, FaPills, FaAppleAlt, FaRunning, FaChevronDown, FaChevronUp, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #EBF4FF 0%, #FFFFFF 50%, #E0E7FF 100%)',
    padding: '2rem 1rem',
  },
  maxWidth: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2.5rem',
  },
  iconCircle: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    background: '#2563EB',
    borderRadius: '50%',
    marginBottom: '1rem',
    boxShadow: '0 10px 25px rgba(37, 99, 235, 0.3)',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: '0.75rem',
  },
  subtitle: {
    fontSize: '1.125rem',
    color: '#6B7280',
    maxWidth: '600px',
    margin: '0 auto',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '1rem',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
    padding: '1.5rem',
    marginBottom: '2rem',
    border: '1px solid #E5E7EB',
  },
  searchContainer: {
    position: 'relative',
  },
  searchInput: {
    display: 'flex',
    alignItems: 'center',
    border: '2px solid #E5E7EB',
    borderRadius: '0.75rem',
    background: '#F9FAFB',
    padding: '1rem',
    transition: 'all 0.2s',
  },
  searchInputFocus: {
    borderColor: '#3B82F6',
    background: '#FFFFFF',
  },
  input: {
    width: '100%',
    outline: 'none',
    fontSize: '1rem',
    background: 'transparent',
    border: 'none',
  },
  dropdown: {
    position: 'absolute',
    zIndex: 20,
    width: '100%',
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    marginTop: '0.5rem',
    borderRadius: '0.75rem',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)',
    maxHeight: '256px',
    overflowY: 'auto',
  },
  dropdownItem: {
    padding: '1rem',
    cursor: 'pointer',
    borderBottom: '1px solid #F3F4F6',
    transition: 'background 0.2s',
  },
  dropdownItemHover: {
    background: '#EFF6FF',
  },
  symptomsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    minHeight: '60px',
    padding: '1rem',
    background: '#F9FAFB',
    borderRadius: '0.75rem',
    border: '2px dashed #E5E7EB',
  },
  symptomTag: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
    color: '#FFFFFF',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  button: {
    width: '100%',
    marginTop: '1.5rem',
    background: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
    color: '#FFFFFF',
    padding: '1rem 2rem',
    borderRadius: '0.75rem',
    fontWeight: '700',
    fontSize: '1.125rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 10px 25px rgba(37, 99, 235, 0.4)',
    transition: 'all 0.3s',
  },
  buttonHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 15px 35px rgba(37, 99, 235, 0.5)',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  diagnosisCard: {
    background: '#FFFFFF',
    borderRadius: '1rem',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
    border: '1px solid #E5E7EB',
    overflow: 'hidden',
    marginBottom: '1.5rem',
    transition: 'all 0.3s',
  },
  diagnosisHeader: {
    padding: '1.5rem',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  diagnosisHeaderHover: {
    background: '#F9FAFB',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    background: '#DBEAFE',
    color: '#1D4ED8',
    borderRadius: '50%',
    fontWeight: '700',
    fontSize: '0.875rem',
  },
  confidenceBadge: {
    background: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
    color: '#FFFFFF',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    fontWeight: '700',
    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
  },
  expandedContent: {
    padding: '0 1.5rem 1.5rem 1.5rem',
    borderTop: '1px solid #E5E7EB',
    paddingTop: '1.5rem',
    background: 'linear-gradient(180deg, #F9FAFB 0%, #FFFFFF 100%)',
  },
  detailCard: {
    background: '#FFFFFF',
    borderRadius: '0.75rem',
    padding: '1.25rem',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)',
  },
  detailCardRed: {
    borderLeft: '4px solid #EF4444',
  },
  detailCardGreen: {
    borderLeft: '4px solid #10B981',
  },
  detailCardBlue: {
    borderLeft: '4px solid #3B82F6',
  },
  disclaimer: {
    marginTop: '1.5rem',
    background: '#FEF3C7',
    borderLeft: '4px solid #F59E0B',
    padding: '1rem',
    borderRadius: '0.5rem',
  },
};

const SymptomPredictor = () => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [hoveredDropdownIndex, setHoveredDropdownIndex] = useState(null);

  const handleSearch = async (text) => {
    setQuery(text);
    if (text.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/search_symptom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();
      setSuggestions(data.matches || []);
    } catch (err) {
      console.error("Search Error:", err);
    }
  };

  const addSymptom = (symptom) => {
    if (!selectedSymptoms.find((s) => s.value === symptom.value)) {
      setSelectedSymptoms([...selectedSymptoms, symptom]);
    }
    setQuery("");
    setSuggestions([]);
  };

  const removeSymptom = (value) => {
    setSelectedSymptoms(selectedSymptoms.filter((s) => s.value !== value));
  };

  const clearAll = () => {
    setSelectedSymptoms([]);
    setResults(null);
    setExpandedIndex(null);
  };

  const handlePredict = async () => {
    if (selectedSymptoms.length === 0) {
      alert("⚠️ Please select at least one symptom.");
      return;
    }

    setLoading(true);
    const symptomsPayload = selectedSymptoms.map((s) => s.value);

    try {
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_symptoms: symptomsPayload }),
      });
      const data = await res.json();
      setResults(data.top_diagnosis);
      setExpandedIndex(null);
    } catch (err) {
      alert("❌ Prediction failed.");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        
        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.iconCircle}>
            <FaStethoscope style={{ color: '#FFFFFF', fontSize: '1.5rem' }} />
          </div>
          <h1 style={styles.title}>AI Disease Predictor</h1>
          <p style={styles.subtitle}>
            Enter your symptoms and let our AI analyze possible diagnoses with personalized recommendations.
          </p>
        </div>

        {/* SEARCH CARD */}
        <div style={styles.card}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
            Search Symptoms
          </label>
          
          <div style={styles.searchContainer}>
            <div style={styles.searchInput}>
              <FaSearch style={{ color: '#9CA3AF', fontSize: '1.25rem', marginRight: '0.75rem' }} />
              <input
                type="text"
                style={styles.input}
                placeholder="Type a symptom (e.g., chest pain, headache)..."
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {query && (
                <FaTimes
                  style={{ color: '#9CA3AF', cursor: 'pointer', fontSize: '1rem' }}
                  onClick={() => { setQuery(""); setSuggestions([]); }}
                />
              )}
            </div>

            {suggestions.length > 0 && (
              <div style={styles.dropdown}>
                {suggestions.map((s, idx) => (
                  <div
                    key={s.value}
                    style={{
                      ...styles.dropdownItem,
                      ...(hoveredDropdownIndex === idx ? styles.dropdownItemHover : {})
                    }}
                    onMouseEnter={() => setHoveredDropdownIndex(idx)}
                    onMouseLeave={() => setHoveredDropdownIndex(null)}
                    onClick={() => addSymptom(s)}
                  >
                    <span style={{ fontWeight: '500', color: '#1F2937' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SELECTED SYMPTOMS */}
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                Selected Symptoms ({selectedSymptoms.length})
              </label>
              {selectedSymptoms.length > 0 && (
                <button
                  onClick={clearAll}
                  style={{ fontSize: '0.875rem', color: '#DC2626', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear All
                </button>
              )}
            </div>
            
            <div style={styles.symptomsContainer}>
              {selectedSymptoms.length === 0 ? (
                <span style={{ color: '#9CA3AF', fontStyle: 'italic', width: '100%', textAlign: 'center' }}>
                  No symptoms selected yet...
                </span>
              ) : (
                selectedSymptoms.map((s) => (
                  <span key={s.value} style={styles.symptomTag}>
                    <span style={{ fontWeight: '500' }}>{s.label}</span>
                    <FaTimes
                      style={{ marginLeft: '0.5rem', cursor: 'pointer' }}
                      onClick={() => removeSymptom(s.value)}
                    />
                  </span>
                ))
              )}
            </div>
          </div>

          {/* PREDICT BUTTON */}
          <button
            onClick={handlePredict}
            disabled={loading || selectedSymptoms.length === 0}
            style={{
              ...styles.button,
              ...(loading || selectedSymptoms.length === 0 ? styles.buttonDisabled : {})
            }}
          >
            {loading ? "Analyzing..." : "🔍 Analyze Symptoms"}
          </button>
        </div>

        {/* RESULTS */}
        {results && results.length > 0 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1F2937', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
              <FaCheckCircle style={{ color: '#10B981', marginRight: '0.5rem' }} />
              Top {results.length} Diagnoses
            </h2>

            {results.map((diagnosis, index) => (
              <div key={index} style={styles.diagnosisCard}>
                <div
                  style={styles.diagnosisHeader}
                  onClick={() => toggleExpand(index)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <span style={styles.badge}>{index + 1}</span>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1F2937' }}>
                          {diagnosis.disease}
                        </h3>
                      </div>
                      <p style={{ color: '#6B7280', fontStyle: 'italic', marginLeft: '2.75rem' }}>
                        {diagnosis.description}
                      </p>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={styles.confidenceBadge}>{diagnosis.confidence}</div>
                        <span style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem', display: 'block' }}>Confidence</span>
                      </div>
                      
                      {expandedIndex === index ? (
                        <FaChevronUp style={{ color: '#6B7280', fontSize: '1.25rem' }} />
                      ) : (
                        <FaChevronDown style={{ color: '#6B7280', fontSize: '1.25rem' }} />
                      )}
                    </div>
                  </div>
                </div>

                {expandedIndex === index && (
                  <div style={styles.expandedContent}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                      
                      {/* MEDICATIONS */}
                      <div style={{ ...styles.detailCard, ...styles.detailCardRed }}>
                        <h4 style={{ fontWeight: '700', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                          <FaPills /> Medications
                        </h4>
                        {diagnosis.medications && diagnosis.medications.length > 0 ? (
                          <ul style={{ listStyle: 'none', padding: 0 }}>
                            {diagnosis.medications.map((med, i) => (
                              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <span style={{ color: '#EF4444', marginRight: '0.5rem' }}>•</span>
                                <span style={{ color: '#374151' }}>{med}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No medications listed</p>
                        )}
                      </div>

                      {/* DIET */}
                      <div style={{ ...styles.detailCard, ...styles.detailCardGreen }}>
                        <h4 style={{ fontWeight: '700', color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                          <FaAppleAlt /> Diet Plan
                        </h4>
                        {diagnosis.diets && diagnosis.diets.length > 0 ? (
                          <ul style={{ listStyle: 'none', padding: 0 }}>
                            {diagnosis.diets.map((diet, i) => (
                              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <span style={{ color: '#10B981', marginRight: '0.5rem' }}>•</span>
                                <span style={{ color: '#374151' }}>{diet}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No diet recommendations</p>
                        )}
                      </div>

                      {/* RECOMMENDATIONS */}
                      <div style={{ ...styles.detailCard, ...styles.detailCardBlue }}>
                        <h4 style={{ fontWeight: '700', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                          <FaRunning /> Recommendations
                        </h4>
                        {diagnosis.workout && diagnosis.workout.length > 0 ? (
                          <ul style={{ listStyle: 'none', padding: 0 }}>
                            {diagnosis.workout.map((work, i) => (
                              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <span style={{ color: '#3B82F6', marginRight: '0.5rem' }}>•</span>
                                <span style={{ color: '#374151' }}>{work}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No recommendations</p>
                        )}
                      </div>
                    </div>

                    {/* DISCLAIMER */}
                    <div style={styles.disclaimer}>
                      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <FaExclamationTriangle style={{ color: '#F59E0B', fontSize: '1.25rem', marginTop: '0.25rem', marginRight: '0.75rem' }} />
                        <div>
                          <h5 style={{ fontWeight: '700', color: '#92400E', marginBottom: '0.25rem' }}>Medical Disclaimer</h5>
                          <p style={{ fontSize: '0.875rem', color: '#78350F' }}>
                            This is AI-generated and not a substitute for professional medical advice. Consult a healthcare provider.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SymptomPredictor;