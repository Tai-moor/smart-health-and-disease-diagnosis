import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { conditionsData } from "../../data/conditionsData"; // Import your big list
import { FaSearch, FaStethoscope } from "react-icons/fa";

const styles = {
  container: { maxWidth: "1200px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" },
  header: { textAlign: "center", marginBottom: "40px" },
  heading: { fontSize: "32px", color: "#2d3436", marginBottom: "10px" },
  subHeading: { color: "#636e72", fontSize: "16px" },
  
  // Search Bar
  searchBox: { 
    maxWidth: "500px", margin: "20px auto", position: "relative" 
  },
  input: { 
    width: "100%", padding: "15px 45px 15px 20px", fontSize: "16px", 
    borderRadius: "30px", border: "1px solid #dfe6e9", outline: "none", 
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)" 
  },
  searchIcon: { position: "absolute", right: "20px", top: "18px", color: "#b2bec3" },

  // Grid
  grid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", 
    gap: "20px" 
  },
  card: { 
    backgroundColor: "white", padding: "20px", borderRadius: "12px", 
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)", cursor: "pointer", 
    border: "1px solid #f1f2f6", transition: "all 0.2s", 
    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center"
  },
  conditionName: { fontWeight: "600", color: "#2d3436", marginTop: "10px", fontSize: "16px" },
  specialtyName: { fontSize: "12px", color: "#0984e3", marginTop: "5px", fontWeight: "bold", textTransform: "uppercase" }
};

function AllConditions() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  // Filter the big list based on search
  const filteredList = conditionsData.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (specialty) => {
    // Redirect to doctor list with this specialty
    navigate(`/find-doctors?specialty=${encodeURIComponent(specialty)}`);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.heading}>A-Z Health Conditions</h1>
        <p style={styles.subHeading}>Select a condition to find the right specialist for you.</p>
        
        {/* Search Bar */}
        <div style={styles.searchBox}>
          <input 
            type="text" 
            placeholder="Search for a symptom or disease..." 
            style={styles.input}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <FaSearch style={styles.searchIcon} />
        </div>
      </div>
      
      <div style={styles.grid}>
        {filteredList.length > 0 ? (
          filteredList.map((item, index) => (
            <div 
              key={index} 
              style={styles.card} 
              onClick={() => handleSelect(item.specialty)}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0984e3"; e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = "#f1f2f6"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <FaStethoscope size={24} color="#00b894" />
              <span style={styles.conditionName}>{item.name}</span>
              <span style={styles.specialtyName}>{item.specialty}</span>
            </div>
          ))
        ) : (
          <p style={{textAlign:"center", gridColumn:"1/-1", color:"#999"}}>No conditions found matching "{searchTerm}"</p>
        )}
      </div>
    </div>
  );
}

export default AllConditions;