import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaMapMarkerAlt, FaCrosshairs, FaTimes } from "react-icons/fa";

const styles = {
  heroContainer: {
    background: "linear-gradient(90deg, #3f2b96 0%, #a8c0ff 100%)",
    padding: "60px 20px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    minHeight: "350px",
    borderRadius: "0 0 20px 20px"
  },
  contentWrapper: {
    maxWidth: "1100px",
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 2,
    flexWrap: "wrap"
  },
  textSection: {
    flex: 1,
    color: "white",
    marginBottom: "20px"
  },
  headline: {
    fontSize: "36px",
    fontWeight: "bold",
    marginBottom: "10px",
    lineHeight: "1.2"
  },
  subHeadline: {
    fontSize: "36px",
    fontWeight: "800",
    color: "#ffc107",
    marginBottom: "20px"
  },
  searchBar: {
    backgroundColor: "white",
    borderRadius: "8px",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
    maxWidth: "750px",
    width: "100%",
    position: "relative"
  },
  inputGroup: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    position: "relative",
    padding: "0 10px"
  },
  divider: {
    width: "1px",
    height: "30px",
    backgroundColor: "#ddd"
  },
  input: {
    border: "none",
    outline: "none",
    width: "100%",
    padding: "10px",
    fontSize: "16px",
    color: "#333"
  },
  detectBtn: {
    background: "none",
    border: "none",
    color: "#007bff",
    cursor: "pointer",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "14px"
  },
  searchBtn: {
    backgroundColor: "#ff9f00",
    color: "white",
    border: "none",
    padding: "12px 30px",
    borderRadius: "6px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background 0.2s"
  },
  
  // 🟢 IMAGE ON RIGHT
  doctorImage: {
    height: "350px",
    objectFit: "contain",
    position: "absolute",
    right: "50px",
    bottom: "0",
    zIndex: 1,
    display: window.innerWidth < 768 ? "none" : "block"
  },

  dropdown: {
    position: "absolute",
    top: "110%",
    left: 0,
    width: "100%",
    backgroundColor: "white",
    borderRadius: "8px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    zIndex: 100,
    maxHeight: "300px",
    overflowY: "auto",
    padding: "10px 0"
  },
  dropdownItem: {
    padding: "12px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    borderBottom: "1px solid #f9f9f9",
    color: "#333",
    fontSize: "15px"
  },
  specialtyTag: {
    color: "#999",
    fontSize: "12px"
  }
};

const specialtiesList = [
  "Gynecologist", "Dermatologist", "Child Specialist", "Neurologist", 
  "Orthopedic Surgeon", "Gastroenterologist", "Cardiologist", "Dentist",
  "General Physician", "ENT Specialist", "Eye Specialist", "Urologist",
  "Psychiatrist", "Pulmonologist", "Endocrinologist"
];

function HeroSearch() {
  const navigate = useNavigate();
  const [city, setCity] = useState(""); 
  const [query, setQuery] = useState(""); 
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredList = specialtiesList.filter(s => 
    s.toLowerCase().includes(query.toLowerCase())
  );

  const handleSearch = () => {
    navigate(`/find-doctors?city=${encodeURIComponent(city)}&specialty=${encodeURIComponent(query)}`);
    setShowDropdown(false);
  };

  const selectSpecialty = (item) => {
    setQuery(item);
    navigate(`/find-doctors?city=${encodeURIComponent(city)}&specialty=${encodeURIComponent(item)}`);
    setShowDropdown(false);
  };

  return (
    <div style={styles.heroContainer}>
      <div style={styles.contentWrapper}>
        
        <div style={styles.textSection}>
          <div style={styles.headline}>Find and Book the</div>
          <div style={styles.subHeadline}>Best Doctors near you</div>
          
          <div style={{display:"flex", alignItems:"center", gap:"10px", marginBottom:"15px"}}>
             <span style={{background:"rgba(255,255,255,0.2)", padding:"5px 10px", borderRadius:"4px", fontSize:"12px"}}>
               ✅ 9M+ tele-consultations
             </span>
          </div>

          <div style={styles.searchBar}>
            
            <div style={{...styles.inputGroup, flex: 0.6}}>
              <FaMapMarkerAlt color="#007bff" />
              <input 
                style={styles.input} 
                placeholder="City (e.g. Lahore)" 
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <button style={styles.detectBtn} onClick={() => alert("Geolocation feature coming soon!")}>
                <FaCrosshairs /> Detect
              </button>
            </div>

            <div style={styles.divider}></div>

            <div style={styles.inputGroup}>
              <FaSearch color="#666" />
              <input 
                style={styles.input} 
                placeholder="Doctors, Hospital, Conditions" 
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              />
            </div>

            <button style={styles.searchBtn} onClick={handleSearch}>Search</button>

            {showDropdown && (
              <div style={styles.dropdown}>
                <div style={{padding:"10px 20px", fontWeight:"bold", color:"#000080", display:"flex", justifyContent:"space-between"}}>
                    <span>Search for doctors</span>
                    <FaTimes style={{cursor:"pointer"}} onClick={() => setShowDropdown(false)}/>
                </div>
                
                {filteredList.length > 0 ? (
                  filteredList.map((item, index) => (
                    <div 
                      key={index} 
                      style={styles.dropdownItem}
                      onMouseDown={() => selectSpecialty(item)} 
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f0f8ff"}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = "white"}
                    >
                      <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
                        <FaSearch color="#ccc"/> {item}
                      </div>
                      <span style={styles.specialtyTag}>Specialty</span>
                    </div>
                  ))
                ) : (
                  <div style={{padding:"20px", textAlign:"center", color:"#999"}}>No matching specialty found</div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* 🟢 UPDATED IMAGE SOURCE */}
      <img 
        src="/assets/imgg.png" 
        alt="Doctor" 
        style={styles.doctorImage} 
      />
    </div>
  );
}

export default HeroSearch;