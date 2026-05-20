'use strict'

const AuditLog = require('../models/AuditLog')
const HealthRecord = require('../models/HealthRecord')
const Prescription = require('../models/Prescription')
const User = require('../models/User')

const PATIENT_ID_RE = /^HG-P-[A-Z0-9]{4}-[A-Z0-9]{4}$/

function validatePatientId(patientId) {
  const normalized = String(patientId || '').trim().toUpperCase()
  return {
    isValid: PATIENT_ID_RE.test(normalized),
    patientId: normalized,
  }
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null

  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1
  return age >= 0 ? age : null
}

function uniqueCleanList(values = [], limit = 12) {
  const seen = new Set()

  return values
    .flat()
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter(value => {
      const key = value.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

function formatMedicine(medication = {}) {
  return [
    medication.name,
    medication.dosage,
    medication.frequency,
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' - ')
}

function buildBadges({ allergies, chronicConditions, importantMedicalConditions }) {
  const text = [...allergies, ...chronicConditions, ...importantMedicalConditions]
    .join(' ')
    .toLowerCase()
  const badges = []

  if (allergies.length) badges.push(allergies.length > 1 ? 'Severe Allergy Risk' : 'Allergy')
  if (/heart|cardiac|angina|coronary|arrhythmia|failure/.test(text)) badges.push('Heart Condition')
  if (/diabet|insulin|blood sugar|glucose/.test(text)) badges.push('Diabetic')
  if (/asthma|copd|respiratory/.test(text)) badges.push('Asthma')
  if (/critical|high risk|stroke|seizure|epilepsy|kidney|renal/.test(text)) badges.push('High Risk')

  return uniqueCleanList(badges, 6)
}

async function logEmergencyAccess({
  patientId,
  success,
  reason = '',
  patientObjectId = null,
  ip,
  userAgent,
}) {
  try {
    return await AuditLog.create({
      user: patientObjectId,
      action: 'EMERGENCY_ACCESS',
      resource: 'EmergencyProfile',
      resourceId: patientObjectId,
      details: {
        patientId,
        success,
        reason,
      },
      ip,
      userAgent,
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Could not log emergency access:', error.message)
    }
    return null
  }
}

async function getEmergencyProfile(patientId) {
  const validation = validatePatientId(patientId)
  if (!validation.isValid) {
    return { profile: null, error: 'INVALID_PATIENT_ID', patientId: validation.patientId }
  }

  const patient = await User.findOne({
    patientUniqueId: validation.patientId,
    role: 'patient',
    status: 'active',
  })
    .select('name patientUniqueId dateOfBirth bloodGroup emergencyContact allergies chronicConditions importantMedicalConditions emergencyNotes updatedAt')
    .lean()

  if (!patient) {
    return { profile: null, error: 'NOT_FOUND', patientId: validation.patientId }
  }

  const [activePrescriptions, criticalRecords] = await Promise.all([
    Prescription.find({ patient: patient._id, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('medications updatedAt createdAt')
      .lean(),
    HealthRecord.find({
      patient: patient._id,
      status: { $ne: 'archived' },
      $or: [
        { severity: { $in: ['high', 'critical'] } },
        { tags: { $in: ['emergency', 'critical', 'high-risk', 'high risk'] } },
      ],
    })
      .sort({ date: -1, createdAt: -1 })
      .limit(5)
      .select('diagnosis tags severity updatedAt createdAt')
      .lean(),
  ])

  const currentMedicines = uniqueCleanList(
    activePrescriptions.flatMap(prescription => (
      prescription.medications || []
    ).map(formatMedicine)),
    12,
  )

  const criticalRecordConditions = criticalRecords.flatMap(record => [
    record.diagnosis,
    ...(record.tags || []),
  ])

  const allergies = uniqueCleanList(patient.allergies || [])
  const chronicConditions = uniqueCleanList(patient.chronicConditions || [])
  const importantMedicalConditions = uniqueCleanList([
    ...(patient.importantMedicalConditions || []),
    ...criticalRecordConditions,
  ])

  const lastUpdatedCandidates = [
    patient.updatedAt,
    ...activePrescriptions.map(item => item.updatedAt || item.createdAt),
    ...criticalRecords.map(item => item.updatedAt || item.createdAt),
  ].filter(Boolean)

  const lastUpdated = lastUpdatedCandidates.length
    ? new Date(Math.max(...lastUpdatedCandidates.map(date => new Date(date).getTime()))).toISOString()
    : new Date().toISOString()

  const profile = {
    patientId: patient.patientUniqueId,
    fullName: patient.name || 'Unknown patient',
    age: calculateAge(patient.dateOfBirth),
    bloodGroup: patient.bloodGroup || '',
    emergencyContactName: patient.emergencyContact?.name || '',
    emergencyContactNumber: patient.emergencyContact?.phone || '',
    allergies,
    chronicConditions,
    currentMedicines,
    importantMedicalConditions,
    emergencyNotes: patient.emergencyNotes || '',
    badges: buildBadges({ allergies, chronicConditions, importantMedicalConditions }),
    lastUpdated,
  }

  return { profile, error: null, patientId: validation.patientId, patientObjectId: patient._id }
}

module.exports = {
  getEmergencyProfile,
  logEmergencyAccess,
  validatePatientId,
}
