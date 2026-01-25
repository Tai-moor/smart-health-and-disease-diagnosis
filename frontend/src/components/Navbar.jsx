// src/components/Navbar.js
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
// Added FaStethoscope for the Diagnosis Icon
import { FaUserMd, FaCalendarCheck, FaSignOutAlt, FaHome, FaStethoscope, FaFileAlt } from "react-icons/fa";

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 30px",
    backgroundColor: "white",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    position: "sticky",
    top: 0,
    zIndex: 1000,
  },
  logo: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#007bff",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  menu: {
    display: "flex",
    gap: "20px",
    alignItems: "center",
  },
  link: {
    textDecoration: "none",
    color: "#555",
    fontSize: "16px",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "color 0.2s",
  },
  // Style for the new Diagnosis Link to make it stand out slightly
  diagnosisLink: {
    textDecoration: "none",
    color: "#28a745", // Green color for health/diagnosis
    fontSize: "16px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  logoutBtn: {
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    padding: "8px 15px",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
};

function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    // Listen to Auth State
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch Role from Firestore
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRole(docSnap.data().role);
        }
      } else {
        setRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  // Don't show Navbar on Login/Signup pages
  if (!user) return null; 

  return (
    <nav style={styles.nav}>
      <Link to="/home" style={styles.logo}>
        <FaUserMd /> HealthApp
      </Link>

      <div style={styles.menu}>
        {/* Common Link */}
        <Link to="/doctor-search" style={styles.link}>
          <FaHome /> Home
        </Link>

        {/* PATIENT LINKS */}
        {role === "patient" && (
          <>
            <Link to="/find-doctors" style={styles.link}>
              Find Doctors
            </Link>
            
            {/* 🟢 NEW DIAGNOSIS BUTTON */}
            <Link to="/diagnosis" style={styles.diagnosisLink}>
              <FaStethoscope /> AI Diagnosis
            </Link>

            <Link to="/my-appointments" style={styles.link}>
              <FaCalendarCheck /> My Appointments
            </Link>

            <Link to="/health-records" style={styles.link}>
  <FaFileAlt /> Health Records
</Link>
<Link to="/symptom" style={styles.link}>
  <FaFileAlt /> Symptom Predictor
</Link>
          </>
        )}

        {/* DOCTOR LINKS */}
        {role === "doctor" && (
          <Link to="/doctor/dashboard" style={styles.link}>
            Dashboard
          </Link>
        )}

        {/* Logout Button */}
        <button onClick={handleLogout} style={styles.logoutBtn}>
          <FaSignOutAlt /> Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;