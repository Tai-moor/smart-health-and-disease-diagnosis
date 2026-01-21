import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom"; 
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../services/firebase";
import { FaMapMarkerAlt, FaStethoscope, FaHospital, FaStar, FaFilter, FaUserMd } from "react-icons/fa";

// 🎨 Professional Styles
const styles = {
  container: { 
    maxWidth: "1200px", 
    margin: "40px auto", 
    padding: "20px", 
    fontFamily: "'Segoe UI', sans-serif",
    minHeight: "80vh"
  },
  header: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: "30px", 
    flexWrap: "wrap", 
    gap: "20px",
    borderBottom: "1px solid #eee",
    paddingBottom: "20px"
  },
  heading: { 
    fontSize: "28px", 
    color: "#333", 
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "10px"
  },
  subHeading: { fontSize: "16px", color: "#666", marginTop: "5px" },
  
  // Filter Section
  filterBar: { 
    display: "flex", 
    gap: "15px", 
    alignItems: "center", 
    background: "white", 
    padding: "10px 20px", 
    borderRadius: "30px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    border: "1px solid #eee"
  },
  select: { 
    padding: "8px 12px", 
    borderRadius: "8px", 
    border: "none", 
    outline: "none", 
    fontSize: "14px", 
    minWidth: "150px",
    cursor: "pointer",
    backgroundColor: "transparent",
    fontWeight: "600",
    color: "#555"
  },
  
  // Grid Layout
  grid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", 
    gap: "25px" 
  },
  
  // Doctor Card
  card: { 
    backgroundColor: "white", 
    borderRadius: "16px", 
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)", 
    overflow: "hidden", 
    border: "1px solid #f0f0f0", 
    transition: "transform 0.2s, box-shadow 0.2s",
    display: "flex",
    flexDirection: "column"
  },
  cardHeader: { 
    padding: "20px", 
    display: "flex", 
    gap: "15px",
    borderBottom: "1px solid #f9f9f9"
  },
  avatar: { 
    width: "70px", 
    height: "70px", 
    borderRadius: "50%", 
    backgroundColor: "#e3f2fd", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    fontSize: "30px", 
    color: "#007bff",
    border: "2px solid #fff",
    boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
  },
  info: { flex: 1 },
  name: { fontSize: "18px", fontWeight: "bold", color: "#2d3436", margin: "0 0 5px 0" },
  specialty: { color: "#007bff", fontSize: "14px", fontWeight: "700", marginBottom: "5px", textTransform: "uppercase" },
  exp: { fontSize: "13px", color: "#777", display: "flex", alignItems: "center", gap: "5px" },

  // Location Section inside Card
  locSection: { 
    padding: "15px 20px", 
    backgroundColor: "#fafafa", 
    flex: 1 
  },
  locItem: { 
    display: "flex", 
    justifyContent: "space-between", 
    fontSize: "13px", 
    marginBottom: "10px", 
    color: "#555",
    paddingBottom: "8px",
    borderBottom: "1px dashed #e0e0e0"
  },
  
  // Actions
  actionArea: { padding: "15px 20px", backgroundColor: "white" },
  bookBtn: { 
    width: "100%", 
    padding: "12px", 
    backgroundColor: "#ff9f00", // Orange like your hero button
    color: "white", 
    border: "none", 
    borderRadius: "8px",
    fontSize: "14px", 
    fontWeight: "bold", 
    cursor: "pointer", 
    transition: "background 0.2s",
    boxShadow: "0 4px 10px rgba(255, 159, 0, 0.2)"
  }
};

function FindDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [cities, setCities] = useState([]); // Store unique cities
  const [selectedCity, setSelectedCity] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Get Filters from URL (e.g., ?specialty=Dentist&city=Lahore)
  const params = new URLSearchParams(location.search);
  const targetSpecialty = params.get("specialty");
  const targetCityURL = params.get("city");

  useEffect(() => {
    // If URL has a city, set it as selected
    if (targetCityURL) setSelectedCity(targetCityURL);

    const fetchDoctors = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "doctors"));
        const allDoctors = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        setDoctors(allDoctors);

        // 2. Extract Unique Cities from ALL doctors
        const uniqueCities = new Set();
        allDoctors.forEach(doc => {
            if (doc.city) uniqueCities.add(doc.city);
            if (doc.practiceLocations) {
                doc.practiceLocations.forEach(loc => {
                    if (loc.city) uniqueCities.add(loc.city);
                });
            }
        });
        setCities(Array.from(uniqueCities).sort());

        // 3. Apply Initial Filter
        applyFilters(allDoctors, targetSpecialty, targetCityURL || "");

      } catch (error) {
        console.error("Error fetching doctors:", error);
      }
    };

    fetchDoctors();
  }, [targetSpecialty, targetCityURL]); 

  // 4. Smart Filter Logic
  const applyFilters = (docs, specialty, city) => {
    let results = docs;

    // Filter by Specialty
    if (specialty) {
      results = results.filter(doc => 
        (doc.specialties && doc.specialties.includes(specialty)) || 
        (doc.specialties && doc.specialties.some(s => s.toLowerCase().includes(specialty.toLowerCase()))) ||
        (doc.specialty && doc.specialty.toLowerCase().includes(specialty.toLowerCase())) // Fallback for old data
      );
    }

    // Filter by City (Checks Main City AND Practice Locations)
    if (city) {
      results = results.filter(doc => {
        const mainCityMatch = doc.city?.toLowerCase() === city.toLowerCase();
        const locMatch = doc.practiceLocations?.some(loc => loc.city?.toLowerCase() === city.toLowerCase());
        return mainCityMatch || locMatch;
      });
    }

    setFilteredDoctors(results);
  };

  // Handle Dropdown Change manually
  const handleCityChange = (e) => {
    const newCity = e.target.value;
    setSelectedCity(newCity);
    applyFilters(doctors, targetSpecialty, newCity);
  };

  return (
    <div style={styles.container}>
      
      {/* HEADER SECTION */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.heading}>
            {targetSpecialty ? `Best ${targetSpecialty}s` : "All Top Doctors"} 
            {selectedCity && ` in ${selectedCity}`}
          </h2>
          <p style={styles.subHeading}>{filteredDoctors.length} doctors available near you</p>
        </div>

        {/* CITY FILTER DROPDOWN */}
        <div style={styles.filterBar}>
            <FaFilter color="#007bff"/>
            <span style={{fontSize:"14px", color:"#333"}}>City:</span>
            <select style={styles.select} value={selectedCity} onChange={handleCityChange}>
                <option value="">All Cities</option>
                {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                ))}
            </select>
        </div>
      </div>

      {/* DOCTOR GRID */}
      <div style={styles.grid}>
        {filteredDoctors.length > 0 ? (
          filteredDoctors.map((doc) => (
            <div 
                key={doc.id} 
                style={styles.card}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-5px)";
                    e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)";
                }}
            >
              <div style={styles.cardHeader}>
                <div style={styles.avatar}><FaUserMd/></div>
                <div style={styles.info}>
                  <h3 style={styles.name}>{doc.name}</h3>
                  <div style={styles.specialty}>
                      {Array.isArray(doc.specialties) ? doc.specialties[0] : (doc.specialty || "Specialist")}
                  </div>
                  <div style={styles.exp}><FaStar color="#ffc107"/> {doc.experience}+ Years Experience</div>
                </div>
              </div>

              {/* Show Locations */}
              <div style={styles.locSection}>
                <small style={{fontWeight:"bold", color:"#999", display:"block", marginBottom:"10px"}}>AVAILABLE AT:</small>
                
                {/* Check if we have multiple locations */}
                {doc.practiceLocations && doc.practiceLocations.length > 0 ? (
                    doc.practiceLocations.slice(0, 2).map((loc, idx) => (
                        <div key={idx} style={styles.locItem}>
                            <span><FaHospital color="#007bff" style={{marginRight:"5px"}}/> {loc.hospital} ({loc.city})</span>
                            <span style={{fontWeight:"bold", color:"#333"}}>Rs. {loc.fee}</span>
                        </div>
                    ))
                ) : (
                    // Fallback for old data without locations array
                    <div style={styles.locItem}>
                        <span><FaHospital color="#007bff" style={{marginRight:"5px"}}/> {doc.hospital || "Main Clinic"}</span>
                        <span style={{fontWeight:"bold", color:"#333"}}>Rs. {doc.fee}</span>
                    </div>
                )}
                
                {doc.practiceLocations && doc.practiceLocations.length > 2 && (
                    <small style={{color:"#007bff"}}>+ {doc.practiceLocations.length - 2} more locations</small>
                )}
              </div>

              <div style={styles.actionArea}>
                <button 
                  style={styles.bookBtn}
                  onClick={() => navigate(`/doctor/${doc.id}`)} // Redirect to Profile
                  onMouseOver={(e) => e.target.style.backgroundColor = "#e68900"}
                  onMouseOut={(e) => e.target.style.backgroundColor = "#ff9f00"}
                >
                  View Profile & Book Appointment
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={{gridColumn: "1/-1", textAlign:"center", padding:"50px", color:"#666", backgroundColor:"#f9f9f9", borderRadius:"10px"}}>
            <FaStethoscope size={50} color="#ddd" />
            <h3>No doctors found matching criteria.</h3>
            <p>Try changing the city or searching for a different specialty.</p>
            <button 
                onClick={() => { setSelectedCity(""); navigate("/find-doctors"); }}
                style={{marginTop:"20px", padding:"10px 20px", border:"1px solid #007bff", background:"white", color:"#007bff", borderRadius:"5px", cursor:"pointer"}}
            >
                Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FindDoctors;