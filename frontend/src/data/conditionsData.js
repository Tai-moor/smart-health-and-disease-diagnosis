// This file contains the complete mapping of Condition -> Specialty
// Based on the list you provided.

export const conditionsData = [
  // --- Psychologist ---
  { name: "Anxiety Disorder", specialty: "Psychologist" },
  { name: "Concentration Problems", specialty: "Psychologist" },
  { name: "Depression", specialty: "Psychologist" },
  { name: "Early Parenting Issues", specialty: "Psychologist" },
  { name: "Emotional Outbursts", specialty: "Psychologist" },
  { name: "Family Problems", specialty: "Psychologist" },
  { name: "Marital Conflict", specialty: "Psychologist" },
  { name: "Panic Disorder", specialty: "Psychologist" },
  { name: "Phobias", specialty: "Psychologist" },
  { name: "Sleep Disorder", specialty: "Psychologist" },
  { name: "Social Phobia", specialty: "Psychologist" },
  { name: "Stammering", specialty: "Psychologist" },
  { name: "Autism", specialty: "Psychologist" }, 
  { name: "Learning Difficulty", specialty: "Psychologist" },

  // --- Physiotherapist / Pain Management (Grouped under appropriate spec if strictly limited, using General/Ortho defaults) ---
  { name: "Sciatica", specialty: "Physiotherapist" },
  { name: "Frozen Shoulder", specialty: "Physiotherapist" },
  { name: "Chronic Pain Syndrome", specialty: "Physiotherapist" },
  { name: "Sports Injuries", specialty: "Physiotherapist" },
  { name: "Running Injuries", specialty: "Physiotherapist" },
  { name: "Rotator Cuff Injury", specialty: "Physiotherapist" },
  { name: "Heel and Foot Pain", specialty: "Physiotherapist" },
  
  // --- General Physician ---
  { name: "Common Cold", specialty: "General Physician" },
  { name: "Cough & Flu", specialty: "General Physician" },
  { name: "Fever", specialty: "General Physician" },
  { name: "Fatigue", specialty: "General Physician" },
  { name: "Muscle Aches", specialty: "General Physician" },
  { name: "Nausea & Vomiting", specialty: "General Physician" },
  { name: "Diarrhea", specialty: "General Physician" },
  { name: "Constipation", specialty: "General Physician" },
  { name: "Typhoid Fever", specialty: "General Physician" },
  { name: "Dengue", specialty: "General Physician" },
  { name: "Bone Trauma", specialty: "General Physician" },
  { name: "Headache", specialty: "General Physician" },
  { name: "Bloating & Gas", specialty: "General Physician" },
  { name: "Blood Pressure Issues", specialty: "General Physician" },
  { name: "Urinary Tract Infections", specialty: "General Physician" },

  // --- Psychiatrist ---
  { name: "ADHD", specialty: "Psychiatrist" },
  { name: "Bipolar Disorder", specialty: "Psychiatrist" },
  { name: "Obsessive Compulsive Disorder (OCD)", specialty: "Psychiatrist" },
  { name: "Post Traumatic Stress Disorder (PTSD)", specialty: "Psychiatrist" },
  { name: "Schizophrenia", specialty: "Psychiatrist" },
  { name: "Insomnia", specialty: "Psychiatrist" },
  { name: "Eating Disorders", specialty: "Psychiatrist" },
  
  // --- Internal Medicine Specialist ---
  { name: "Hypertension", specialty: "Internal Medicine Specialist" },
  { name: "Infectious Diseases", specialty: "Internal Medicine Specialist" },
  { name: "Diabetes Management", specialty: "Internal Medicine Specialist" },
  { name: "Thyroid Disease", specialty: "Internal Medicine Specialist" },
  { name: "Chest Infection", specialty: "Internal Medicine Specialist" },
  { name: "Liver Diseases", specialty: "Internal Medicine Specialist" },
  { name: "Hepatitis A/B/C", specialty: "Internal Medicine Specialist" },
  { name: "Kidney Stones", specialty: "Internal Medicine Specialist" },
  { name: "Arthritis", specialty: "Internal Medicine Specialist" },
  { name: "Gout", specialty: "Internal Medicine Specialist" },
  { name: "Obesity", specialty: "Internal Medicine Specialist" },
  { name: "Lung Infection", specialty: "Internal Medicine Specialist" },

  // --- Dentist ---
  { name: "Toothache", specialty: "Dentist" },
  { name: "Cavities", specialty: "Dentist" },
  { name: "Gum Disease", specialty: "Dentist" },
  { name: "Root Canal", specialty: "Dentist" },
  { name: "Bad Breath", specialty: "Dentist" },
  { name: "Teeth Whitening", specialty: "Dentist" },
  { name: "Dental Implants", specialty: "Dentist" },
  { name: "Jaw Pain (TMJ)", specialty: "Dentist" },

  // --- Cardiologist ---
  { name: "Heart Attack (Recovery)", specialty: "Cardiologist" },
  { name: "Angina (Chest Pain)", specialty: "Cardiologist" },
  { name: "Heart Failure", specialty: "Cardiologist" },
  { name: "Arrhythmia (Irregular Heartbeat)", specialty: "Cardiologist" },
  { name: "High Cholesterol", specialty: "Cardiologist" },
  { name: "Hypertension (High BP)", specialty: "Cardiologist" },
  
  // --- Neurologist ---
  { name: "Epilepsy / Seizures", specialty: "Neurologist" },
  { name: "Migraine", specialty: "Neurologist" },
  { name: "Stroke", specialty: "Neurologist" },
  { name: "Parkinson's Disease", specialty: "Neurologist" },
  { name: "Dizziness & Vertigo", specialty: "Neurologist" },
  { name: "Multiple Sclerosis", specialty: "Neurologist" },
  { name: "Memory Loss / Dementia", specialty: "Neurologist" },
  { name: "Nerve Pain", specialty: "Neurologist" },

  // --- Rheumatologist ---
  { name: "Rheumatoid Arthritis", specialty: "Rheumatologist" },
  { name: "Lupus", specialty: "Rheumatologist" },
  { name: "Osteoarthritis", specialty: "Rheumatologist" },
  { name: "Back Pain (Chronic)", specialty: "Rheumatologist" },
  { name: "Fibromyalgia", specialty: "Rheumatologist" },
  
  // --- Eye Specialist / Surgeon ---
  { name: "Cataract", specialty: "Eye Specialist" },
  { name: "Glaucoma", specialty: "Eye Specialist" },
  { name: "Conjunctivitis (Pink Eye)", specialty: "Eye Specialist" },
  { name: "Blurry Vision", specialty: "Eye Specialist" },
  { name: "Diabetic Retinopathy", specialty: "Eye Specialist" },
  { name: "Dry Eyes", specialty: "Eye Specialist" },
  { name: "Eye Allergy", specialty: "Eye Specialist" },

  // --- Homeopath ---
  { name: "Skin Cyst", specialty: "Homeopath" },
  { name: "Hair Fall (Homeopathy)", specialty: "Homeopath" },
  
  // --- Family Physician ---
  { name: "General Checkup", specialty: "Family Physician" },
  { name: "Vaccinations", specialty: "Family Physician" },
  { name: "Seasonal Allergies", specialty: "Family Physician" },
  { name: "Child Growth Issues", specialty: "Family Physician" }
];
