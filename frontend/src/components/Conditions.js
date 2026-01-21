import React from "react";
import { useNavigate } from "react-router-dom";
// Using standard icons
import { FaHeartbeat, FaBrain, FaTooth, FaUserMd, FaEye } from "react-icons/fa";
import { GiStomach, GiLeg } from "react-icons/gi"; 
import { MdOutlineSick } from "react-icons/md";

const styles = {
  section: { padding: "50px 20px", backgroundColor: "#fff", textAlign: "center" },
  headerContainer: { maxWidth: "1000px", margin: "0 auto 30px auto", display: "flex", justifyContent: "space-between", alignItems: "center" },
  heading: { fontSize: "24px", fontWeight: "bold", color: "#333", margin: 0 },
  viewAll: { color: "#000080", textDecoration: "none", fontSize: "16px", fontWeight: "600", cursor: "pointer" },
  grid: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "40px", maxWidth: "1200px", margin: "0 auto" },
  card: { display: "flex", flexDirection: "column", alignItems: "center", width: "110px", cursor: "pointer", transition: "transform 0.2s" },
  iconCircle: { width: "90px", height: "90px", borderRadius: "50%", backgroundColor: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "15px", fontSize: "36px", color: "#ff6b6b", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" },
  label: { fontSize: "15px", fontWeight: "500", color: "#333", textAlign: "center" }
};

// Top 8 Highlighted Conditions for Landing Page
const topConditions = [
  { name: "Fever/Cold", specialty: "General Physician", icon: <MdOutlineSick color="#ff6b6b"/> },
  { name: "Heart Pain", specialty: "Cardiologist", icon: <FaHeartbeat color="#d63031"/> },
  { name: "Toothache", specialty: "Dentist", icon: <FaTooth color="#74b9ff"/> },
  { name: "Depression", specialty: "Psychologist", icon: <FaBrain color="#a29bfe"/> },
  { name: "Stomach Pain", specialty: "General Physician", icon: <GiStomach color="#fdcb6e"/> },
  { name: "Eye Issue", specialty: "Eye Specialist", icon: <FaEye color="#0984e3"/> },
  { name: "Joint Pain", specialty: "Rheumatologist", icon: <GiLeg color="#636e72"/> },
  { name: "Migraine", specialty: "Neurologist", icon: <FaUserMd color="#e17055"/> },
];

function Conditions() {
  const navigate = useNavigate();

  const handleSearch = (specialty) => {
    // Redirect to FindDoctors filtered by Specialty
    navigate(`/find-doctors?specialty=${encodeURIComponent(specialty)}`); 
  };

  return (
    <section style={styles.section}>
      <div style={styles.headerContainer}>
        <h2 style={styles.heading}>Search doctor by condition</h2>
        <span style={styles.viewAll} onClick={() => navigate("/all-conditions")}>View All</span>
      </div>

      <div style={styles.grid}>
        {topConditions.map((item, index) => (
          <div key={index} style={styles.card} onClick={() => handleSearch(item.specialty)}>
            <div style={styles.iconCircle}>{item.icon}</div>
            <span style={styles.label}>{item.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Conditions;