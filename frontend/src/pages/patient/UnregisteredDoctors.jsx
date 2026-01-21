import React, { useState, useEffect } from "react";
import { FaPhone, FaUserPlus, FaMapMarkerAlt, FaStethoscope, FaGraduationCap } from "react-icons/fa";

// 🎨 Styles
const styles = {
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
    marginBottom: "15px",
    fontWeight: "700",
  },
  subheading: {
    textAlign: "center",
    color: "#666",
    fontSize: "1rem",
    marginBottom: "40px",
  },
  filterContainer: {
    display: "flex",
    gap: "15px",
    marginBottom: "30px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  filterInput: {
    padding: "10px 15px",
    fontSize: "14px",
    borderRadius: "8px",
    border: "2px solid #ddd",
    outline: "none",
    transition: "border 0.3s",
  },
  doctorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "25px",
    marginBottom: "40px",
  },
  doctorCard: {
    backgroundColor: "white",
    border: "1px solid #e0e0e0",
    borderRadius: "12px",
    padding: "25px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    transition: "transform 0.3s, box-shadow 0.3s",
    cursor: "pointer",
  },
  doctorCardHover: {
    transform: "translateY(-5px)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
  },
  doctorName: {
    fontSize: "1.3rem",
    fontWeight: "700",
    color: "#333",
    marginBottom: "10px",
  },
  info: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: "8px 0",
    fontSize: "14px",
    color: "#555",
  },
  icon: {
    color: "#007bff",
    fontSize: "16px",
  },
  buttonContainer: {
    display: "flex",
    gap: "10px",
    marginTop: "20px",
  },
  callBtn: {
    flex: 1,
    padding: "12px",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "0.3s",
  },
  callBtnHover: {
    backgroundColor: "#218838",
  },
  registerBtn: {
    flex: 1,
    padding: "12px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "0.3s",
  },
  registerBtnHover: {
    backgroundColor: "#0056b3",
  },
  emptyMessage: {
    textAlign: "center",
    padding: "50px 20px",
    color: "#999",
    fontSize: "16px",
  },
  badge: {
    display: "inline-block",
    backgroundColor: "#e3f2fd",
    color: "#007bff",
    padding: "5px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    marginTop: "8px",
  },
};

function UnregisteredDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [hoverCard, setHoverCard] = useState(null);

  useEffect(() => {
    // Fetch unregistered doctors from the text file
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
          });
        setDoctors(doctorList);
        setFilteredDoctors(doctorList);
      })
      .catch((error) => console.error("Error loading doctors:", error));
  }, []);

  const uniqueSpecialties = [...new Set(doctors.map((doc) => doc.specialty))].sort();

  const handleSearch = (term) => {
    setSearchTerm(term);
    filterDoctors(term, specialtyFilter);
  };

  const handleSpecialtyChange = (specialty) => {
    setSpecialtyFilter(specialty);
    filterDoctors(searchTerm, specialty);
  };

  const filterDoctors = (search, specialty) => {
    let filtered = doctors;

    if (search) {
      filtered = filtered.filter(
        (doc) =>
          doc.name.toLowerCase().includes(search.toLowerCase()) ||
          doc.location.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (specialty) {
      filtered = filtered.filter((doc) => doc.specialty === specialty);
    }

    setFilteredDoctors(filtered);
  };

  const handleCallDoctor = (phone, doctorName) => {
    // Create a tel: link to initiate a call
    window.location.href = `tel:${phone.replace(/\s+/g, "")}`;
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>🏥 Find Unregistered Doctors</h2>
      <p style={styles.subheading}>
        Can't find your doctor on our platform? Browse our list of qualified doctors not yet registered and connect with them directly.
      </p>

      {/* Filter Section */}
      <div style={styles.filterContainer}>
        <input
          type="text"
          placeholder="Search by doctor name or location..."
          style={styles.filterInput}
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
        />

        <select
          style={styles.filterInput}
          value={specialtyFilter}
          onChange={(e) => handleSpecialtyChange(e.target.value)}
        >
          <option value="">All Specialties</option>
          {uniqueSpecialties.map((specialty) => (
            <option key={specialty} value={specialty}>
              {specialty}
            </option>
          ))}
        </select>
      </div>

      {/* Doctors Grid */}
      {filteredDoctors.length > 0 ? (
        <div style={styles.doctorGrid}>
          {filteredDoctors.map((doctor) => (
            <div
              key={doctor.id}
              style={{
                ...styles.doctorCard,
                ...(hoverCard === doctor.id ? styles.doctorCardHover : {}),
              }}
              onMouseEnter={() => setHoverCard(doctor.id)}
              onMouseLeave={() => setHoverCard(null)}
            >
              <div style={styles.doctorName}>{doctor.name}</div>

              <div style={styles.badge}>{doctor.specialty}</div>

              <div style={styles.info}>
                <FaStethoscope style={styles.icon} />
                <span>{doctor.specialty}</span>
              </div>

              <div style={styles.info}>
                <FaMapMarkerAlt style={styles.icon} />
                <span>{doctor.location}</span>
              </div>

              <div style={styles.info}>
                <FaPhone style={styles.icon} />
                <span>{doctor.phone}</span>
              </div>

              <div style={styles.info}>
                <FaGraduationCap style={styles.icon} />
                <span>{doctor.experience}</span>
              </div>

              <div style={styles.buttonContainer}>
                <button
                  style={styles.callBtn}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      styles.callBtnHover.backgroundColor)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#28a745")
                  }
                  onClick={() => handleCallDoctor(doctor.phone, doctor.name)}
                >
                  <FaPhone /> Call Now
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.emptyMessage}>
          <p>No doctors found matching your criteria. Try different filters.</p>
        </div>
      )}
    </div>
  );
}

export default UnregisteredDoctors;
