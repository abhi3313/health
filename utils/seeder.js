require('dotenv').config()
const mongoose     = require('mongoose')
const User         = require('../models/User')
const HealthRecord = require('../models/HealthRecord')
const Appointment  = require('../models/Appointment')
const Vital        = require('../models/Vital')
const Prescription = require('../models/Prescription')
const AuditLog     = require('../models/AuditLog')
const AccessRequest = require('../models/AccessRequest')

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthguardian'

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('✅  Connected to MongoDB')

    // ── Clean existing data ───────────────────────────────
    await Promise.all([
      User.deleteMany({}),
      HealthRecord.deleteMany({}),
      Appointment.deleteMany({}),
      Vital.deleteMany({}),
      Prescription.deleteMany({}),
      AuditLog.deleteMany({}),
      AccessRequest.deleteMany({}),
    ])
    console.log('🧹  Cleaned existing data')

    // ── Create Admin ──────────────────────────────────────
    const admin = await User.create({
      name:       'System Admin',
      email:      'admin@demo.com',
      password:   'demo123',
      role:       'admin',
      phone:      '+1 555 000 0001',
      isApproved: true,
      status:     'active',
    })

    // ── Create Doctors ────────────────────────────────────
    const doctor1 = await User.create({
      name:           'Dr. Sarah Johnson',
      email:          'doctor@demo.com',
      password:       'demo123',
      role:           'doctor',
      phone:          '+1 555 000 0002',
      specialization: 'Cardiologist',
      licenseNumber:  'MD-2024-001',
      experience:     12,
      hospital:       'HealthGuardian Medical Center',
      isApproved:     true,
      status:         'active',
    })

    const doctor2 = await User.create({
      name:           'Dr. Michael Chen',
      email:          'doctor2@demo.com',
      password:       'demo123',
      role:           'doctor',
      phone:          '+1 555 000 0003',
      specialization: 'General Physician',
      licenseNumber:  'MD-2024-002',
      experience:     8,
      hospital:       'City Health Clinic',
      isApproved:     true,
      status:         'active',
    })

    // ── Create Patients ───────────────────────────────────
    const patient1 = await User.create({
      name:        'John Doe',
      email:       'patient@demo.com',
      password:    'demo123',
      role:        'patient',
      phone:       '+1 555 000 0010',
      dateOfBirth: new Date('1990-05-15'),
      bloodGroup:  'O+',
      gender:      'male',
      address:     '123 Main St, New York, NY',
      allergies:   ['Penicillin', 'Peanuts'],
      chronicConditions: ['Hypertension'],
      isApproved:  true,
      status:      'active',
    })

    const patient2 = await User.create({
      name:        'Jane Smith',
      email:       'patient2@demo.com',
      password:    'demo123',
      role:        'patient',
      phone:       '+1 555 000 0011',
      dateOfBirth: new Date('1985-08-22'),
      bloodGroup:  'A+',
      gender:      'female',
      address:     '456 Oak Ave, Los Angeles, CA',
      allergies:   [],
      chronicConditions: ['Type 2 Diabetes'],
      isApproved:  true,
      status:      'active',
    })

    const patient3 = await User.create({
      name:        'Robert Williams',
      email:       'patient3@demo.com',
      password:    'demo123',
      role:        'patient',
      phone:       '+1 555 000 0012',
      dateOfBirth: new Date('1978-03-30'),
      bloodGroup:  'B+',
      gender:      'male',
      isApproved:  true,
      status:      'active',
    })

    console.log('👥  Users seeded')

    // ── Create Health Records ─────────────────────────────
    await HealthRecord.insertMany([
      {
        patient:     patient1._id,
        doctor:      doctor1._id,
        type:        'Blood Test',
        description: 'Complete Blood Count (CBC) – all values within normal range.',
        notes:       'Follow up in 3 months',
        status:      'active',
        date:        new Date('2024-02-15'),
        labValues: [
          { name: 'Hemoglobin', value: '14.5', unit: 'g/dL', normal: '13.5–17.5', flag: 'normal' },
          { name: 'WBC',        value: '7.2',  unit: 'K/µL', normal: '4.5–11',    flag: 'normal' },
          { name: 'Platelets',  value: '280',  unit: 'K/µL', normal: '150–400',   flag: 'normal' },
        ],
      },
      {
        patient:     patient1._id,
        doctor:      doctor1._id,
        type:        'ECG',
        description: 'Electrocardiogram – normal sinus rhythm, no arrhythmia detected.',
        status:      'active',
        date:        new Date('2024-01-20'),
      },
      {
        patient:     patient1._id,
        type:        'General Checkup',
        description: 'Annual physical examination. BP slightly elevated at 135/88 mmHg.',
        notes:       'Recommend dietary changes and monitoring.',
        status:      'active',
        date:        new Date('2024-03-01'),
      },
      {
        patient:     patient2._id,
        doctor:      doctor2._id,
        type:        'Lab Report',
        description: 'HbA1c 7.2% — slightly above target. Glucose fasting 128 mg/dL.',
        status:      'active',
        date:        new Date('2024-02-28'),
        labValues: [
          { name: 'HbA1c',          value: '7.2', unit: '%',     normal: '< 5.7',  flag: 'high' },
          { name: 'Fasting Glucose', value: '128', unit: 'mg/dL', normal: '70–99',  flag: 'high' },
        ],
      },
      {
        patient:     patient2._id,
        type:        'Prescription',
        description: 'Metformin 500mg twice daily for diabetes management.',
        status:      'active',
        date:        new Date('2024-03-05'),
      },
      {
        patient:     patient3._id,
        type:        'X-Ray',
        description: 'Chest X-Ray – no abnormalities detected. Lungs clear.',
        status:      'active',
        date:        new Date('2024-01-10'),
      },
    ])
    console.log('📋  Health records seeded')

    // ── Create Vitals ─────────────────────────────────────
    const now = Date.now()
    const vitalsData = Array.from({ length: 7 }, (_, i) => ({
      patient:    patient1._id,
      recordedBy: patient1._id,
      heartRate:  { value: 68 + Math.floor(Math.random() * 15) },
      bloodPressure: { systolic: 125 + Math.floor(Math.random() * 15), diastolic: 80 + Math.floor(Math.random() * 10) },
      temperature:   { value: +(97.8 + Math.random() * 1.5).toFixed(1) },
      oxygenSaturation: { value: 96 + Math.floor(Math.random() * 4) },
      glucose:       { value: 90 + Math.floor(Math.random() * 20), type: 'fasting' },
      weight:        { value: 78 },
      height:        { value: 178 },
      recordedAt:    new Date(now - i * 24 * 60 * 60 * 1000),
    }))
    await Vital.insertMany(vitalsData)
    console.log('💓  Vitals seeded')

    // ── Create Appointments ───────────────────────────────
    const tomorrow   = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    const nextWeek   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const yesterday  = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    const lastWeek   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const appointments = await Appointment.insertMany([
      {
        patient: patient1._id,
        doctor:  doctor1._id,
        date:    tomorrow,
        time:    '10:00 AM',
        reason:  'Routine cardiac check-up',
        status:  'confirmed',
        type:    'in-person',
      },
      {
        patient: patient1._id,
        doctor:  doctor2._id,
        date:    nextWeek,
        time:    '2:30 PM',
        reason:  'Blood pressure follow-up',
        status:  'pending',
        type:    'in-person',
      },
      {
        patient: patient1._id,
        doctor:  doctor1._id,
        date:    lastWeek,
        time:    '9:00 AM',
        reason:  'ECG results review',
        status:  'completed',
        type:    'in-person',
        completedAt: lastWeek,
      },
      {
        patient: patient2._id,
        doctor:  doctor2._id,
        date:    tomorrow,
        time:    '11:30 AM',
        reason:  'Diabetes management review',
        status:  'confirmed',
        type:    'in-person',
      },
      {
        patient: patient2._id,
        doctor:  doctor2._id,
        date:    yesterday,
        time:    '3:00 PM',
        reason:  'HbA1c follow-up',
        status:  'completed',
        type:    'in-person',
        completedAt: yesterday,
      },
      {
        patient: patient3._id,
        doctor:  doctor1._id,
        date:    tomorrow,
        time:    '4:00 PM',
        reason:  'General health check',
        status:  'pending',
        type:    'in-person',
      },
    ])
    console.log('📅  Appointments seeded')

    // ── Create Prescriptions ──────────────────────────────
    await Prescription.insertMany([
      {
        patient:   patient1._id,
        doctor:    doctor1._id,
        diagnosis: 'Stage 1 Hypertension',
        medications: [
          { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', duration: '3 months', route: 'oral', instructions: 'Take in the morning' },
          { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', duration: '3 months', route: 'oral', instructions: 'Monitor for dry cough' },
        ],
        instructions: 'Monitor BP daily. Reduce sodium intake. Return in 3 months.',
        followUpDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        status:       'active',
        validUntil:   new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
      {
        patient:   patient2._id,
        doctor:    doctor2._id,
        diagnosis: 'Type 2 Diabetes Mellitus',
        medications: [
          { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily with meals', duration: '6 months', route: 'oral', instructions: 'Take with food to reduce GI effects' },
          { name: 'Glipizide', dosage: '5mg', frequency: 'Once daily before breakfast', duration: '3 months', route: 'oral', instructions: 'Monitor for hypoglycemia' },
        ],
        instructions: 'Check blood sugar twice daily. Follow diabetic diet. Exercise 30 min/day.',
        followUpDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status:       'active',
        validUntil:   new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    ])
    console.log('💊  Prescriptions seeded')


    // ── Create Access Requests ────────────────────────────
    await AccessRequest.insertMany([
      {
        doctor:          doctor1._id,
        patient:         patient1._id,
        patientUniqueId: patient1.patientUniqueId,
        requestMessage:  'I would like to review your cardiac history to provide better care.',
        status:          'approved',
        approvedAt:      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        permissions:     { viewRecords: true, viewReports: true, addNotes: true, createPrescriptions: true },
      },
      {
        doctor:          doctor2._id,
        patient:         patient1._id,
        patientUniqueId: patient1.patientUniqueId,
        requestMessage:  'Requesting access to monitor your blood pressure records.',
        status:          'pending',
        permissions:     { viewRecords: true, viewReports: true, addNotes: true, createPrescriptions: true },
      },
      {
        doctor:          doctor2._id,
        patient:         patient2._id,
        patientUniqueId: patient2.patientUniqueId,
        requestMessage:  'I am your assigned physician for diabetes management.',
        status:          'approved',
        approvedAt:      new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        permissions:     { viewRecords: true, viewReports: true, addNotes: true, createPrescriptions: true },
      },
      {
        doctor:          doctor1._id,
        patient:         patient3._id,
        patientUniqueId: patient3.patientUniqueId,
        requestMessage:  'Requesting access for cardiac evaluation.',
        status:          'rejected',
        rejectedAt:      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        responseMessage: 'I prefer to use my current doctor.',
      },
    ])
    console.log('🔐  Access requests seeded')
    // ── Summary ───────────────────────────────────────────
    console.log('\n✅  Database seeded successfully!\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔐  Demo Credentials:')
    console.log('  Admin  → admin@demo.com    / demo123')
    console.log('  Doctor → doctor@demo.com   / demo123')
    console.log('  Patient→ patient@demo.com  / demo123')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    process.exit(0)
  } catch (error) {
    console.error('❌  Seeding failed:', error.message)
    process.exit(1)
  }
}

seed()
