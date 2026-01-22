import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom"; 
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../services/firebase";
import { FaMapMarkerAlt, FaStar, FaFilter, FaUserMd, FaPhone, FaExclamationCircle, FaHospital } from "react-icons/fa";

// 🟢 Import HeroSearch
import HeroSearch from "../../components/HeroSearch"; 

// 🎨 Professional Styles
const styles = {
  container: { 
    maxWidth: "1200px", 
    margin: "0 auto", 
    padding: "40px 20px", 
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
  
  // Section Headers
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "40px",
    marginBottom: "20px",
    paddingBottom: "10px",
    borderBottom: "2px solid #eee"
  },
  sectionTitle: { fontSize: "22px", fontWeight: "bold", color: "#2c3e50", margin: 0 },
  badge: { padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", color: "white" },

  // Filter Bar
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

  // Grid
  grid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", 
    gap: "25px" 
  },
  
  // Registered Card
  card: { 
    backgroundColor: "white", 
    borderRadius: "16px", 
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)", 
    overflow: "hidden", 
    border: "1px solid #f0f0f0", 
    transition: "transform 0.2s",
    display: "flex",
    flexDirection: "column"
  },
  cardHeader: { padding: "20px", display: "flex", gap: "15px", borderBottom: "1px solid #f9f9f9" },
  avatar: { width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "#e3f2fd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "#007bff" },
  
  // Unregistered Card
  unregCard: {
    backgroundColor: "#fffbf2", // Light Orange Background
    borderRadius: "12px",
    border: "1px solid #ffeeba",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
  },
  
  // Empty State
  emptyBox: {
    padding: "40px",
    backgroundColor: "#f8f9fa",
    borderRadius: "12px",
    textAlign: "center",
    color: "#666",
    border: "1px dashed #ccc",
    marginTop: "20px",
    gridColumn: "1/-1" // Full width
  },
  
  // Actions
  bookBtn: { width: "100%", padding: "12px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  callBtn: { width: "100%", padding: "10px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }
};

function FindDoctors() {
  const [loading, setLoading] = useState(true);
  
  // Raw Data
  const [allRegistered, setAllRegistered] = useState([]);
  const [allUnregistered, setAllUnregistered] = useState([]);
  const [cities, setCities] = useState([]); 
  
  // Filtered Data
  const [regList, setRegList] = useState([]);
  const [unregList, setUnregList] = useState([]);
  
  const location = useLocation();
  const navigate = useNavigate();

  // Get current filters from URL
  const params = new URLSearchParams(location.search);
  const currentCity = params.get("city") || "";
  const currentSpecialty = params.get("specialty") || "";

  // 🟢 1. FETCH DATA (Runs once)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // A. Fetch Registered (Firebase)
        const querySnapshot = await getDocs(collection(db, "doctors"));
        const regDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllRegistered(regDocs);

        // Extract Cities
        const uniqueCities = new Set();
        regDocs.forEach(doc => {
            if (doc.city) uniqueCities.add(doc.city);
            if (doc.practiceLocations) {
                doc.practiceLocations.forEach(loc => {
                    if (loc.city) uniqueCities.add(loc.city);
                });
            }
        });
        setCities(Array.from(uniqueCities).sort());

        // B. Fetch Unregistered (Text File)
        const response = await fetch("/unregistered_doctors.txt");
        const text = await response.text();
        const unregDocs = text.trim().split("\n").map((line, index) => {
            const [name, specialty, loc, phone, experience] = line.split("|");
            return {
              id: `unreg_${index}`,
              name: name?.trim(),
              specialty: specialty?.trim(),
              location: loc?.trim(), // This is the City/Location
              phone: phone?.trim(),
              experience: experience?.trim()
            };
        }).filter(d => d.name);
        setAllUnregistered(unregDocs);

      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  // 🟢 2. STRICT FILTERING (Runs whenever URL changes or Data loads)
  useEffect(() => {
    // --- Filter Registered Doctors ---
    const filteredReg = allRegistered.filter(doc => {
        // Specialty Check
        const specMatch = currentSpecialty 
            ? (doc.specialties && doc.specialties.some(s => s.toLowerCase().includes(currentSpecialty.toLowerCase()))) ||
              (doc.specialty && doc.specialty.toLowerCase().includes(currentSpecialty.toLowerCase()))
            : true;

        // City Check (Strict logic: "Haripur" should NOT show if searching "Lahor")
        const cityMatch = currentCity
            ? (doc.city?.toLowerCase().includes(currentCity.toLowerCase()) || 
               doc.practiceLocations?.some(loc => loc.city?.toLowerCase().includes(currentCity.toLowerCase())))
            : true;

        return specMatch && cityMatch;
    });
    setRegList(filteredReg);

    // --- Filter Unregistered Doctors ---
    const filteredUnreg = allUnregistered.filter(doc => {
        const specMatch = currentSpecialty 
            ? doc.specialty?.toLowerCase().includes(currentSpecialty.toLowerCase()) 
            : true;
        
        const cityMatch = currentCity
            ? doc.location?.toLowerCase().includes(currentCity.toLowerCase()) 
            : true;

        return specMatch && cityMatch;
    });
    setUnregList(filteredUnreg);

  }, [location.search, allRegistered, allUnregistered, currentCity, currentSpecialty]);


  const handleCall = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  const handleCityFilterChange = (e) => {
    const newCity = e.target.value;
    // Update URL to trigger filter
    navigate(`/find-doctors?city=${encodeURIComponent(newCity)}&specialty=${encodeURIComponent(currentSpecialty)}`);
  };

  return (
    <div>
      <HeroSearch />

      <div style={styles.container}>
        
        {/* Summary Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.heading}>
              {currentSpecialty ? `${currentSpecialty}s` : "Doctors"} 
              {currentCity && <span style={{color:"#007bff", marginLeft:"8px"}}>in {currentCity}</span>}
            </h2>
            <p style={styles.subHeading}>
               {loading ? "Searching..." : `Found ${regList.length} verified and ${unregList.length} other doctors`}
            </p>
          </div>

          <div style={styles.filterBar}>
              <FaFilter color="#007bff"/>
              <span style={{fontSize:"14px", color:"#333"}}>Filter by City:</span>
              <select style={styles.select} value={currentCity} onChange={handleCityFilterChange}>
                  <option value="">All Cities</option>
                  {cities.map(city => (
                      <option key={city} value={city}>{city}</option>
                  ))}
              </select>
          </div>
        </div>

        {/* 🟢 EMPTY STATE: If NO doctors found in EITHER list */}
        {!loading && regList.length === 0 && unregList.length === 0 && (
             <div style={{textAlign:"center", padding:"60px", color:"#666", backgroundColor:"#fff", borderRadius:"15px", border:"1px solid #eee"}}>
                <FaExclamationCircle size={50} color="#ff9f00" />
                <h3 style={{marginTop:"20px"}}>No {currentSpecialty || "doctors"} found in "{currentCity}"</h3>
                <p>We couldn't find any registered or unregistered doctors matching your criteria.</p>
                <button 
                    onClick={() => navigate("/find-doctors")}
                    style={{marginTop:"20px", padding:"10px 25px", border:"1px solid #007bff", background:"white", color:"#007bff", borderRadius:"8px", cursor:"pointer", fontWeight:"bold"}}
                >
                    Clear Filters
                </button>
             </div>
        )}

        {/* ======================================================= */}
        {/* SECTION 1: REGISTERED DOCTORS (Bookable) */}
        {/* ======================================================= */}
        {regList.length > 0 && (
            <>
                <div style={styles.sectionHeader}>
                    <div style={{...styles.badge, backgroundColor:"#28a745"}}>Verified</div>
                    <h3 style={styles.sectionTitle}>Online Booking Available</h3>
                </div>

                <div style={styles.grid}>
                    {regList.map((doc) => (
                        <div 
                            key={doc.id} 
                            style={styles.card}
                            onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-5px)"}
                            onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                        >
                            <div style={styles.cardHeader}>
                                <div style={styles.avatar}><FaUserMd/></div>
                                <div style={{flex:1}}>
                                    <h3 style={{fontSize:"18px", margin:"0 0 5px 0", color:"#333"}}>{doc.name}</h3>
                                    <div style={{color:"#007bff", fontWeight:"bold", fontSize:"13px", textTransform:"uppercase"}}>
                                        {Array.isArray(doc.specialties) ? doc.specialties[0] : doc.specialty}
                                    </div>
                                    <div style={{fontSize:"12px", color:"#777", marginTop:"5px"}}><FaStar color="#ffc107"/> {doc.experience}+ Years Exp</div>
                                </div>
                            </div>

                            <div style={{padding:"15px", backgroundColor:"#fafafa", flex:1}}>
                                <small style={{fontWeight:"bold", color:"#999", display:"block", marginBottom:"10px"}}>AVAILABLE AT:</small>
                                {doc.practiceLocations && doc.practiceLocations.length > 0 ? (
                                    doc.practiceLocations.slice(0, 1).map((loc, idx) => (
                                        <div key={idx} style={{fontSize:"13px", display:"flex", justifyContent:"space-between"}}>
                                            <span><FaHospital color="#007bff"/> {loc.hospital} ({loc.city})</span>
                                            <span style={{fontWeight:"bold"}}>Rs. {loc.fee}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{fontSize:"13px", display:"flex", justifyContent:"space-between"}}>
                                        <span><FaHospital color="#007bff"/> {doc.hospital || "Clinic"}</span>
                                        <span style={{fontWeight:"bold"}}>Rs. {doc.fee}</span>
                                    </div>
                                )}
                            </div>

                            <div style={{padding:"15px"}}>
                                <button 
                                    onClick={() => navigate(`/doctor/${doc.id}`)}
                                    style={styles.bookBtn}
                                >
                                    Book Appointment
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        )}

        {/* ======================================================= */}
        {/* SECTION 2: UNREGISTERED DOCTORS (Call Only) */}
        {/* ======================================================= */}
        {unregList.length > 0 && (
            <>
                <div style={{...styles.sectionHeader, marginTop:"60px", borderBottomColor:"#ffeeba"}}>
                    <div style={{...styles.badge, backgroundColor:"#e67e22"}}>Local Directory</div>
                    <h3 style={styles.sectionTitle}>Other Local Doctors (Call to Book)</h3>
                </div>

                <div style={styles.grid}>
                    {unregList.map((doc, index) => (
                        <div key={index} style={styles.unregCard}>
                            <div>
                                <h4 style={{fontSize:"18px", margin:"0 0 5px 0", color:"#333"}}>{doc.name}</h4>
                                <p style={{color:"#e67e22", fontWeight:"bold", margin:"0", fontSize:"13px"}}>{doc.specialty}</p>
                            </div>
                            
                            <div style={{fontSize:"13px", color:"#555"}}>
                                <p style={{margin:"5px 0"}}><FaMapMarkerAlt/> {doc.location}</p>
                                <p style={{margin:"5px 0"}}><FaStar color="#ffc107"/> {doc.experience}</p>
                            </div>

                            <button 
                                onClick={() => handleCall(doc.phone)}
                                style={{...styles.callBtn, marginTop:"auto"}}
                            >
                                <FaPhone/> {doc.phone}
                            </button>
                        </div>
                    ))}
                </div>
            </>
        )}

      </div>
    </div>
  );
}

export default FindDoctors;