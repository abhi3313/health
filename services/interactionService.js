'use strict'

const { normalizeMedicineName } = require('./prescriptionService')

const INTERACTION_RULES = [
  {
    a: ['warfarin'],
    b: ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac'],
    severity: 'high',
    note: 'Blood thinner plus NSAID/aspirin may increase bleeding risk. Confirm this combination with a clinician or pharmacist.',
  },
  {
    a: ['lisinopril', 'enalapril', 'losartan', 'valsartan'],
    b: ['potassium', 'spironolactone'],
    severity: 'medium',
    note: 'Some blood pressure medicines combined with potassium-raising medicines can raise potassium levels. Ask your clinician if monitoring is needed.',
  },
  {
    a: ['atorvastatin', 'simvastatin', 'rosuvastatin'],
    b: ['clarithromycin', 'erythromycin'],
    severity: 'medium',
    note: 'Some antibiotics can increase statin side effects. Check with the prescriber or pharmacist.',
  },
  {
    a: ['nitroglycerin', 'isosorbide'],
    b: ['sildenafil', 'tadalafil'],
    severity: 'high',
    note: 'Nitrates and erectile dysfunction medicines can dangerously lower blood pressure. Seek professional guidance before combining.',
  },
  {
    a: ['alprazolam', 'lorazepam', 'diazepam', 'clonazepam'],
    b: ['tramadol', 'morphine', 'oxycodone', 'hydrocodone', 'codeine'],
    severity: 'high',
    note: 'Sedatives and opioid pain medicines can increase drowsiness and breathing risk. Use only under close medical supervision.',
  },
]

function includesAny(value, terms) {
  return terms.some(term => value.includes(term))
}

function medicineLabel(med = {}) {
  return [med.name, med.dosage, med.frequency].filter(Boolean).join(' ')
}

function checkMedicineInteractions(medicines = []) {
  const normalized = medicines
    .map(med => ({ raw: med, name: normalizeMedicineName(med.name) }))
    .filter(med => med.name)

  const warnings = []
  const duplicateNames = new Set()
  const seen = new Set()

  normalized.forEach(med => {
    if (seen.has(med.name)) duplicateNames.add(med.name)
    seen.add(med.name)
  })

  duplicateNames.forEach(name => {
    warnings.push({
      type: 'duplicate_medicine',
      severity: 'medium',
      medicines: [name],
      message: `Possible duplicate medicine entry found for "${name}". Confirm whether these are separate instructions or repeated records.`,
    })
  })

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const first = normalized[i]
      const second = normalized[j]

      INTERACTION_RULES.forEach(rule => {
        const firstMatchesA = includesAny(first.name, rule.a)
        const firstMatchesB = includesAny(first.name, rule.b)
        const secondMatchesA = includesAny(second.name, rule.a)
        const secondMatchesB = includesAny(second.name, rule.b)

        if ((firstMatchesA && secondMatchesB) || (firstMatchesB && secondMatchesA)) {
          warnings.push({
            type: 'possible_interaction',
            severity: rule.severity,
            medicines: [medicineLabel(first.raw), medicineLabel(second.raw)],
            message: rule.note,
          })
        }
      })
    }
  }

  return {
    checked: normalized.length,
    warnings,
  }
}

function checkAllergies(allergies = [], medicines = []) {
  const normalizedAllergies = allergies
    .map(allergy => String(allergy || '').trim().toLowerCase())
    .filter(Boolean)

  const warnings = []

  normalizedAllergies.forEach(allergy => {
    medicines.forEach(med => {
      const medText = normalizeMedicineName(`${med.name || ''} ${med.instructions || ''}`)
      if (allergy.length >= 3 && medText.includes(allergy)) {
        warnings.push({
          type: 'possible_allergy_match',
          severity: 'high',
          allergy,
          medicine: medicineLabel(med),
          message: `Known allergy "${allergy}" appears related to "${medicineLabel(med)}". Do not ignore allergy symptoms and confirm safety with a clinician or pharmacist.`,
        })
      }
    })
  })

  return {
    checkedAllergies: normalizedAllergies.length,
    warnings,
  }
}

module.exports = {
  checkAllergies,
  checkMedicineInteractions,
}
