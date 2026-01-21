import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPhone, FaStethoscope } from 'react-icons/fa';
import { auth } from '../../services/firebase';

// 🟢 Import your new professional components
import HeroSearch from "../../components/HeroSearch"; 
import Conditions from "../../components/Conditions";

function Landing() {
  const navigate = useNavigate();
  const [nearbyDoctors, setNearbyDoctors] = useState([]);

  useEffect(() => {
    // Fetch unregistered doctors from the text file (Your existing logic)
    fetch("/unregistered_doctors.txt")
      .then((response) => response.text())
      .then((text) => {
        const doctorList = text
          .trim()
          .split("\n")
          .map((line) => {
            const [name, specialty, location, phone, experience] = line.split("|");
            return {
              id: name.toLowerCase().replace(/\s+/g, "-"),
              name: name.trim(),
              specialty: specialty.trim(),
              location: location.trim(),
              phone: phone.trim(),
              experience: experience.trim(),
            };
          })
          .slice(0, 3); // Show only first 3 doctors
        setNearbyDoctors(doctorList);
      })
      .catch((error) => console.error("Error loading doctors:", error));
  }, []);

  const handleLogout = () => {
    auth.signOut();
    navigate('/');
  };

  const handleCallDoctor = (phone) => {
    window.location.href = `tel:${phone.replace(/\s+/g, "")}`;
  };

  return (
    // 🟢 Container changed: Removed default padding so Hero Banner is full-width
    <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh", paddingBottom: "50px" }}>
      
      {/* 1. PROFESSIONAL HERO SEARCH BANNER */}
      <HeroSearch />

      {/* 2. CONDITIONS SECTION */}
      <Conditions />

      {/* 3. AI DIAGNOSIS & SERVICES SECTION */}
      <div style={{ maxWidth: "1200px", margin: "20px auto", padding: "0 20px" }}>
        <div 
            onClick={() => navigate('/diagnosis')}
            style={{
                background: "linear-gradient(135deg, #28a745 0%, #85d8ce 100%)",
                borderRadius: "15px",
                padding: "30px",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 10px 25px rgba(40, 167, 69, 0.3)",
                transition: "transform 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
            <div>
                <h2 style={{ margin: 0, fontSize: "24px" }}>🤖 AI Disease Diagnosis</h2>
                <p style={{ margin: "5px 0 0", opacity: 0.9 }}>Not feeling well? Check your symptoms instantly with AI.</p>
            </div>
            <FaStethoscope size={40} style={{ opacity: 0.8 }} />
        </div>
      </div>

      {/* 4. YOUR EXISTING UNREGISTERED DOCTORS LOGIC */}
      <div style={{ maxWidth: "1200px", margin: "40px auto", padding: "0 20px" }}>
        
        <h2 style={{ fontSize: '1.8rem', color: '#333', marginBottom: '10px', borderLeft: "5px solid #ff9800", paddingLeft: "15px" }}>
           Find Local Doctors (Unregistered)
        </h2>
        <p style={{ color: '#666', marginBottom: '30px', fontSize: '1rem' }}>
           Search for qualified doctors in your area who are not yet registered on our app. Call directly to book.
        </p>

        {nearbyDoctors.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {nearbyDoctors.map((doctor) => (
              <div
                key={doctor.id}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '10px',
                  padding: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                  textAlign: 'left',
                }}
              >
                <h4 style={{ fontSize: '1.1rem', color: '#333', margin: '0 0 8px 0' }}>
                  {doctor.name}
                </h4>
                <p style={{ color: '#007bff', fontWeight: '600', margin: '5px 0', fontSize: '0.9rem' }}>
                  {doctor.specialty}
                </p>
                <p style={{ color: '#666', margin: '5px 0', fontSize: '0.85rem' }}>
                  📍 {doctor.location}
                </p>
                <p style={{ color: '#999', margin: '8px 0 15px 0', fontSize: '0.8rem' }}>
                  {doctor.experience}
                </p>
                <button
                  onClick={() => handleCallDoctor(doctor.phone)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <FaPhone /> Call Now
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#999' }}>Loading nearby doctors...</p>
        )}

        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "40px", borderTop: "1px solid #ddd", paddingTop: "20px"}}>
            <button
            onClick={() => navigate('/unregistered-doctors')}
            style={{
                padding: '12px 30px',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
            }}
            >
            View All Unregistered Doctors
            </button>

            <button 
            onClick={handleLogout} 
            style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
            >
            Logout
            </button>
        </div>
      </div>
    </div>
  );
}

export default Landing;