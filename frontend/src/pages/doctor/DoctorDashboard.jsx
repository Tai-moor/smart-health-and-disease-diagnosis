import React, { useEffect, useState } from "react";
import { auth, db } from "../../services/firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import ConsultationModal from "./ConsultationModal";
import { FaMapMarkerAlt, FaUser, FaClock, FaCalendarAlt, FaEdit, FaExclamationTriangle, FaUserSlash, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

const styles = {
  container: { padding: "30px", maxWidth: "1200px", margin: "0 auto", fontFamily: "'Segoe UI', sans-serif", backgroundColor: "#f8f9fa", minHeight: "100vh" },
  header: { marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "20px" },
  welcome: { fontSize: "28px", color: "#2c3e50", fontWeight: "700" },
  logoutBtn: { padding: "10px 20px", backgroundColor: "#e74c3c", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" },
  
  loadSection: { display: "flex", gap: "15px", marginBottom: "30px", overflowX: "auto", paddingBottom: "10px" },
  loadCard: (count) => ({
    minWidth: "220px", padding: "15px", borderRadius: "10px", 
    backgroundColor: count > 1 ? "#fff3cd" : "white",
    border: count > 1 ? "1px solid #ffeeba" : "1px solid #eee",
    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
    display: "flex", flexDirection: "column", gap: "5px"
  }),
  
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "30px" },
  statCard: { backgroundColor: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)", textAlign: "center" },
  statNumber: { fontSize: "32px", fontWeight: "800", color: "#2c3e50", margin: "5px 0" },
  statLabel: { color: "#7f8c8d", fontSize: "14px", fontWeight: "600", textTransform: "uppercase" },

  tabContainer: { display: "flex", gap: "10px", marginBottom: "25px", borderBottom: "2px solid #eee" },
  tab: (isActive) => ({
    padding: "12px 25px", cursor: "pointer", borderRadius: "8px 8px 0 0", fontWeight: "600",
    backgroundColor: isActive ? "#fff" : "transparent", color: isActive ? "#007bff" : "#666",
    border: "none", borderBottom: isActive ? "3px solid #007bff" : "3px solid transparent", marginBottom: "-2px"
  }),
  
  list: { display: "flex", flexDirection: "column", gap: "20px" },
  card: { backgroundColor: "white", padding: "25px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: "5px solid #007bff" },
  clinicBadge: { display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#e3f2fd", color: "#007bff", padding: "6px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: "600", marginBottom: "12px" },
  actions: { display: "flex", gap: "10px", flexDirection: "column", minWidth: "160px" },
  
  btnAccept: { padding: "10px", backgroundColor: "#27ae60", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  btnReject: { padding: "10px", backgroundColor: "#e74c3c", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  btnReschedule: { padding: "10px", backgroundColor: "#f39c12", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
  
  // 🟢 NEW: Missed Button Style
  btnMissed: { padding: "10px", backgroundColor: "#95a5a6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" },

  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "white", padding: "30px", borderRadius: "12px", width: "400px", boxShadow: "0 5px 15px rgba(0,0,0,0.3)" },
  modalInput: { width: "100%", padding: "10px", margin: "10px 0", borderRadius: "5px", border: "1px solid #ccc" }
};

function DoctorDashboard() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  
  // Reschedule State
  const [rescheduleData, setRescheduleData] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const formatDateWithDay = (dateStr) => {
    if (!dateStr) return "";
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const fetchAppointments = async () => {
    const user = auth.currentUser;
    if (!user) return navigate("/");
    setLoading(true);
    try {
      const q = query(collection(db, "appointments"), where("doctorId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAppointments(data);
    } catch (error) { console.error("Error", error); }
    setLoading(false);
  };

  useEffect(() => { fetchAppointments(); }, []);

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, "appointments", id), { status: newStatus });
      fetchAppointments();
    } catch (error) { console.error("Error", error); }
  };

  const openRescheduleModal = (app) => {
    setRescheduleData(app);
    setNewDate(app.date);
    setNewTime(app.time);
  };

  const submitReschedule = async () => {
    if (!rescheduleData) return;
    try {
      await updateDoc(doc(db, "appointments", rescheduleData.id), {
        date: newDate,
        time: newTime,
        status: "accepted", 
        slotId: `${rescheduleData.doctorId}_${newDate}_${newTime}_${rescheduleData.doctorHospital}`
      });
      alert(`✅ Appointment moved to ${formatDateWithDay(newDate)} at ${newTime}`);
      setRescheduleData(null);
      fetchAppointments();
    } catch (error) { console.error("Error rescheduling:", error); }
  };

  const getSlotSummary = () => {
    const summary = {};
    appointments.forEach(app => {
      if (app.status === 'pending' || app.status === 'accepted') {
        const key = `${app.date}|${app.time}`;
        summary[key] = (summary[key] || 0) + 1;
      }
    });
    return Object.entries(summary).sort((a, b) => a[0].localeCompare(b[0])); 
  };
  const slotSummary = getSlotSummary();

  const getConflictCount = (date, time) => {
    const summary = {};
    appointments.forEach(app => {
       if (app.status === 'pending' || app.status === 'accepted') {
         const k = `${app.date}|${app.time}`;
         summary[k] = (summary[k] || 0) + 1;
       }
    });
    return summary[`${date}|${time}`] || 0;
  };

  // 🟢 SMART TAB FILTERING
  const filteredAppointments = appointments.filter(app => {
    if (activeTab === 'history') {
      // History shows: Completed, Missed, and Rejected (Full Log)
      return ['completed', 'missed', 'rejected'].includes(app.status);
    }
    return app.status === activeTab;
  });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.welcome}>👨‍⚕️ Doctor Dashboard</div>
        <button style={styles.logoutBtn} onClick={() => { auth.signOut(); navigate("/"); }}>Logout</button>
      </div>

      {/* 🟢 NEW STATS GRID (Counts) */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
            <div style={styles.statLabel}>Pending</div>
            <div style={{...styles.statNumber, color: "#f39c12"}}>{appointments.filter(a => a.status === 'pending').length}</div>
        </div>
        <div style={styles.statCard}>
            <div style={styles.statLabel}>Upcoming</div>
            <div style={{...styles.statNumber, color: "#3498db"}}>{appointments.filter(a => a.status === 'accepted').length}</div>
        </div>
        <div style={styles.statCard}>
            <div style={styles.statLabel}>Completed</div>
            <div style={{...styles.statNumber, color: "#27ae60"}}>{appointments.filter(a => a.status === 'completed').length}</div>
        </div>
        {/* 🟢 MISSED STAT */}
        <div style={styles.statCard}>
            <div style={styles.statLabel}>No-Shows</div>
            <div style={{...styles.statNumber, color: "#e74c3c"}}>{appointments.filter(a => a.status === 'missed').length}</div>
        </div>
      </div>

      <h3 style={{marginBottom: "15px", color: "#555"}}>📅 Schedule Load</h3>
      <div style={styles.loadSection}>
        {slotSummary.length > 0 ? slotSummary.map(([key, count], idx) => {
          const [rawDate, rawTime] = key.split("|");
          return (
            <div key={idx} style={styles.loadCard(count)}>
              <div style={{fontWeight:"bold", fontSize:"16px", color:"#333"}}>{formatDateWithDay(rawDate)}</div>
              <div style={{color:"#555", fontSize:"14px", display:"flex", alignItems:"center", gap:"5px"}}><FaClock color="#007bff"/> {rawTime}</div>
              <div style={{marginTop:"5px", fontWeight:"bold", color: count > 1 ? "#e67e22" : "#2ecc71", fontSize:"13px", display:"flex", alignItems:"center", gap:"5px"}}>
                 {count > 1 ? <FaExclamationTriangle/> : <FaUser/>} {count} Patient{count > 1 ? 's' : ''}
              </div>
            </div>
          );
        }) : <p style={{color:"#999"}}>No active bookings.</p>}
      </div>

      <div style={styles.tabContainer}>
        <button style={styles.tab(activeTab === "pending")} onClick={() => setActiveTab("pending")}>New Requests</button>
        <button style={styles.tab(activeTab === "accepted")} onClick={() => setActiveTab("accepted")}>Upcoming</button>
        <button style={styles.tab(activeTab === "history")} onClick={() => setActiveTab("history")}>History (All)</button>
      </div>

      <div style={styles.list}>
        {loading ? <p>Loading...</p> : filteredAppointments.length === 0 ? <p style={{color:"#777"}}>No {activeTab} appointments found.</p> : (
          filteredAppointments.map(app => {
            const conflictCount = getConflictCount(app.date, app.time);
            return (
              <div key={app.id} style={{...styles.card, borderLeft: app.status === 'missed' ? '5px solid #95a5a6' : app.status === 'rejected' ? '5px solid #e74c3c' : '5px solid #007bff'}}>
                
                <div style={{flex: 1}}>
                  <div style={styles.clinicBadge}>
                      <FaMapMarkerAlt /> {app.doctorHospital} {app.doctorCity ? `(${app.doctorCity})` : ""}
                  </div>

                  <h3 style={{margin: "0 0 8px 0", fontSize: "1.2rem", color: "#2c3e50"}}>
                    <FaUser style={{marginRight:"8px", fontSize:"16px"}}/>
                    {app.patientName} 
                    <span style={{fontSize: "14px", color: "#888", fontWeight:"normal"}}> (CNIC: {app.patientCNIC})</span>
                  </h3>
                  
                  <div style={{display: "flex", alignItems: "center", gap: "8px", color: "#555", fontSize: "14px"}}>
                      <FaCalendarAlt color="#007bff" /> <strong>{formatDateWithDay(app.date)}</strong> 
                      <span style={{margin:"0 5px"}}>|</span> 
                      <FaClock color="#007bff" /> {app.time}
                      
                      {activeTab === 'pending' && conflictCount > 1 && (
                          <span style={{backgroundColor:"#ffeeba", color:"#d35400", padding:"2px 8px", borderRadius:"4px", fontSize:"11px", fontWeight:"bold", marginLeft:"10px"}}>
                              ⚠️ {conflictCount} Requests
                          </span>
                      )}
                  </div>

                  {app.reason && <div style={{fontStyle: "italic", color: "#666", marginTop: "8px"}}>"{app.reason}"</div>}
                  
                  {/* 🟢 STATUS BADGES FOR HISTORY TAB */}
                  {activeTab === 'history' && (
                    <div style={{marginTop: "10px"}}>
                        {app.status === 'completed' && <span style={{color:'green', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px'}}><FaCheckCircle/> Completed</span>}
                        {app.status === 'missed' && <span style={{color:'#7f8c8d', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px'}}><FaUserSlash/> Patient Missed (No-Show)</span>}
                        {app.status === 'rejected' && <span style={{color:'#e74c3c', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px'}}><FaTimesCircle/> Rejected</span>}
                    </div>
                  )}
                </div>

                <div style={styles.actions}>
                  {activeTab === "pending" && (
                    <>
                      <button style={styles.btnAccept} onClick={() => handleStatusUpdate(app.id, "accepted")}>Accept</button>
                      <button style={styles.btnReschedule} onClick={() => openRescheduleModal(app)}><FaEdit /> Move</button>
                      <button style={styles.btnReject} onClick={() => handleStatusUpdate(app.id, "rejected")}>Reject</button>
                    </>
                  )}

                  {activeTab === "accepted" && (
                    <>
                      <button style={{padding: "10px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold"}} onClick={() => setSelectedAppointment(app)}>
                        Start Consultation
                      </button>
                      
                      {/* 🟢 NEW: MARK NO SHOW BUTTON */}
                      <button style={styles.btnMissed} onClick={() => handleStatusUpdate(app.id, "missed")}>
                        <FaUserSlash /> No Show
                      </button>
                    </>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

      {rescheduleData && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3>🔄 Propose New Time</h3>
            <p>Moving appointment for <strong>{rescheduleData.patientName}</strong></p>
            <label style={{fontWeight:"bold", fontSize:"14px"}}>New Date:</label>
            <input type="date" style={styles.modalInput} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <label style={{fontWeight:"bold", fontSize:"14px"}}>New Time:</label>
            <input type="time" style={styles.modalInput} value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            <div style={{display:"flex", gap:"10px", marginTop:"15px"}}>
                <button onClick={submitReschedule} style={{flex:1, padding:"10px", backgroundColor:"#28a745", color:"white", border:"none", borderRadius:"5px", cursor:"pointer"}}>Confirm Change</button>
                <button onClick={() => setRescheduleData(null)} style={{flex:1, padding:"10px", backgroundColor:"#ccc", border:"none", borderRadius:"5px", cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {selectedAppointment && (
        <ConsultationModal 
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onSave={fetchAppointments}
        />
      )}
    </div>
  );
}

export default DoctorDashboard;