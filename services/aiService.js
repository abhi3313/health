'use strict'

// Default: Gemini 2.5 Flash (Google AI). Override via GEMINI_MODEL if your project uses another ID.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// ─── Knowledge Base ─────────────────────────────────────────────────────────
// Each entry: { patterns: [regex], response: string | fn }

const KB = [
  // ── Greetings ────────────────────────────────────────────
  {
    patterns: [/\b(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy)\b/i],
    responses: [
      "Hello! 👋 I'm your HealthGuardian AI. I can help with health questions, explain medical terms, and guide you through your records. What would you like to know?",
      "Hi there! 😊 I'm here to help with your health-related questions. Ask me anything about symptoms, medications, or general wellness!",
    ],
  },

  // ── Blood Pressure ───────────────────────────────────────
  {
    patterns: [/blood\s*pressure|hypertension|bp\b|systolic|diastolic/i],
    responses: [
      `**Blood Pressure Guide** 🩺

Normal blood pressure is below **120/80 mmHg**.

| Category | Range |
|---|---|
| Normal | < 120/80 |
| Elevated | 120–129 / < 80 |
| High Stage 1 | 130–139 / 80–89 |
| High Stage 2 | ≥ 140 / ≥ 90 |
| Crisis | > 180 / > 120 |

**Tips to manage BP:**
- Reduce sodium intake
- Exercise regularly (30 min/day)
- Limit alcohol consumption
- Manage stress through meditation
- Take prescribed medications consistently

⚠️ If reading is above 180/120, seek emergency care immediately.`,
    ],
  },

  // ── Heart Rate ───────────────────────────────────────────
  {
    patterns: [/heart\s*rate|pulse|bpm|tachycardia|bradycardia/i],
    responses: [
      `**Heart Rate Information** ❤️

Normal resting heart rate for adults: **60–100 bpm**

- **< 60 bpm** → Bradycardia (slow heart rate)
- **60–100 bpm** → Normal range
- **100–150 bpm** → Tachycardia (fast heart rate)
- **> 150 bpm** → Seek medical attention

**Factors that affect heart rate:**
- Physical activity & fitness level
- Stress and anxiety
- Caffeine & medications
- Body temperature & dehydration

Athletes may have resting rates of 40–60 bpm, which is normal.`,
    ],
  },

  // ── Diabetes / Blood Sugar ───────────────────────────────
  {
    patterns: [/diabet|blood\s*sugar|glucose|insulin|hba1c/i],
    responses: [
      `**Diabetes & Blood Sugar** 🩸

**Normal glucose levels:**
- Fasting: **70–99 mg/dL**
- Post-meal (2 hr): **< 140 mg/dL**
- HbA1c: **< 5.7%**

**Categories:**
| Status | Fasting | HbA1c |
|---|---|---|
| Normal | < 100 | < 5.7% |
| Pre-diabetes | 100–125 | 5.7–6.4% |
| Diabetes | ≥ 126 | ≥ 6.5% |

**Management tips:**
✅ Monitor blood sugar regularly
✅ Follow a low-glycemic diet
✅ Exercise daily
✅ Take medications as prescribed
✅ Attend regular check-ups`,
    ],
  },

  // ── Cholesterol ──────────────────────────────────────────
  {
    patterns: [/cholesterol|ldl|hdl|triglyceride|lipid/i],
    responses: [
      `**Cholesterol Guide** 🫀

| Type | Desirable | Borderline | High Risk |
|---|---|---|---|
| Total | < 200 | 200–239 | ≥ 240 |
| LDL ("bad") | < 100 | 100–159 | ≥ 160 |
| HDL ("good") | ≥ 60 | 40–59 | < 40 |
| Triglycerides | < 150 | 150–199 | ≥ 200 |

**How to improve cholesterol:**
- Eat more fiber (oats, beans, vegetables)
- Reduce saturated and trans fats
- Exercise regularly
- Quit smoking
- Limit alcohol`,
    ],
  },

  // ── Fever / Temperature ──────────────────────────────────
  {
    patterns: [/fever|temperature|°f|°c|hypothermia|pyrexia/i],
    responses: [
      `**Fever & Temperature Guide** 🌡️

Normal body temperature: **97–99°F (36.1–37.2°C)**

| Range (°F) | Status | Action |
|---|---|---|
| 97–99 | Normal | No action needed |
| 99–100.4 | Low-grade fever | Monitor, rest, hydrate |
| 100.4–103 | Fever | Rest, fluids, OTC meds |
| > 103 | High fever | See a doctor |
| > 104 | Dangerous | Emergency care |

**Home care for fever:**
- Stay hydrated (water, electrolytes)
- Rest adequately
- Use lukewarm compresses
- Take acetaminophen or ibuprofen as directed

⚠️ Seek immediate care if fever lasts > 3 days or is accompanied by severe headache, rash, or difficulty breathing.`,
    ],
  },

  // ── Oxygen Saturation ────────────────────────────────────
  {
    patterns: [/oxygen|spo2|o2|saturation|pulse\s*ox/i],
    responses: [
      `**Oxygen Saturation (SpO2)** 💨

| Level | Status | Action |
|---|---|---|
| 95–100% | Normal | All good ✅ |
| 90–94% | Low | See a doctor soon |
| < 90% | Critical | Emergency care 🚨 |

**Tips to improve oxygen levels:**
- Practice deep breathing exercises
- Stay active and exercise regularly
- Avoid smoking
- Sleep in well-ventilated rooms
- Treat underlying respiratory conditions

If readings are consistently below 95%, consult your physician.`,
    ],
  },

  // ── BMI / Weight ─────────────────────────────────────────
  {
    patterns: [/\bbmi\b|body\s*mass|weight|overweight|obese|obesity/i],
    responses: [
      `**BMI (Body Mass Index) Guide** ⚖️

BMI = weight(kg) / height(m)²

| BMI Range | Category |
|---|---|
| < 18.5 | Underweight |
| 18.5–24.9 | Normal weight ✅ |
| 25–29.9 | Overweight |
| 30–34.9 | Obese (Class I) |
| 35–39.9 | Obese (Class II) |
| ≥ 40 | Severely Obese |

**Healthy weight tips:**
- Balanced diet (fruits, vegetables, proteins)
- Regular physical activity (150 min/week moderate)
- Adequate sleep (7–9 hours)
- Stress management
- Avoid crash diets

Note: BMI is a screening tool, not a diagnostic measure.`,
    ],
  },

  // ── Sleep ────────────────────────────────────────────────
  {
    patterns: [/sleep|insomnia|rest|fatigue|tired|drowsy/i],
    responses: [
      `**Sleep Health Guide** 😴

**Recommended sleep by age:**
- Adults (18–64): **7–9 hours**
- Older adults (65+): **7–8 hours**
- Teenagers: **8–10 hours**

**Tips for better sleep:**
✅ Keep a consistent sleep schedule
✅ Avoid screens 1 hour before bed
✅ Keep room cool (65–68°F / 18–20°C)
✅ Limit caffeine after 2 PM
✅ Try relaxation techniques (meditation, deep breathing)
✅ Avoid heavy meals before bedtime

**Signs of sleep disorders:**
- Difficulty falling/staying asleep
- Loud snoring or gasping
- Excessive daytime sleepiness

If problems persist for > 3 weeks, consult a sleep specialist.`,
    ],
  },

  // ── Stress / Mental Health ───────────────────────────────
  {
    patterns: [/stress|anxiety|depress|mental\s*health|panic|mood|wellbeing/i],
    responses: [
      `**Mental Health & Stress Management** 🧠

Mental health is as important as physical health. Here are evidence-based strategies:

**Stress reduction techniques:**
🧘 **Mindfulness & Meditation** – 10–15 min daily
🚶 **Physical Exercise** – Releases endorphins
📓 **Journaling** – Process thoughts and feelings
🤝 **Social Support** – Talk to friends or family
😴 **Quality Sleep** – Critical for mood regulation
🎨 **Creative Outlets** – Art, music, hobbies

**When to seek professional help:**
- Persistent sadness for > 2 weeks
- Difficulty functioning at work/home
- Thoughts of self-harm

📞 If in crisis, please contact a mental health professional or emergency services immediately.`,
    ],
  },

  // ── Diet & Nutrition ─────────────────────────────────────
  {
    patterns: [/diet|nutri|eat|food|vitamin|mineral|protein|calori/i],
    responses: [
      `**Nutrition & Healthy Eating** 🥗

**Daily recommended intake (adults):**
- Calories: 1,600–2,400 (women) / 2,000–3,000 (men)
- Protein: 0.8g per kg body weight
- Fiber: 25–38g
- Water: 8–10 glasses (2–2.5L)

**Food groups to prioritize:**
✅ Fruits & vegetables (5 servings/day)
✅ Whole grains (brown rice, oats)
✅ Lean proteins (chicken, fish, legumes)
✅ Healthy fats (avocado, olive oil, nuts)
✅ Low-fat dairy or alternatives

**Foods to limit:**
❌ Processed/ultra-processed foods
❌ Sugary beverages
❌ Trans fats and saturated fats
❌ Excessive sodium (< 2,300 mg/day)`,
    ],
  },

  // ── Exercise ─────────────────────────────────────────────
  {
    patterns: [/exercise|workout|fitness|physical\s*activity|gym|run|walk/i],
    responses: [
      `**Exercise & Physical Activity Guide** 🏃

**WHO recommended activity (adults):**
- **Moderate intensity**: 150–300 min/week
  (brisk walking, cycling, swimming)
- **Vigorous intensity**: 75–150 min/week
  (running, aerobics, sports)
- **Muscle strengthening**: ≥ 2 days/week

**Benefits of regular exercise:**
❤️ Reduces heart disease risk by 35%
🧠 Improves mental health and cognition
⚖️ Helps maintain healthy weight
💪 Strengthens bones and muscles
😴 Improves sleep quality
🩸 Regulates blood sugar

**Getting started tips:**
- Start slow and gradually increase intensity
- Find activities you enjoy
- Exercise with a friend for accountability`,
    ],
  },

  // ── Medications ──────────────────────────────────────────
  {
    patterns: [/medicat|drug|pill|dose|prescription|tablet|capsule|side\s*effect/i],
    responses: [
      `**Medication Safety Guide** 💊

**General medication guidelines:**
✅ Always take as prescribed by your doctor
✅ Complete the full course (especially antibiotics)
✅ Take at consistent times daily
✅ Store medications properly (cool, dry place)
✅ Check expiry dates regularly

**Common side effects to watch:**
- Nausea, vomiting, diarrhea
- Dizziness or drowsiness
- Allergic reactions (rash, swelling)
- Changes in appetite

**Important warnings:**
⚠️ Never stop medications abruptly without consulting your doctor
⚠️ Inform all doctors about all medications you take
⚠️ Avoid grapefruit with some medications (statins, some BP meds)
⚠️ Check for drug interactions

📋 Keep an updated medication list in your health records.`,
    ],
  },

  // ── Vaccination ──────────────────────────────────────────
  {
    patterns: [/vaccin|immuniz|shot|booster|flu\s*shot/i],
    responses: [
      `**Vaccination Guide** 💉

**Key adult vaccinations:**
| Vaccine | Frequency |
|---|---|
| Influenza (Flu) | Annually |
| COVID-19 | As recommended |
| Tetanus/Tdap | Every 10 years |
| Pneumococcal | 65+ or high risk |
| Hepatitis B | 3-dose series if not vaccinated |
| HPV | Up to age 26 (45 in some cases) |
| Shingles (Zoster) | 50+ years old |

**Benefits of vaccination:**
- Protects you and your community
- Reduces severity of illness
- Prevents complications and hospitalizations

Check with your doctor about which vaccines are recommended for your age and health status.`,
    ],
  },

  // ── Lab Results ──────────────────────────────────────────
  {
    patterns: [/lab\s*result|blood\s*test|report|test\s*result|panel|cbc|creatinine|hemoglobin/i],
    responses: [
      `**Understanding Lab Results** 🔬

**Common blood test normal ranges:**

| Test | Normal Range |
|---|---|
| Hemoglobin | 12–17.5 g/dL |
| WBC | 4,500–11,000 cells/µL |
| Platelets | 150,000–400,000/µL |
| Creatinine | 0.7–1.2 mg/dL |
| eGFR | > 60 mL/min |
| ALT (liver) | 7–56 U/L |
| AST (liver) | 10–40 U/L |
| Sodium | 136–145 mEq/L |
| Potassium | 3.5–5.0 mEq/L |

⚠️ Reference ranges can vary by lab and individual factors.
Always discuss results with your doctor for proper interpretation.`,
    ],
  },

  // ── Smoking / Alcohol ────────────────────────────────────
  {
    patterns: [/smok|tobacco|cigarette|alcohol|drink|quit/i],
    responses: [
      `**Smoking & Alcohol Health Impact** 🚭

**Smoking effects:**
- Causes 87% of lung cancer deaths
- Increases heart disease risk by 2–4x
- Damages airways and reduces lung capacity

**Quitting smoking benefits (timeline):**
- 20 min: Heart rate normalizes
- 48 hr: Carbon monoxide clears
- 3 months: Lung function improves
- 1 year: Heart disease risk halved

**Alcohol guidelines:**
- Men: ≤ 2 standard drinks/day
- Women: ≤ 1 standard drink/day
- No safe level during pregnancy

**Resources to quit:**
- Nicotine replacement therapy
- Prescription medications (varenicline)
- Behavioral counseling
- Support groups

Your doctor can create a personalized quit plan for you.`,
    ],
  },

  // ── Pregnancy ────────────────────────────────────────────
  {
    patterns: [/pregnant|pregnancy|prenatal|trimester|fetal|fetus|maternity/i],
    responses: [
      `**Pregnancy Health Guide** 🤰

**Key prenatal care:**
- First trimester visit: 8–10 weeks
- Regular check-ups every 4 weeks until week 28
- Every 2 weeks: weeks 28–36
- Weekly: week 36 until delivery

**Essential nutrients during pregnancy:**
- Folic acid: 400–800 mcg/day (prevents neural tube defects)
- Iron: 27 mg/day
- Calcium: 1,000 mg/day
- DHA Omega-3: 200–300 mg/day
- Vitamin D: 600 IU/day

**Warning signs to report immediately:**
🚨 Heavy bleeding
🚨 Severe abdominal pain
🚨 No fetal movement after 28 weeks
🚨 Severe headache or vision changes
🚨 Signs of preeclampsia

Consult your OB/GYN for personalized guidance.`,
    ],
  },

  // ── Emergency ────────────────────────────────────────────
  {
    patterns: [/emergency|911|ambulance|heart\s*attack|stroke|unconscious|chest\s*pain/i],
    responses: [
      `🚨 **MEDICAL EMERGENCY – Call Emergency Services Immediately** 🚨

**Signs of a heart attack:**
- Chest pain, pressure, or tightness
- Pain radiating to arm, jaw, or back
- Shortness of breath
- Sweating, nausea, lightheadedness

**Signs of a stroke (FAST):**
- **F**ace drooping on one side
- **A**rm weakness
- **S**peech difficulty
- **T**ime to call 911

**What to do while waiting for help:**
1. Call emergency services (911 / 999 / 112)
2. Keep the person calm and still
3. Loosen tight clothing
4. If trained, perform CPR if person is unresponsive
5. Do NOT give food, water, or medications

**Stay on the line with emergency services.**`,
    ],
  },

  // ── Allergies ────────────────────────────────────────────
  {
    patterns: [/allerg|anaphylaxis|hives|rash|itch|reaction/i],
    responses: [
      `**Allergy Information** 🌿

**Common allergens:**
- Food: Peanuts, tree nuts, shellfish, milk, eggs, wheat, soy
- Environmental: Pollen, dust mites, pet dander, mold
- Medications: Penicillin, NSAIDs, sulfa drugs
- Insect stings: Bees, wasps, hornets

**Allergy symptoms:**
- Skin: Hives, rash, eczema, swelling
- Respiratory: Sneezing, runny nose, asthma
- Eyes: Itchy, watery, red eyes
- GI: Nausea, vomiting, diarrhea

**Anaphylaxis (severe) – Emergency signs:**
🚨 Throat swelling / difficulty breathing
🚨 Sudden drop in blood pressure
🚨 Loss of consciousness

**For known severe allergies:** Always carry an epinephrine auto-injector (EpiPen).`,
    ],
  },

  // ── Headache / Migraine ──────────────────────────────────
  {
    patterns: [/headache|migraine|head\s*pain|cluster\s*headache/i],
    responses: [
      `**Headache & Migraine Guide** 🤕

**Types of headaches:**
- **Tension headache**: Pressure on both sides of head
- **Migraine**: Severe, throbbing, often one-sided + nausea
- **Cluster**: Severe around one eye, recurring in cycles
- **Sinus**: Pressure in forehead and cheeks

**Common triggers for migraines:**
- Stress and anxiety
- Hormonal changes
- Certain foods (cheese, chocolate, red wine)
- Dehydration
- Poor sleep
- Bright lights or loud noises

**Relief strategies:**
✅ Rest in dark, quiet room
✅ Cold or warm compress
✅ Stay hydrated
✅ OTC pain relievers (as directed)
✅ Caffeine (small amounts)

⚠️ See a doctor if headache is sudden, severe, or accompanied by fever, vision changes, or stiff neck.`,
    ],
  },

  // ── COVID / Respiratory ─────────────────────────────────
  {
    patterns: [/covid|coronavirus|respiratory|cough|cold|flu|influenza|pneumonia/i],
    responses: [
      `**Respiratory Health Guide** 🫁

**COVID-19 symptoms:**
Fever, cough, fatigue, loss of taste/smell, shortness of breath, body aches

**Flu symptoms:**
Sudden onset fever, chills, muscle aches, headache, cough, fatigue

**Common cold:**
Gradual onset, runny nose, sore throat, mild cough, usually no fever

**General care for respiratory illness:**
✅ Rest and stay home
✅ Hydrate adequately
✅ Use a humidifier
✅ Take OTC symptom relievers
✅ Monitor oxygen levels

**Seek medical care if:**
🚨 Difficulty breathing or shortness of breath
🚨 Persistent chest pain
🚨 Oxygen saturation < 94%
🚨 Symptoms worsen after 5–7 days
🚨 High fever (> 103°F) not responding to medication`,
    ],
  },

  // ── Default / Fallback ───────────────────────────────────
]

const FOLLOW_UP = [
  "Is there anything specific about this topic you'd like me to explain further?",
  "Would you like information about any related health topics?",
  "Do you have any other health questions I can help with?",
  "Would you like tips on tracking this in your HealthGuardian records?",
]

KB.push(
  {
    patterns: [/stomach|abdominal|nausea|vomit|diarrhea|constipation|acidity|indigestion|gastric|gas\b/i],
    responses: [
      `**Digestive Symptoms Guide**

Common symptoms like stomach pain, nausea, acidity, vomiting, diarrhea, or constipation can happen for many reasons, including food irritation, infection, dehydration, stress, or medicine side effects.

**General care tips:**
- Drink enough fluids, especially if vomiting or diarrhea is present
- Eat light foods for a short time, such as rice, toast, bananas, or soup
- Avoid alcohol, very spicy foods, and heavy or oily meals
- Rest and monitor symptoms

**Seek medical care urgently if you have:**
- Severe or worsening abdominal pain
- Blood in vomit or stool
- Signs of dehydration
- High fever
- Persistent vomiting
- Symptoms lasting more than 1-2 days or repeatedly returning

This is general information only. A clinician can help identify the cause if symptoms are significant or persistent.`,
    ],
  },
  {
    patterns: [/paracetamol|acetaminophen|ibuprofen|painkiller|pain\s*relief|body\s*pain|muscle\s*pain|joint\s*pain/i],
    responses: [
      `**Pain Relief & Medicine Safety**

Pain relievers can help with fever, headache, body pain, or muscle pain, but they should be used carefully.

**General safety points:**
- Follow the dose on the label or your doctor's instructions
- Avoid taking multiple medicines with the same ingredient
- Avoid ibuprofen/NSAIDs if you have a stomach ulcer, kidney disease, blood thinner use, or certain heart conditions unless a clinician says it is safe
- Avoid excess acetaminophen/paracetamol, especially with liver disease or alcohol use

**Get medical advice urgently if pain is severe, sudden, linked with chest pain, breathing trouble, weakness, confusion, injury, high fever, or does not improve.**

For personal dosing or whether it is safe with your medicines, ask a doctor or pharmacist.`,
    ],
  },
  {
    patterns: [/typhoid|enteric\s*fever|salmonella\s*typhi/i],
    responses: [
      `**Typhoid Fever - General Information**

Typhoid fever is a bacterial infection that usually spreads through contaminated food or water. It can cause ongoing fever, weakness, stomach pain, headache, loss of appetite, diarrhea or constipation, and sometimes a rash.

**What to do:**
- Drink safe water and keep fluids up
- Eat light, hygienic food if you can tolerate it
- Avoid self-starting antibiotics
- See a doctor for testing and treatment if typhoid is suspected

**Get urgent medical care if there is very high fever, severe weakness, confusion, persistent vomiting, blood in stool, severe abdominal pain, dehydration, or symptoms in a child, older adult, pregnant person, or someone with low immunity.**

This is educational information only. A clinician can confirm typhoid with appropriate tests and decide treatment.`,
    ],
  },
)

// ─── Matcher ────────────────────────────────────────────────
function matchResponse(message) {
  const normalized = message.toLowerCase().trim()

  for (const entry of KB) {
    for (const pattern of entry.patterns) {
      if (pattern.test(normalized)) {
        const pool = entry.responses
        const main = pool[Math.floor(Math.random() * pool.length)]
        const followUp = FOLLOW_UP[Math.floor(Math.random() * FOLLOW_UP.length)]
        return `${main}\n\n---\n💬 *${followUp}*`
      }
    }
  }

  return null
}

// ─── Sentiment detector ────────────────────────────────────
function detectIntent(message) {
  const m = message.toLowerCase()
  if (/\bthank(s| you)\b/.test(m))          return 'gratitude'
  if (/\bhow are you\b/.test(m))             return 'small_talk'
  if (/\bwhat (can|do) you (do|know)\b/.test(m)) return 'capability'
  if (/\b(bye|goodbye|see you)\b/.test(m))  return 'farewell'
  return null
}

function isVagueContextFollowUp(message) {
  const m = message.toLowerCase().trim()
  const words = m.split(/\s+/).filter(Boolean)
  if (words.length > 8) return false

  return [
    /^(tell me more|explain more|explain again|what do you mean)\??$/,
    /^(what about it|how about it|is that serious|why is that)\??$/,
    /^(and that|also that|same as above|the previous one)\??$/,
    /\b(this|that|it|those|them|previous|earlier|above)\b/,
  ].some(pattern => pattern.test(m))
}

const INTENT_RESPONSES = {
  gratitude:   "You're very welcome! 😊 Don't hesitate to ask if you have more health questions. Take care!",
  small_talk:  "I'm doing great and ready to help! 💪 What health topic can I assist you with today?",
  capability:  "I can help you with:\n\n• Explaining prescriptions and medical terms\n• Medicine safety and general interaction cautions (not a substitute for your pharmacist)\n• Allergy awareness and what to watch for\n• First aid and when to seek urgent or emergency care\n• Health awareness, prevention, and lifestyle tips\n• Understanding vital signs, labs, and reports at a high level\n\nAsk me anything health-related in plain language. For emergencies, contact local emergency services right away.",
  farewell:    "Goodbye! 👋 Stay healthy and don't hesitate to return if you have health questions. Take care!",
}

const SYSTEM_INSTRUCTION = `You are HealthGuardian AI Mentor in the HealthGuardian app.
Scope (use cases): explain prescriptions and medical terms in plain language; general medicine safety awareness;
allergy and common drug-interaction cautions when the user mentions drugs (always advise confirming with a clinician/pharmacist);
first aid-style guidance and when to seek urgent or emergency care; health awareness and wellness tips; answer general health questions.
Rules: be clear, practical, and cautious. You are not a doctor—do not diagnose, do not prescribe or change doses, and do not tell users to stop prescribed medication.
For any emergency, serious symptoms, or uncertainty, tell the user to contact local emergency services or a qualified professional immediately.
Keep answers concise unless the user asks for detail.`

function buildGeminiHistory(history = []) {
  if (!Array.isArray(history)) return []
  return history
    .filter(item => item && typeof item.content === 'string' && item.content.trim())
    .slice(-12)
    .map(item => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }],
    }))
}

async function queryGemini(message, history = [], options = {}) {
  if (!GEMINI_API_KEY || typeof fetch !== 'function') return null

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`
  const geminiHistory = buildGeminiHistory(history)
  const userPrompt = options.contextPrompt || message
  const systemInstruction = options.systemInstruction || SYSTEM_INSTRUCTION

  const response = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [...geminiHistory, { role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Gemini API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const reply = data?.candidates?.[0]?.content?.parts
    ?.map(part => part?.text || '')
    .join('')
    .trim()

  return reply || null
}

// ─── Exported AI service ────────────────────────────────────
const processQuery = async (message, history = [], options = {}) => {
  if (!message || typeof message !== 'string') {
    return { reply: 'Please provide a valid health question.' }
  }

  const trimmed = message.trim()
  if (trimmed.length < 2) {
    return { reply: 'Could you please elaborate on your question?' }
  }

  // Check intent first
  const intent = detectIntent(trimmed)
  if (intent) {
    return {
      reply:   INTENT_RESPONSES[intent],
      matched: intent,
    }
  }

  // Prefer Gemini when API key is configured
  try {
    const geminiReply = await queryGemini(trimmed, history, options)
    if (geminiReply) {
      return { reply: geminiReply, matched: options.contextPrompt ? 'gemini_medical_mentor' : 'gemini' }
    }
  } catch (error) {
    // Fall back to local KB to keep feature available even if provider fails
    if (process.env.NODE_ENV === 'development') {
      console.warn('Gemini query failed, using fallback:', error.message)
    }
  }

  // Match against knowledge base
  const matched = matchResponse(trimmed)
  if (matched) {
    return { reply: matched, matched: 'kb_match' }
  }

  // Context-aware follow-up only for vague references like "what about it?"
  if (history.length > 0 && isVagueContextFollowUp(trimmed)) {
    const last = history.filter(h => h.role === 'assistant').pop()
    if (last) {
      return {
        reply: `I noticed your question may be related to our earlier discussion. Could you provide more details so I can give you the most accurate health information?\n\nAlternatively, you can ask me about:\n• Blood pressure, heart rate, or oxygen levels\n• Diabetes or blood sugar management\n• Diet, nutrition, or exercise\n• Medications or vaccinations\n• Sleep, stress, or mental health\n• Lab results interpretation\n\nWhat would you like to know? 😊`,
        matched: 'context_aware',
      }
    }
  }

  // Generic fallback
  return {
    reply: `I understand you're asking about **"${trimmed}"**. While I'm trained to answer common health questions, I may not have specific information on this topic.\n\n**I can help you with:**\n🩺 Vital signs (BP, heart rate, temperature, oxygen)\n🩸 Blood tests and lab results\n💊 Medications and prescriptions\n🥗 Diet, nutrition and exercise\n🧠 Mental health and stress\n💉 Vaccines and immunization\n🚨 Emergency health guidance\n\nPlease try rephrasing your question or ask about one of the topics above. For specific medical advice, always consult your healthcare provider.`,
    matched: 'fallback',
  }
}

module.exports = { processQuery }
