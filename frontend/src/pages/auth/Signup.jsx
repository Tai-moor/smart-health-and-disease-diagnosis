import React, { useState, useMemo } from "react";
import { auth, db } from "../../services/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, writeBatch } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { FaUserMd, FaHospital, FaClock, FaMoneyBillWave, FaTrash, FaPlusCircle, FaMapMarkerAlt } from "react-icons/fa";

// 🎨 Modern Styles (Glassmorphism & Gradient)
const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #e0f7fa 0%, #e1bee7 100%)",
    fontFamily: "'Inter', sans-serif",
    padding: "40px 20px",
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(10px)",
    padding: "40px",
    borderRadius: "20px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
    width: "100%",
    maxWidth: "700px",
    border: "1px solid rgba(255,255,255,0.5)",
  },
  header: { textAlign: "center", marginBottom: "30px" },
  title: { fontSize: "2rem", color: "#333", fontWeight: "800", marginBottom: "10px" },
  subtitle: { color: "#666", fontSize: "1rem" },
  
  // Inputs
  inputGroup: { marginBottom: "20px" },
  label: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#444" },
  input: {
    width: "100%", padding: "14px", border: "2px solid #eee", borderRadius: "10px",
    fontSize: "16px", transition: "border 0.3s", outline: "none", backgroundColor: "#f9f9f9"
  },
  select: { width: "100%", padding: "14px", border: "2px solid #eee", borderRadius: "10px", fontSize: "16px", backgroundColor: "white" },
  
  // Doctor Toggle
  toggleBox: {
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "15px", backgroundColor: "#e3f2fd", borderRadius: "12px",
    cursor: "pointer", border: "2px solid #90caf9", transition: "0.2s"
  },
  
  // Location Card
  locationCard: {
    backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e0e0e0",
    marginBottom: "15px", position: "relative", boxShadow: "0 4px 10px rgba(0,0,0,0.02)"
  },
  removeBtn: {
    position: "absolute", top: "10px", right: "10px", color: "#dc3545",
    background: "none", border: "none", cursor: "pointer", fontSize: "16px"
  },
  addBtn: {
    width: "100%", padding: "12px", backgroundColor: "#fff", color: "#007bff",
    border: "2px dashed #007bff", borderRadius: "10px", cursor: "pointer", fontWeight: "bold",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    marginBottom: "20px", transition: "0.2s"
  },

  // Main Button
  submitBtn: {
    width: "100%", padding: "16px", backgroundColor: "#007bff", color: "white",
    border: "none", borderRadius: "12px", fontSize: "18px", fontWeight: "bold",
    cursor: "pointer", boxShadow: "0 4px 15px rgba(0, 123, 255, 0.3)",
    transition: "transform 0.2s"
  },
  
  // Search Tags
  tagContainer: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" },
  tag: { backgroundColor: "#007bff", color: "white", padding: "6px 14px", borderRadius: "20px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" },
  searchList: { maxHeight: "150px", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px", marginTop: "5px", background: "white", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" },
  searchItem: { padding: "12px", cursor: "pointer", borderBottom: "1px solid #f0f0f0", fontSize: "14px", color: "#333" }
};

const allSpecialties = [
  "Cardiologist", "Dermatologist", "Dentist", "Neurologist", "Gynecologist", "Psychiatrist",
  "ENT Specialist", "Orthopedic Surgeon", "Pediatrician", "Urologist", "Gastroenterologist",
  "Pulmonologist", "General Physician", "Eye Specialist"
].sort();

function Signup() {
  const navigate = useNavigate();
  // 🟢 ADDED: 'city' to general formData
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", city: "", password: "", gender: "male", experience: "", about: "", services: "" });
  const [isDoctor, setIsDoctor] = useState(false);
  const [specialties, setSpecialties] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  // 🟢 UPDATED: 'city' added to location object structure
  const [locations, setLocations] = useState([
    { hospital: "", city: "", days: "Mon - Fri", time: "09:00 AM - 05:00 PM", fee: "" }
  ]);

  const addLocation = () => {
    // 🟢 Ensure new locations also have a city field
    setLocations([...locations, { hospital: "", city: "", days: "Mon - Fri", time: "09:00 AM - 05:00 PM", fee: "" }]);
  };

  const removeLocation = (index) => {
    const newLocs = locations.filter((_, i) => i !== index);
    setLocations(newLocs);
  };

  const updateLocation = (index, field, value) => {
    const newLocs = [...locations];
    newLocs[index][field] = value;
    setLocations(newLocs);
  };

  const filteredSpecialties = useMemo(() => {
    if (!searchTerm) return [];
    return allSpecialties.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()) && !specialties.includes(s));
  }, [searchTerm, specialties]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: formData.name });

      const batch = writeBatch(db);
      const userRef = doc(db, "users", user.uid);
      
      const baseData = {
        uid: user.uid, 
        name: formData.name, 
        email: formData.email, 
        phone: formData.phone,
        city: formData.city, // 🟢 Saved to User Profile
        gender: formData.gender, 
        role: isDoctor ? "doctor" : "patient", 
        createdAt: new Date().toISOString()
      };

      batch.set(userRef, baseData);

      if (isDoctor) {
        const doctorRef = doc(db, "doctors", user.uid);
        batch.set(doctorRef, {
          ...baseData,
          experience: Number(formData.experience),
          about: formData.about,
          services: formData.services.split(",").map(s => s.trim()),
          specialties: specialties,
          practiceLocations: locations, // 🟢 Saves Array containing Cities
          // Legacy fields mapping to first location
          hospital: locations[0]?.hospital || "", 
          city: locations[0]?.city || "", // 🟢 Main city fallback
          fee: locations[0]?.fee || 0,
          verified: false
        });
      }

      await batch.commit();
      alert("🎉 Account Created Successfully!");
      navigate(isDoctor ? "/doctor/dashboard" : "/home");

    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>{isDoctor ? "Join as a Doctor" : "Create Patient Account"}</h2>
          <p style={styles.subtitle}>Start your healthcare journey with us today.</p>
        </div>

        <form onSubmit={handleSignup}>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>Full Name</label>
            <input style={styles.input} onChange={(e) => setFormData({...formData, name: e.target.value})} required placeholder="John Doe" />
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{flex: 1}}>
              <label style={styles.label}>Phone</label>
              <input style={styles.input} onChange={(e) => setFormData({...formData, phone: e.target.value})} required placeholder="+92 300..." />
            </div>
            
            {/* 🟢 NEW: General City Input */}
            <div style={{flex: 1}}>
              <label style={styles.label}>City</label>
              <input style={styles.input} onChange={(e) => setFormData({...formData, city: e.target.value})} required placeholder="e.g. Lahore" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
             <div style={{flex: 1}}>
                <label style={styles.label}>Gender</label>
                <select style={styles.select} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
             </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <input type="email" style={styles.input} onChange={(e) => setFormData({...formData, email: e.target.value})} required placeholder="name@example.com" />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input type="password" style={styles.input} onChange={(e) => setFormData({...formData, password: e.target.value})} required placeholder="••••••••" />
          </div>

          {/* Doctor Toggle */}
          <div style={styles.inputGroup}>
            <div style={styles.toggleBox} onClick={() => setIsDoctor(!isDoctor)}>
              <FaUserMd size={20} color={isDoctor ? "#007bff" : "#666"} style={{marginRight: "10px"}} />
              <span style={{fontWeight: "bold", color: isDoctor ? "#007bff" : "#555"}}>
                {isDoctor ? "Registering as a Doctor" : "Click here if you are a Doctor"}
              </span>
            </div>
          </div>

          {/* DOCTOR FIELDS */}
          {isDoctor && (
            <div style={{marginTop: "30px", padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "15px"}}>
              <h4 style={{marginBottom: "20px", color: "#333"}}>Professional Profile</h4>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Specialties</label>
                <input 
                  style={styles.input} 
                  placeholder="Search (e.g. Cardio)" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
                {searchTerm && (
                  <div style={styles.searchList}>
                    {filteredSpecialties.map(s => (
                      <div key={s} style={styles.searchItem} onClick={() => {
                        setSpecialties([...specialties, s]); setSearchTerm("");
                      }}>+ {s}</div>
                    ))}
                  </div>
                )}
                <div style={styles.tagContainer}>
                  {specialties.map(s => (
                    <span key={s} style={styles.tag} onClick={() => setSpecialties(specialties.filter(i => i !== s))}>
                      {s} &times;
                    </span>
                  ))}
                </div>
              </div>

              {/* 🟢 DYNAMIC LOCATIONS WITH CITY */}
              <label style={styles.label}>Practice Locations</label>
              {locations.map((loc, index) => (
                <div key={index} style={styles.locationCard}>
                  {index > 0 && <button type="button" style={styles.removeBtn} onClick={() => removeLocation(index)}><FaTrash/></button>}
                  
                  {/* Row 1: Hospital & City */}
                  <div style={{display: "flex", gap: "10px", marginBottom: "10px"}}>
                    <div style={{flex: 1}}>
                      <div style={{display:"flex", alignItems:"center", gap:"5px", marginBottom:"5px", fontSize:"12px", color:"#666"}}><FaHospital/> Hospital Name</div>
                      <input style={styles.input} placeholder="e.g. City Hospital" value={loc.hospital} onChange={(e) => updateLocation(index, 'hospital', e.target.value)} required />
                    </div>
                    {/* 🟢 NEW: Practice City Input */}
                    <div style={{flex: 1}}>
                      <div style={{display:"flex", alignItems:"center", gap:"5px", marginBottom:"5px", fontSize:"12px", color:"#666"}}><FaMapMarkerAlt/> City</div>
                      <input style={styles.input} placeholder="e.g. Islamabad" value={loc.city} onChange={(e) => updateLocation(index, 'city', e.target.value)} required />
                    </div>
                  </div>

                  {/* Row 2: Fee & Time */}
                  <div style={{display: "flex", gap: "10px"}}>
                     <div style={{width: "120px"}}>
                      <div style={{display:"flex", alignItems:"center", gap:"5px", marginBottom:"5px", fontSize:"12px", color:"#666"}}><FaMoneyBillWave/> Fee</div>
                      <input type="number" style={styles.input} placeholder="2000" value={loc.fee} onChange={(e) => updateLocation(index, 'fee', e.target.value)} required />
                    </div>
                    <div style={{flex: 1}}>
                      <div style={{display:"flex", alignItems:"center", gap:"5px", marginBottom:"5px", fontSize:"12px", color:"#666"}}><FaClock/> Timings</div>
                      <input style={styles.input} placeholder="09:00 AM - 05:00 PM" value={loc.time} onChange={(e) => updateLocation(index, 'time', e.target.value)} required />
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" style={styles.addBtn} onClick={addLocation}>
                <FaPlusCircle /> Add Another Clinic/Hospital
              </button>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Experience (Years)</label>
                <input type="number" style={styles.input} onChange={(e) => setFormData({...formData, experience: e.target.value})} />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Bio / About</label>
                <textarea rows="3" style={styles.input} onChange={(e) => setFormData({...formData, about: e.target.value})} placeholder="Tell patients about yourself..." />
              </div>
            </div>
          )}

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <p style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
            Already have an account? <Link to="/" style={{ color: '#007bff', fontWeight: "bold" }}>Login here</Link>
          </p>

        </form>
      </div>
    </div>
  );
}

export default Signup;