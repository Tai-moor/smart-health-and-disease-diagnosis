import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../../services/firebase";
import { doc, getDoc, addDoc, collection, query, where, getDocs } from "firebase/firestore";
import { FaCloudUploadAlt, FaFileAlt, FaMapMarkerAlt, FaMoneyBillWave, FaClock } from "react-icons/fa";

const styles = {
  container: { maxWidth: "900px", margin: "40px auto", padding: "20px", fontFamily: "'Segoe UI', sans-serif" },
  header: { display: "flex", gap: "30px", padding: "30px", backgroundColor: "white", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" },
  avatar: { width: "120px", height: "120px", borderRadius: "12px", backgroundColor: "#e3f2fd", color: "#007bff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", fontWeight: "bold" },
  info: { flex: 1 },
  name: { margin: "0 0 10px 0", color: "#333" },
  subText: { margin: "5px 0", color: "#666", fontSize: "16px" },
  tag: { backgroundColor: "#e3f2fd", color: "#007bff", padding: "5px 10px", borderRadius: "15px", fontSize: "12px", marginRight: "5px" },
  
  bookingCard: { marginTop: "30px", padding: "30px", backgroundColor: "white", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  input: { padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px", backgroundColor: "white" },
  bookBtn: { marginTop: "20px", width: "100%", padding: "15px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "8px", fontSize: "18px", fontWeight: "bold", cursor: "pointer" },
  
  fileLabel: { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "15px", border: "2px dashed #007bff", borderRadius: "8px", cursor: "pointer", backgroundColor: "#f8f9fa", color: "#007bff", fontWeight: "bold", marginTop: "20px" },
  
  infoBox: { backgroundColor: "#e0f7fa", padding: "15px", borderRadius: "8px", marginTop: "15px", border: "1px solid #b2ebf2", color: "#006064" }
};

function DoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Booking State
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(""); 
  const [selectedLocation, setSelectedLocation] = useState(null); 
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [patientName, setPatientName] = useState("");
  const [cnic, setCnic] = useState("");
  
  const [file, setFile] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const CLOUD_NAME = "ddv7wtes6"; 
  const UPLOAD_PRESET = "healthapp_preset"; 

  // 🟢 NEW: Dynamic Slot Generator
  const generateSlots = (timeString) => {
    if (!timeString) return [];
    
    // Example Input: "09:00 AM - 05:00 PM"
    try {
      const [startStr, endStr] = timeString.split(" - ");
      
      // Helper to convert "09:00 AM" to minutes (e.g., 540)
      const parseTime = (t) => {
        const [time, modifier] = t.split(" ");
        let [hours, minutes] = time.split(":").map(Number);
        if (modifier === "PM" && hours !== 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      const start = parseTime(startStr);
      const end = parseTime(endStr);
      const slots = [];

      // Generate slots every 20 minutes
      for (let t = start; t < end; t += 20) {
        const h = Math.floor(t / 60);
        const m = t % 60;
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        const timeLabel = `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
        slots.push(timeLabel);
      }
      return slots;
    } catch (e) {
      console.error("Error parsing time:", e);
      // Fallback if format is weird
      return ["10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "04:00 PM"];
    }
  };

  const [availableSlots, setAvailableSlots] = useState([]);

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const docSnap = await getDoc(doc(db, "doctors", id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDoctor(data);
          
          if (data.practiceLocations && data.practiceLocations.length > 0) {
            setSelectedLocationIndex(0);
            setSelectedLocation(data.practiceLocations[0]);
            // Generate slots for the first location immediately
            setAvailableSlots(generateSlots(data.practiceLocations[0].time));
          } else {
            const legacyLoc = {
              hospital: data.hospital, fee: data.fee, time: "09:00 AM - 05:00 PM", city: data.city || ""
            };
            setSelectedLocation(legacyLoc);
            setAvailableSlots(generateSlots(legacyLoc.time));
          }
        } else {
          alert("Doctor not found!");
          navigate("/home");
        }
      } catch (error) { console.error(error); }
      setLoading(false);
    };

    if (auth.currentUser) setPatientName(auth.currentUser.displayName || "");
    fetchDoctor();
  }, [id, navigate]);

  // Handle Location Change
  const handleLocationChange = (e) => {
    const index = e.target.value;
    setSelectedLocationIndex(index);
    if (doctor.practiceLocations && doctor.practiceLocations[index]) {
      const loc = doctor.practiceLocations[index];
      setSelectedLocation(loc);
      // 🟢 Regenerate slots when location changes
      setAvailableSlots(generateSlots(loc.time));
    }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return alert("Please Login first");
    if (!selectedLocation || !time || !date) return alert("Please complete all fields.");

    setBookingLoading(true);

    try {
      const slotId = `${id}_${date}_${time}_${selectedLocation.hospital}`;
      const q = query(collection(db, "appointments"), where("slotId", "==", slotId));
      const snap = await getDocs(q);

      if (!snap.empty) {
        alert("⚠️ This time slot is already booked. Please choose another.");
        setBookingLoading(false);
        return;
      }

      let reportUrl = "";
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message);
        reportUrl = data.secure_url;
      }

      await addDoc(collection(db, "appointments"), {
        doctorId: id,
        doctorName: doctor.name,
        doctorHospital: selectedLocation.hospital,
        doctorCity: selectedLocation.city || "", // Save city to appointment too
        patientId: auth.currentUser.uid,
        patientName, patientCNIC: cnic,
        date, time, reason, reportUrl, slotId,
        status: "pending",
        createdAt: new Date().toISOString()
      });

      alert("✅ Request Sent!");
      navigate("/home");

    } catch (error) {
      console.error(error);
      alert("Booking failed: " + error.message);
    }
    setBookingLoading(false);
  };

  if (loading) return <p style={{textAlign:"center", marginTop:"50px"}}>Loading...</p>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.avatar}>{doctor.name.charAt(0)}</div>
        <div style={styles.info}>
          <h1 style={styles.name}>{doctor.name}</h1>
          <div style={{marginBottom: "10px"}}>
            {doctor.specialties?.map((s, i) => <span key={i} style={styles.tag}>{s}</span>)}
          </div>
          <p style={{color: "#666"}}>{doctor.experience} Years Experience</p>
        </div>
      </div>

      <div style={styles.bookingCard}>
        <h3>📅 Book Appointment</h3>
        
        <form onSubmit={handleBook}>
          
          <div style={styles.formGrid}>
            <div style={styles.inputGroup}>
              <label>Patient Name</label>
              <input type="text" style={styles.input} required value={patientName} onChange={(e) => setPatientName(e.target.value)} />
            </div>
            <div style={styles.inputGroup}>
              <label>Patient CNIC (No Dashes)</label>
              <input type="text" style={styles.input} required placeholder="37405..." value={cnic} onChange={(e) => setCnic(e.target.value)} />
            </div>
          </div>

          <div style={{marginTop: "20px"}}>
            <label style={{fontWeight:"bold", display:"block", marginBottom:"5px"}}>Select Hospital / Clinic:</label>
            
            {doctor.practiceLocations && doctor.practiceLocations.length > 0 ? (
              <select style={styles.input} value={selectedLocationIndex} onChange={handleLocationChange}>
                {doctor.practiceLocations.map((loc, index) => (
                  // 🟢 UPDATED: Shows "Hospital Name (City)" in dropdown
                  <option key={index} value={index}>
                    {loc.hospital} {loc.city ? `(${loc.city})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input style={styles.input} value={`${doctor.hospital} ${doctor.city ? `(${doctor.city})` : ""}`} disabled />
            )}

            {selectedLocation && (
              <div style={styles.infoBox}>
                <div style={{display:"flex", alignItems:"center", gap:"10px", marginBottom:"5px"}}>
                   {/* 🟢 UPDATED: Shows City in the details box too */}
                   <FaMapMarkerAlt/> <strong>{selectedLocation.hospital} {selectedLocation.city ? `(${selectedLocation.city})` : ""}</strong>
                </div>
                <div style={{display:"flex", alignItems:"center", gap:"10px", marginBottom:"5px"}}>
                   <FaClock/> {selectedLocation.time || "09:00 AM - 05:00 PM"}
                </div>
                <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
                   <FaMoneyBillWave/> Fee: <strong>Rs {selectedLocation.fee}</strong>
                </div>
              </div>
            )}
          </div>

          <div style={styles.formGrid}>
            <div style={styles.inputGroup}>
              <label>Date</label>
              <input type="date" style={styles.input} required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div style={styles.inputGroup}>
              <label>Time Slot</label>
              <select style={styles.input} required value={time} onChange={(e) => setTime(e.target.value)}>
                <option value="">Select a Slot</option>
                
                {/* 🟢 DYNAMIC SLOTS RENDERED HERE */}
                {availableSlots.map((slot, i) => (
                  <option key={i} value={slot}>{slot}</option>
                ))}

              </select>
            </div>
          </div>

          <div style={{...styles.inputGroup, marginTop: "20px"}}>
            <label>Reason</label>
            <textarea rows="2" style={styles.input} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <label style={styles.fileLabel}>
            {file ? <span style={{color:'green'}}><FaFileAlt/> {file.name}</span> : <><FaCloudUploadAlt size={24}/> <span>Attach Report (Optional)</span></>}
            <input type="file" style={{display:"none"}} onChange={(e) => setFile(e.target.files[0])} accept="image/*,.pdf" />
          </label>

          <button type="submit" style={styles.bookBtn} disabled={bookingLoading}>
            {bookingLoading ? "Processing..." : "Confirm Appointment"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default DoctorProfile;