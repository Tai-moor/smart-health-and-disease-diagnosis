import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { db } from "../../services/firebase";
import { collection, getDocs } from "firebase/firestore";
import { FaMapMarkerAlt, FaStar, FaUserMd, FaPhone, FaExclamationCircle, FaHospital } from "react-icons/fa";

// 🎨 Styles
const styles = {
  container: { padding: "40px 20px", maxWidth: "1000px", margin: "0 auto", fontFamily: "'Segoe UI', sans-serif" },
  
  // Section Headers
  sectionHeader: {
    display: "flex", alignItems: "center", gap: "10px", marginTop: "40px", marginBottom: "20px",
    paddingBottom: "10px", borderBottom: "2px solid #eee"
  },
  sectionTitle: { fontSize: "22px", fontWeight: "bold", color: "#2c3e50", margin: 0 },
  badge: { padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", color: "white" },

  // Cards
  grid: { display: "flex", flexDirection: "column", gap: "20px" },
  
  // Registered Card
  card: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "25px",
    border: "1px solid #eee", borderRadius: "12px", backgroundColor: "white",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)", transition: "transform 0.2s",
  },
  infoSection: { display: "flex", gap: "20px", alignItems: "center" },
  avatar: {
    width: "80px", height: "80px", borderRadius: "50%",
    backgroundColor: "#e3f2fd", color: "#007bff", display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: "bold"
  },
  details: { display: "flex", flexDirection: "column", gap: "5px" },
  name: { margin: 0, fontSize: "1.2rem", color: "#333" },
  specialty: { margin: 0, color: "#007bff", fontWeight: "600", fontSize: "0.9rem" },
  hospital: { margin: 0, color: "#666", fontSize: "0.9rem" },
  stats: { margin: 0, color: "#888", fontSize: "0.85rem", marginTop: "5px" },
  
  actionSection: { textAlign: "right", minWidth: "120px" },
  price: { fontSize: "1.1rem", fontWeight: "bold", color: "#28a745", marginBottom: "10px", display: "block" },
  bookBtn: {
    padding: "12px 25px", backgroundColor: "#007bff", color: "white", border: "none",
    borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px",
    transition: "background 0.2s",
  },

  // Unregistered Card
  unregCard: {
    padding: "20px", backgroundColor: "#fffbf2", border: "1px solid #ffeeba",
    borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    display: "flex", justifyContent: "space-between", alignItems: "center"
  },
  callBtn: {
    padding: "10px 20px", backgroundColor: "#28a745", color: "white", border: "none",
    borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px"
  },

  noResult: { textAlign: "center", padding: "50px", color: "#777", backgroundColor: "#f9f9f9", borderRadius: "10px" }
};

function DoctorList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 1. Get Params from URL
  const specialtyParam = searchParams.get("specialty") || ""; 
  const cityParam = searchParams.get("city") || "";

  const [regDoctors, setRegDoctors] = useState([]);
  const [unregDoctors, setUnregDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // ============================================
        // 1. FETCH REGISTERED DOCTORS (Firebase)
        // ============================================
        const querySnapshot = await getDocs(collection(db, "doctors"));
        const allFirebaseDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // STRICT FILTERING
        const filteredReg = allFirebaseDocs.filter(doc => {
            // Specialty Check
            const specMatch = specialtyParam 
                ? (doc.specialties && doc.specialties.some(s => s.toLowerCase().includes(specialtyParam.toLowerCase())))
                : true;

            // City Check (Strict: Must match City field or Practice Location)
            const cityMatch = cityParam
                ? (doc.city?.toLowerCase().includes(cityParam.toLowerCase()) || 
                   doc.practiceLocations?.some(loc => loc.city?.toLowerCase().includes(cityParam.toLowerCase())))
                : true;

            return specMatch && cityMatch;
        });
        setRegDoctors(filteredReg);

        // ============================================
        // 2. FETCH UNREGISTERED DOCTORS (Text File)
        // ============================================
        const response = await fetch("/unregistered_doctors.txt");
        const text = await response.text();
        const allTextDocs = text.trim().split("\n").map((line, index) => {
            const [name, specialty, loc, phone, experience] = line.split("|");
            return {
              id: `unreg_${index}`,
              name: name?.trim(),
              specialty: specialty?.trim(),
              location: loc?.trim(), // Contains City info
              phone: phone?.trim(),
              experience: experience?.trim()
            };
        }).filter(d => d.name);

        // STRICT FILTERING
        const filteredUnreg = allTextDocs.filter(doc => {
            const specMatch = specialtyParam 
                ? doc.specialty?.toLowerCase().includes(specialtyParam.toLowerCase()) 
                : true;
            
            const cityMatch = cityParam
                ? doc.location?.toLowerCase().includes(cityParam.toLowerCase()) 
                : true;

            return specMatch && cityMatch;
        });
        setUnregDoctors(filteredUnreg);

      } catch (error) {
        console.error("Error loading data:", error);
      }
      setLoading(false);
    };

    fetchData();
  }, [specialtyParam, cityParam]); // Re-run when URL changes

  const handleCall = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  return (
    <div style={styles.container}>
      <h2>
        {specialtyParam ? `${specialtyParam}s` : "Doctors"} 
        {cityParam && <span style={{color: "#007bff"}}> in {cityParam}</span>}
      </h2>

      {loading ? (
        <p>Searching...</p>
      ) : regDoctors.length === 0 && unregDoctors.length === 0 ? (
        
        /* 🟢 EMPTY STATE */
        <div style={styles.noResult}>
          <FaExclamationCircle size={40} color="#ccc"/>
          <h3>No doctors found.</h3>
          <p>We couldn't find any <b>{specialtyParam}</b> in <b>{cityParam}</b>.</p>
          <button 
            onClick={() => navigate('/home')}
            style={{...styles.bookBtn, backgroundColor: "#6c757d", marginTop: "10px"}}
          >
            Go Back & Search Again
          </button>
        </div>

      ) : (
        <>
          {/* ==================================== */}
          {/* SECTION 1: VERIFIED REGISTERED DOCTORS */}
          {/* ==================================== */}
          {regDoctors.length > 0 && (
            <>
                <div style={styles.sectionHeader}>
                    <div style={{...styles.badge, backgroundColor:"#28a745"}}>Verified</div>
                    <h3 style={styles.sectionTitle}>Book Appointment Online</h3>
                </div>

                <div style={styles.grid}>
                    {regDoctors.map((doc) => (
                    <div key={doc.id} style={styles.card}>
                        <div style={styles.infoSection}>
                            <div style={styles.avatar}><FaUserMd/></div>
                            <div style={styles.details}>
                                <h3 style={styles.name}>{doc.name}</h3>
                                
                                {/* 🟢 NEW: RATING DISPLAY ADDED HERE */}
                                <div style={{display:"flex", alignItems:"center", gap:"5px", margin:"0"}}>
                                    <FaStar color="#ffc107" size={14} />
                                    <span style={{fontWeight:"bold", color:"#333", fontSize:"14px"}}>
                                        {doc.averageRating ? doc.averageRating : "New"}
                                    </span>
                                    <span style={{color:"#888", fontSize:"12px"}}>
                                        ({doc.totalReviews || 0} reviews)
                                    </span>
                                </div>

                                <p style={styles.specialty}>{doc.specialties ? doc.specialties.join(", ") : "Specialist"}</p>
                                <p style={styles.hospital}>
                                    <FaHospital style={{marginRight:"5px"}}/>
                                    {doc.hospital || (doc.practiceLocations && doc.practiceLocations[0]?.hospital) || "Clinic"}
                                    {doc.city ? ` (${doc.city})` : ""}
                                </p>
                                <p style={styles.stats}>
                                    <FaStar color="#ffc107"/> {doc.experience} Years Exp
                                </p>
                            </div>
                        </div>

                        <div style={styles.actionSection}>
                            <span style={styles.price}>Rs {doc.fee || (doc.practiceLocations && doc.practiceLocations[0]?.fee) || 0}</span>
                            <button 
                                style={styles.bookBtn}
                                onClick={() => navigate(`/doctor/${doc.id}`)}
                            >
                                Book
                            </button>
                        </div>
                    </div>
                    ))}
                </div>
            </>
          )}

          {/* ==================================== */}
          {/* SECTION 2: UNREGISTERED LOCAL DOCTORS */}
          {/* ==================================== */}
          {unregDoctors.length > 0 && (
            <>
                <div style={{...styles.sectionHeader, borderBottomColor:"#ffeeba", marginTop: "50px"}}>
                    <div style={{...styles.badge, backgroundColor:"#e67e22"}}>Local Directory</div>
                    <h3 style={styles.sectionTitle}>Other Local Doctors (Call Only)</h3>
                </div>

                <div style={styles.grid}>
                    {unregDoctors.map((doc, idx) => (
                    <div key={idx} style={styles.unregCard}>
                        <div>
                            <h3 style={{fontSize:"18px", margin:"0 0 5px 0", color:"#333"}}>{doc.name}</h3>
                            <p style={{color:"#e67e22", fontWeight:"bold", margin:"0 0 5px 0", fontSize:"14px"}}>{doc.specialty}</p>
                            <p style={{color:"#666", fontSize:"14px", margin:0}}>
                                <FaMapMarkerAlt/> {doc.location}
                            </p>
                        </div>
                        
                        <button 
                            style={styles.callBtn}
                            onClick={() => handleCall(doc.phone)}
                        >
                            <FaPhone/> Call {doc.phone}
                        </button>
                    </div>
                    ))}
                </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default DoctorList;