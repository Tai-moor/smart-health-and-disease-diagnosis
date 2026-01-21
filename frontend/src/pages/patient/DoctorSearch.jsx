import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaStethoscope, FaHeart, FaTooth, FaBaby, FaBrain, FaFemale, FaBone, FaEye, FaTimes, FaUserMd } from "react-icons/fa";
import { GiStomach, GiKidneys, GiLungs, GiLeg } from "react-icons/gi";
import { MdPregnantWoman, MdOutlineSick } from "react-icons/md";
import { auth, db } from "../../services/firebase";
import { doc, getDoc } from "firebase/firestore";

// 🟢 FIXED IMPORT PATH (Go up 2 levels to find components)
import HeroSearch from "../../components/HeroSearch";

// 🎨 Styles
const styles = {
  // Main container for the content BELOW the hero banner
  container: {
    padding: "40px 20px",
    maxWidth: "1200px",
    margin: "0 auto",
    fontFamily: "'Segoe UI', sans-serif",
  },
  heading: {
    textAlign: "center",
    color: "#333",
    fontSize: "2.5rem",
    marginBottom: "30px",
    fontWeight: "700",
  },
  subHeading: {
    textAlign: "center",
    color: "#444",
    fontSize: "1.8rem",
    marginTop: "50px",
    marginBottom: "30px",
    fontWeight: "600",
    borderTop: "1px solid #eee",
    paddingTop: "40px"
  },
  searchContainer: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "50px",
    position: "relative",
  },
  searchInput: {
    width: "100%",
    maxWidth: "600px",
    padding: "15px 20px 15px 50px",
    fontSize: "16px",
    borderRadius: "30px",
    border: "2px solid #ddd",
    outline: "none",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
    transition: "border 0.3s",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: "20px",
    padding: "10px",
  },
  card: {
    backgroundColor: "white",
    border: "1px solid #eee",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
  },
  cardHover: {
    transform: "translateY(-5px)",
    boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
    borderColor: "#007bff",
  },
  iconWrapper: {
    backgroundColor: "#e3f2fd",
    color: "#007bff",
    padding: "15px",
    borderRadius: "50%",
    marginBottom: "15px",
    fontSize: "24px",
  },
  categoryTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#444",
    textAlign: "center",
  },
  dropdown: {
    position: "absolute",
    top: "55px",
    width: "100%",
    maxWidth: "600px",
    maxHeight: "300px",
    overflowY: "auto",
    backgroundColor: "white",
    border: "1px solid #ddd",
    borderRadius: "8px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    zIndex: 100,
  },
  dropdownItem: {
    padding: "12px 20px",
    cursor: "pointer",
    borderBottom: "1px solid #f0f0f0",
    fontSize: "15px",
    color: "#333",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "white",
    padding: "30px",
    borderRadius: "15px",
    width: "90%",
    maxWidth: "800px",
    maxHeight: "80vh",
    overflowY: "auto",
    position: "relative",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
  },
  closeBtn: {
    position: "absolute",
    top: "15px",
    right: "20px",
    border: "none",
    background: "none",
    fontSize: "24px",
    cursor: "pointer",
    color: "#888",
  },
  modalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "10px",
    marginTop: "20px",
  },
  modalItem: {
    padding: "12px",
    border: "1px solid #eee",
    borderRadius: "8px",
    cursor: "pointer",
    textAlign: "center",
    fontSize: "14px",
    backgroundColor: "#f9f9f9",
    transition: "0.2s",
  }
};

const popularCategories = [
  { name: "Dermatologist", icon: <FaFemale /> },
  { name: "Dentist", icon: <FaTooth /> },
  { name: "Gynecologist", icon: <MdPregnantWoman /> },
  { name: "Pediatrician", icon: <FaBaby /> },
  { name: "Cardiologist", icon: <FaHeart /> },
  { name: "Neurologist", icon: <FaBrain /> },
  { name: "Orthopedic Surgeon", icon: <FaBone /> },
  { name: "Gastroenterologist", icon: <GiStomach /> },
  { name: "Eye Specialist", icon: <FaEye /> },
  { name: "General Physician", icon: <FaStethoscope /> },
  { name: "Urologist", icon: <GiKidneys /> },
  { name: "Pulmonologist", icon: <GiLungs /> },
];

const topConditions = [
  { name: "Fever/Cold", specialty: "General Physician", icon: <MdOutlineSick /> },
  { name: "Heart Pain", specialty: "Cardiologist", icon: <FaHeart /> },
  { name: "Toothache", specialty: "Dentist", icon: <FaTooth /> },
  { name: "Depression", specialty: "Psychologist", icon: <FaBrain /> },
  { name: "Stomach Pain", specialty: "General Physician", icon: <GiStomach /> },
  { name: "Eye Issue", specialty: "Eye Specialist", icon: <FaEye /> },
  { name: "Joint Pain", specialty: "Rheumatologist", icon: <GiLeg /> },
  { name: "Migraine", specialty: "Neurologist", icon: <FaUserMd /> },
];

const allSpecialties = [
  "Gynecologist", "Pediatrician", "General Physician", "Psychiatrist", "Gastroenterologist",
  "Diabetologist", "Counselor", "Hematologist", "Obstetrician", "Neonatologist", "Hypertension Specialist",
  "Obesity Specialist", "Internal Medicine Specialist", "Consultant Physician", "Nutritionist", "Dietitian",
  "Psychologist", "Physiotherapist", "Audiologist", "Family Physician", "Dermatologist", "ENT Specialist",
  "Orthopedic Surgeon", "Neurologist", "Urologist", "Eye Specialist", "Dentist", "Cardiologist", "Pulmonologist",
  "General Surgeon", "Endocrinologist", "Nephrologist", "Pain Management Specialist", "Cosmetologist",
  "Aesthetic Physician", "Laser Specialist", "Anesthesiologist", "Interventional Cardiologist", "Pediatric Psychologist",
  "Hepatologist", "Sexologist", "Male Sexual Health Specialist", "Uro-Oncologist", "Oncologist", "Radiation Oncologist",
  "Pediatric Oncologist", "Andrologist", "Pediatric Surgeon", "Laparoscopic Surgeon", "Speech and Language Pathologist",
  "Kidney Transplant Surgeon", "Renal Surgeon", "Fertility Consultant", "Hernia Surgeon", "Pediatric Urologist",
  "Endoscopic Surgeon", "Aesthetic Gynecologist", "Endodontist", "Bariatric Surgeon", "Colorectal Surgeon",
  "Breast Surgeon", "Cancer Surgeon", "Thyroid Surgeon", "Orthodontist", "Implantologist", "Prosthodontist",
  "Cosmetic Dentist", "Chiropractor", "Eye Surgeon", "ENT Surgeon", "Head and Neck Surgeon", "Restorative Dentist",
  "Acupuncturist", "Oral and Maxillofacial Surgeon", "Plastic Surgeon", "Hair Transplant Surgeon", "Burns Specialist",
  "Cosmetic Surgeon", "Neurosurgeon", "Rheumatologist", "Pediatric Nutritionist", "Rehab Medicine",
  "Diabetes Counsellor", "Spinal Surgeon", "Pediatric Hematologist", "Pathologist", "Histopathologist",
  "Pediatric Neurologist", "Homeopath", "Autism Consultant", "Pediatric Rheumatologist", "Cardiothoracic Surgeon",
  "Nuclear Medicine Specialist", "Vitreo Retina Surgeon", "Geriatrician", "Sonologist", "Cardiac Surgeon",
  "Nutritional Psychologist", "Pediatric Gastroenterologist", "Hand Surgeon", "Reconstructive Surgeon",
  "Sports Medicine Specialist", "Thoracic Surgeon", "Specialist in Operative Dentistry", "Sleep Medicine Doctor",
  "Critical Care Physician", "Primary Care Physician", "Pediatric Neurosurgeon", "Vascular Surgeon",
  "Pediatric Orthopedic Surgeon", "Child-Kidney Specialist", "Alternative Medicine Practitioner", "Periodontist",
  "Child and Adolescent Psychiatrist", "Hepatobiliary and Liver Transplant Surgeon", "Radiologist",
  "Orthotist and Prosthetist", "Infectious Disease Specialist", "Pediatric Endocrinologist", "Asthma Specialist",
  "Cardiovascular Surgeon", "Emergency Medicine Specialist", "Naturopathic Doctor", "Community Medicine",
  "Maternal Fetal Medicine Specialist", "Podiatrist", "Optometrist", "Pediatric Cardiologist", "Uro-Gynecologist",
  "Lifestyle Medicine Physician", "Occupational Therapist", "Fitness Trainer", "Pediatric Diabetologist",
  "Endovascular Surgeon", "Colorectal Cancer Surgeon", "Pediatric Dentist", "Gynecological Oncologist"
];

function DoctorSearch() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [conditionHoverIndex, setConditionHoverIndex] = useState(null);
  const [name, setName] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setName("");
        return;
      }
      if (user.displayName) {
        setName(user.displayName);
        return;
      }
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const n = snap.exists() ? snap.data()?.name : "";
        const fallback = user.email ? user.email.split("@")[0] : "";
        setName(n || fallback);
      } catch (e) {
        const fallback = user?.email ? user.email.split("@")[0] : "";
        setName(fallback);
      }
    });
    return () => unsubscribe();
  }, []);

  const filteredSpecialties = allSpecialties.filter(spec => 
    spec.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectSpecialty = (specialty) => {
    navigate(`/find-doctors?specialty=${encodeURIComponent(specialty)}`);
  };

  return (
    // 🟢 Clean Wrapper Div
    <div>
      <HeroSearch />
      <div style={styles.container}>
        
        <h2 style={styles.heading}>
          {name ? `Hey ${name}, Find Best Doctor` : "Find Best Doctors"}
        </h2>

        {/* --- Search Bar --- */}
        <div style={styles.searchContainer}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
            <FaSearch style={{ position: 'absolute', top: '18px', left: '20px', color: '#888' }} />
            
            <input 
              type="text" 
              placeholder="Search doctors, clinics, hospitals, etc." 
              style={styles.searchInput}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)} 
            />

            {showDropdown && searchTerm && (
              <div style={styles.dropdown}>
                {filteredSpecialties.length > 0 ? (
                  filteredSpecialties.map((spec, index) => (
                    <div 
                      key={index} 
                      style={styles.dropdownItem}
                      onMouseDown={() => handleSelectSpecialty(spec)} 
                      onMouseOver={(e) => e.target.style.backgroundColor = "#f9f9f9"}
                      onMouseOut={(e) => e.target.style.backgroundColor = "white"}
                    >
                      {spec}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "15px", color: "#888" }}>No specialties found</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* --- Popular Categories Grid --- */}
        <div style={styles.grid}>
          {popularCategories.map((cat, index) => (
            <div 
              key={index} 
              style={{
                ...styles.card,
                ...(hoverIndex === index ? styles.cardHover : {})
              }}
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
              onClick={() => handleSelectSpecialty(cat.name)}
            >
              <div style={styles.iconWrapper}>
                {cat.icon}
              </div>
              <span style={styles.categoryTitle}>{cat.name}</span>
            </div>
          ))}
          
          {/* View All Button */}
          <div 
            style={{ ...styles.card, cursor: "pointer" }}
            onClick={() => setShowModal(true)}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#007bff"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "#eee"}
          >
             <div style={{...styles.iconWrapper, backgroundColor: "#eee", color: "#333"}}>
                <FaSearch />
              </div>
              <span style={styles.categoryTitle}>View All</span>
          </div>
        </div>

        {/* 🟢 Search by Health Condition */}
        <h3 style={styles.subHeading}>Search doctor by condition</h3>
        
        <div style={styles.grid}>
          {topConditions.map((item, index) => (
            <div 
              key={index} 
              style={{
                ...styles.card,
                ...(conditionHoverIndex === index ? styles.cardHover : {})
              }}
              onMouseEnter={() => setConditionHoverIndex(index)}
              onMouseLeave={() => setConditionHoverIndex(null)}
              onClick={() => handleSelectSpecialty(item.specialty)}
            >
              <div style={{...styles.iconWrapper, backgroundColor: "#fff0f0", color: "#ff6b6b"}}>
                {item.icon}
              </div>
              <span style={styles.categoryTitle}>{item.name}</span>
            </div>
          ))}

          {/* View All Conditions Button */}
          <div 
            style={{ ...styles.card, cursor: "pointer" }}
            onClick={() => navigate("/all-conditions")} 
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#ff6b6b"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "#eee"}
          >
             <div style={{...styles.iconWrapper, backgroundColor: "#eee", color: "#333"}}>
                <FaSearch />
              </div>
              <span style={styles.categoryTitle}>All Conditions</span>
          </div>
        </div>

        {/* --- Modal Popup --- */}
        {showModal && (
          <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>
                <FaTimes />
              </button>
              <h3 style={{ textAlign: "center", marginBottom: "20px" }}>All Specialties</h3>
              
              <div style={styles.modalGrid}>
                {allSpecialties.sort().map((spec) => (
                  <div 
                    key={spec} 
                    style={styles.modalItem}
                    onClick={() => handleSelectSpecialty(spec)}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = "#007bff"}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = "#eee"}
                  >
                    {spec}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default DoctorSearch;