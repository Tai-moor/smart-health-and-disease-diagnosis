import React, { useState } from "react";
import { db, auth } from "../services/firebase";
import { collection, addDoc, query, where, getDocs, runTransaction, doc } from "firebase/firestore";
import { FaStar, FaTimes } from "react-icons/fa";

const styles = {
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal: { backgroundColor: "white", padding: "30px", borderRadius: "12px", width: "90%", maxWidth: "450px", position: "relative", boxShadow: "0 5px 15px rgba(0,0,0,0.3)" },
  closeBtn: { position: "absolute", top: "15px", right: "20px", border: "none", background: "none", fontSize: "20px", cursor: "pointer", color: "#888" },
  heading: { textAlign: "center", marginBottom: "20px", color: "#333" },
  starContainer: { display: "flex", justifyContent: "center", gap: "10px", marginBottom: "20px" },
  star: (active) => ({ fontSize: "30px", cursor: "pointer", color: active ? "#ffc107" : "#e4e5e9", transition: "color 0.2s" }),
  textarea: { width: "100%", height: "100px", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", resize: "none", marginBottom: "20px" },
  submitBtn: { width: "100%", padding: "12px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "16px" }
};

function ReviewModal({ doctorId, doctorName, onClose }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return alert("Please select a star rating.");
    if (!comment.trim()) return alert("Please write a review.");

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return alert("Please login.");

      // 🟢 1. STRICT CHECK: Has this user already reviewed this doctor?
      const q = query(
        collection(db, "reviews"), 
        where("doctorId", "==", doctorId),
        where("patientId", "==", user.uid)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        alert("⚠️ You have already reviewed this doctor. You can only submit one review per doctor.");
        setLoading(false);
        onClose();
        return; // Stop here
      }

      // 🟢 2. IF NEW REVIEW: Save it & Update Doctor Average
      await runTransaction(db, async (transaction) => {
        const doctorRef = doc(db, "doctors", doctorId);
        const doctorDoc = await transaction.get(doctorRef);
        
        if (!doctorDoc.exists()) throw "Doctor not found";

        const data = doctorDoc.data();
        const currentTotal = data.totalReviews || 0;
        const currentAvg = data.averageRating || 0;

        // Calculate New Math
        const newTotal = currentTotal + 1;
        const newAvg = ((currentAvg * currentTotal) + rating) / newTotal;

        // Add Review
        const newReviewRef = doc(collection(db, "reviews"));
        transaction.set(newReviewRef, {
          doctorId, doctorName,
          patientId: user.uid,
          patientName: user.displayName || "Patient",
          rating, comment,
          createdAt: new Date().toISOString()
        });

        // Update Doctor
        transaction.update(doctorRef, {
          averageRating: parseFloat(newAvg.toFixed(1)),
          totalReviews: newTotal
        });
      });

      alert("✅ Review Submitted Successfully!");
      onClose();

    } catch (error) {
      console.error("Error:", error);
      alert("Failed to submit review.");
    }
    setLoading(false);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <button style={styles.closeBtn} onClick={onClose}><FaTimes /></button>
        <h2 style={styles.heading}>Rate Dr. {doctorName}</h2>

        <div style={styles.starContainer}>
          {[...Array(5)].map((_, index) => {
            const ratingValue = index + 1;
            return (
              <FaStar 
                key={index} 
                style={styles.star(ratingValue <= (hover || rating))}
                onClick={() => setRating(ratingValue)}
                onMouseEnter={() => setHover(ratingValue)}
                onMouseLeave={() => setHover(0)}
              />
            );
          })}
        </div>

        <textarea 
          style={styles.textarea} 
          placeholder="Write your experience..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <button style={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </div>
  );
}

export default ReviewModal;