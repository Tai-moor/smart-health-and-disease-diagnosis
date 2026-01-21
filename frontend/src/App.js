// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Signup from "./pages/auth/Signup";
import Login from "./pages/auth/Login";
import FindDoctors from "./pages/patient/FindDoctors";

import { auth, db } from "./services/firebase";
import Navbar from './components/Navbar';

import Landing from "./pages/common/Landing";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import { AuthProvider, useAuth } from "./context/AuthContext";
import DoctorSearch from "./pages/patient/DoctorSearch";
import DoctorList from "./pages/patient/DoctorList";
import DoctorProfile from "./pages/patient/DoctorProfile";
import MyAppointments from "./pages/patient/MyAppointments";
import Diagnosis from "./pages/patient/Diagnosis";
import AdminDashboard from "./pages/admin/AdminDashboard";
import HealthRecords from "./pages/patient/HealthRecords";
import UnregisteredDoctors from "./pages/patient/UnregisteredDoctors";
import AllConditions from "./pages/patient/AllConditions";
// Protected route
function ProtectedRoute({ children, role }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/" />;

  // Check role properly
  if (role && user.role !== role) {
    return <Navigate to={user.role === "doctor" ? "/doctor-dashboard" : "/home"} />;
  }

  return children;
}


function App() {
  return (
    
    <AuthProvider>
     
      <Router>
        <Navbar/>
        <Routes>
           
         <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin" element={<AdminDashboard />} />
          <Route
            path="/doctor-search"
            element={
              <ProtectedRoute role="patient">
                <DoctorSearch />
              </ProtectedRoute>
            }
          />
  


  /* this rout is for storing images */
<Route path="/health-records" element={
  <ProtectedRoute role="patient">
    <HealthRecords />
  </ProtectedRoute>
} />


          <Route
  path="/find-doctors"
  element={
    <ProtectedRoute role="patient">
      <DoctorList />
    </ProtectedRoute>
  }
/>

<Route path="/diagnosis" element={
  <ProtectedRoute role="patient">
    <Diagnosis />
  </ProtectedRoute>
} />

<Route path="/unregistered-doctors" element={
  <ProtectedRoute role="patient">
    <UnregisteredDoctors />
  </ProtectedRoute>
} />

{/* <Route
  path="/doctor-search"
  element={
    <ProtectedRoute role="patient">
      <DoctorSearch />
    </ProtectedRoute>
  }
/> */}

<Route path="/doctor/:id" element={<DoctorProfile />} />
<Route path="/my-appointments" element={<MyAppointments />} />
<Route path="/all-conditions" element={<AllConditions />} />

          <Route
            path="/doctor-dashboard"
            element={
              <ProtectedRoute role="doctor">
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App; // ✅ Make sure default export exists
