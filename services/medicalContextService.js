'use strict'

const User = require('../models/User')
const {
  analyzePrescriptionData,
  fetchCurrentMedicines,
  fetchPrescriptionData,
} = require('./prescriptionService')
const {
  analyzeMedicalHistory,
  cleanText,
  dateOnly,
  fetchMedicalRecords,
} = require('./historyService')
const {
  checkAllergies,
  checkMedicineInteractions,
} = require('./interactionService')
const { fetchPreviousAIChatHistory } = require('./chatHistoryService')

const MEDICAL_MENTOR_SYSTEM_INSTRUCTION = `You are an AI healthcare mentor providing educational information only. You are not a doctor. Do not provide diagnosis or definitive treatment recommendations. Explain information in simple language and encourage professional consultation where appropriate.

Use the user's provided medical context only to personalize educational guidance. If context is missing, say what is missing and answer generally. Never invent allergies, diagnoses, prescriptions, lab values, or medicine interactions. For emergencies, serious symptoms, severe allergic reactions, chest pain, breathing trouble, fainting, stroke symptoms, or overdose concerns, tell the user to seek urgent or emergency care immediately.`

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null
  const diff = Date.now() - dob.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

async function fetchMedicalProfile(userId) {
  if (!userId) return null

  const user = await User.findById(userId)
    .select('name role dateOfBirth bloodGroup gender allergies chronicConditions phone emergencyContact')
    .lean()

  if (!user) return null

  return {
    id: user._id,
    name: user.name || '',
    role: user.role || '',
    age: calculateAge(user.dateOfBirth),
    gender: user.gender || '',
    bloodGroup: user.bloodGroup || '',
    allergies: user.allergies || [],
    chronicConditions: user.chronicConditions || [],
    hasEmergencyContact: Boolean(user.emergencyContact?.phone),
  }
}

function listOrNone(items, formatter = item => item) {
  if (!items || items.length === 0) return 'None available'
  return items.map(formatter).filter(Boolean).join('\n')
}

function formatMedicines(medicines = []) {
  return listOrNone(medicines, med => {
    const parts = [
      med.name,
      med.dosage,
      med.frequency,
      med.duration ? `for ${med.duration}` : '',
      med.instructions ? `Instructions: ${med.instructions}` : '',
      med.diagnosis ? `Related diagnosis: ${med.diagnosis}` : '',
    ].filter(Boolean)
    return `- ${parts.join('; ')}`
  })
}

function formatPrescriptions(prescriptions = []) {
  return listOrNone(prescriptions.slice(0, 5), rx => {
    const doctor = rx.doctor?.name ? ` by Dr. ${rx.doctor.name}` : ''
    const meds = (rx.medications || []).map(med => med.name).filter(Boolean).join(', ')
    return `- ${dateOnly(rx.createdAt)} ${rx.status || ''}${doctor}: ${rx.diagnosis || 'No diagnosis listed'}${meds ? `; Medicines: ${meds}` : ''}${rx.instructions ? `; Instructions: ${cleanText(rx.instructions, 200)}` : ''}`
  })
}

function formatWarnings(title, warnings = []) {
  if (!warnings.length) return `${title}:\nNone detected from stored data.`
  return `${title}:\n${warnings.map(warning => `- [${warning.severity || 'info'}] ${warning.message}`).join('\n')}`
}

function formatMedicalHistory(history = {}) {
  const sections = []

  sections.push(`Chronic Conditions:\n${listOrNone(history.chronicConditions || [], item => `- ${item}`)}`)

  if (history.latestVitals) {
    sections.push(`Latest Vitals:\n- ${history.latestVitals.date}: ${history.latestVitals.summary || 'No values recorded'}`)
  } else {
    sections.push('Latest Vitals:\nNone available')
  }

  sections.push(`Relevant Records:\n${listOrNone(history.recentRecords || [], record => {
    const parts = [
      record.date,
      record.type,
      record.severity ? `severity ${record.severity}` : '',
      record.diagnosis ? `diagnosis: ${record.diagnosis}` : '',
      record.description ? `description: ${record.description}` : '',
      record.treatment ? `treatment: ${record.treatment}` : '',
    ].filter(Boolean)
    return `- ${parts.join('; ')}`
  })}`)

  sections.push(`Flagged Lab Values:\n${listOrNone(history.flaggedLabs || [], lab =>
    `- ${lab.date}: ${lab.name} ${lab.value || ''} ${lab.unit || ''} (${lab.flag}) from ${lab.recordType}`,
  )}`)

  sections.push(`Recent Reports:\n${listOrNone(history.recentReports || [], report => {
    const summary = report.aiSummary || report.description
    return `- ${report.date}: ${report.tag || report.category || 'Report'}${summary ? ` - ${summary}` : ''}`
  })}`)

  return sections.join('\n\n')
}

function formatPreviousChats(chats = []) {
  return listOrNone(chats, chat => {
    const user = chat.user ? `User: ${chat.user}` : ''
    const assistant = chat.assistant ? `Assistant: ${chat.assistant}` : ''
    return `- ${[user, assistant].filter(Boolean).join(' | ')}`
  })
}

function buildMedicalContextPrompt(context = {}, userMessage = '') {
  const profile = context.profile || {}
  const prescriptionAnalysis = context.prescriptionAnalysis || {}

  return `Medical mentor context for this response:

Safety instruction:
You are an AI healthcare mentor providing educational information only. You are not a doctor. Do not provide diagnosis or definitive treatment recommendations. Explain information in simple language and encourage professional consultation where appropriate.

User Profile:
- Name: ${profile.name || 'Unknown'}
- Role: ${profile.role || 'Unknown'}
- Age: ${profile.age ?? 'Not available'}
- Gender: ${profile.gender || 'Not available'}
- Blood Group: ${profile.bloodGroup || 'Not available'}
- Known Allergies: ${(profile.allergies || []).join(', ') || 'None recorded'}
- Chronic Conditions: ${(profile.chronicConditions || []).join(', ') || 'None recorded'}

Medical History:
${formatMedicalHistory(context.medicalHistory)}

Current Medicines:
${formatMedicines(context.currentMedicines)}

Prescription Data:
- Total prescriptions checked: ${prescriptionAnalysis.totalPrescriptions || 0}
- Active prescriptions: ${prescriptionAnalysis.activePrescriptions || 0}
- Active medicine count: ${prescriptionAnalysis.activeMedicineCount || 0}
- Latest diagnosis: ${prescriptionAnalysis.latestDiagnosis || 'Not available'}
- Latest instructions: ${prescriptionAnalysis.latestInstructions || 'Not available'}
${formatPrescriptions(context.prescriptions)}

Allergy Analysis:
${formatWarnings('Possible allergy warnings', context.allergyAnalysis?.warnings || [])}

Medicine Interaction Analysis:
${formatWarnings('Possible interaction warnings', context.interactionAnalysis?.warnings || [])}

Previous AI Chat History:
${formatPreviousChats(context.previousChats)}

Instructions for answer:
- Answer the user query directly and naturally in one unified response.
- Automatically use the relevant profile, records, prescriptions, medicines, allergies, interactions, and history above.
- If stored data is missing, state that records are not available rather than guessing.
- Explain medicines and safety points in simple language when relevant.
- Include urgent safety warnings when the query or context suggests risk.
- Keep the response educational and encourage professional consultation where appropriate.

User Query:
${userMessage}`
}

function buildContextSummary(context = {}) {
  return {
    profileFound: Boolean(context.profile),
    recordsChecked: context.medicalRecords?.records?.length || 0,
    prescriptionsChecked: context.prescriptions?.length || 0,
    currentMedicinesChecked: context.currentMedicines?.length || 0,
    allergiesChecked: context.profile?.allergies?.length || 0,
    allergyWarnings: context.allergyAnalysis?.warnings?.length || 0,
    interactionWarnings: context.interactionAnalysis?.warnings?.length || 0,
    previousChatsChecked: context.previousChats?.length || 0,
  }
}

async function buildMedicalMentorContext(userId, userMessage, frontendHistory = []) {
  const [profile, prescriptions, currentMedicines, medicalRecords, previousChats] = await Promise.all([
    fetchMedicalProfile(userId),
    fetchPrescriptionData(userId),
    fetchCurrentMedicines(userId),
    fetchMedicalRecords(userId, userMessage),
    fetchPreviousAIChatHistory(userId),
  ])

  const profileWithFallback = profile || {}
  const prescriptionAnalysis = analyzePrescriptionData(prescriptions)
  const medicalHistory = analyzeMedicalHistory(profileWithFallback, medicalRecords)
  const allergyAnalysis = checkAllergies(profileWithFallback.allergies || [], currentMedicines)
  const interactionAnalysis = checkMedicineInteractions(currentMedicines)

  const context = {
    profile,
    prescriptions,
    currentMedicines,
    medicalRecords,
    medicalHistory,
    prescriptionAnalysis,
    allergyAnalysis,
    interactionAnalysis,
    previousChats,
    frontendHistoryCount: Array.isArray(frontendHistory) ? frontendHistory.length : 0,
  }

  return {
    ...context,
    prompt: buildMedicalContextPrompt(context, userMessage),
    summary: buildContextSummary(context),
  }
}

module.exports = {
  MEDICAL_MENTOR_SYSTEM_INSTRUCTION,
  buildMedicalContextPrompt,
  buildMedicalMentorContext,
  fetchMedicalProfile,
}
