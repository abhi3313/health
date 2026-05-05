# HealthGuardian – Backend API

Personal Health Management System — Node.js + Express + MongoDB

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your MongoDB URI and JWT secret

# 4. Seed the database with demo data
npm run seed

# 5. Start development server
npm run dev
```

API runs at: **http://localhost:5000/api**

---

## 📁 Folder Structure

```
healthguardian-backend/
├── server.js                  # Entry point
├── .env.example               # Environment template
├── package.json
│
├── config/
│   ├── db.js                  # MongoDB connection
│   └── multer.js              # File upload config
│
├── models/
│   ├── User.js                # Patient, Doctor, Admin schema
│   ├── HealthRecord.js        # Medical records
│   ├── Report.js              # Uploaded files/reports
│   ├── Appointment.js         # Appointments
│   ├── Vital.js               # Vitals (BP, HR, O2, etc.)
│   ├── Prescription.js        # Prescriptions
│   └── AuditLog.js            # System audit trail
│
├── middleware/
│   ├── auth.js                # JWT protect + role guard
│   ├── errorHandler.js        # Global error handler
│   ├── notFound.js            # 404 handler
│   ├── validate.js            # express-validator wrapper
│   └── auditLogger.js         # Auto audit logging
│
├── controllers/
│   ├── authController.js      # Register, login, profile
│   ├── patientController.js   # Patient features
│   ├── doctorController.js    # Doctor features
│   ├── adminController.js     # Admin panel
│   └── aiController.js        # AI chat
│
├── routes/
│   ├── authRoutes.js
│   ├── patientRoutes.js
│   ├── doctorRoutes.js
│   ├── adminRoutes.js
│   └── aiRoutes.js
│
├── services/
│   └── aiService.js           # Rule-based AI engine
│
└── utils/
    ├── seeder.js              # Demo data seeder
    └── responseHelper.js      # Response utilities
```

---

## 🔐 Authentication

All protected routes require:
```
Authorization: Bearer <JWT_TOKEN>
```

JWT is returned on login/register. Expires in **7 days** (configurable).

---

## 📡 API Endpoints

### Base URL: `http://localhost:5000/api`

All responses follow this format:
```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {}
}
```

---

### 🔑 Auth Routes — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Register new user |
| POST | `/auth/login` | ❌ | Login and get token |
| GET | `/auth/me` | ✅ | Get current user |
| PUT | `/auth/me` | ✅ | Update profile |
| PUT | `/auth/change-password` | ✅ | Change password |
| POST | `/auth/logout` | ✅ | Logout |
| POST | `/auth/refresh` | ✅ | Refresh JWT token |

**Register body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "role": "patient",
  "phone": "+1 555 000 0001",
  "dateOfBirth": "1990-05-15",
  "bloodGroup": "O+"
}
```

**Login body:**
```json
{
  "email": "patient@demo.com",
  "password": "demo123"
}
```

---

### 🧑‍⚕️ Patient Routes — `/api/patient`
*Requires auth + role: `patient`*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patient/dashboard` | Full dashboard data |
| GET | `/patient/stats` | Quick stats |
| GET | `/patient/records` | Get all records |
| POST | `/patient/records` | Add a record |
| GET | `/patient/records/:id` | Get single record |
| PUT | `/patient/records/:id` | Update record |
| DELETE | `/patient/records/:id` | Delete record |
| POST | `/patient/reports/upload` | Upload file (multipart) |
| GET | `/patient/reports` | Get uploaded reports |
| DELETE | `/patient/reports/:id` | Delete report |
| GET | `/patient/appointments` | Get appointments |
| POST | `/patient/appointments` | Book appointment |
| DELETE | `/patient/appointments/:id` | Cancel appointment |
| GET | `/patient/vitals?range=7d` | Get vitals + chart |
| POST | `/patient/vitals` | Add vital reading |
| GET | `/patient/prescriptions` | Get prescriptions |

**Add Record body:**
```json
{
  "type": "Blood Test",
  "description": "CBC results all normal",
  "notes": "Follow up in 3 months",
  "date": "2024-03-15"
}
```

**Upload Report:** `multipart/form-data`
- Field: `report` (file)
- Field: `tag` (string)
- Field: `description` (string)

**Book Appointment body:**
```json
{
  "doctorId": "<doctor_id>",
  "date": "2024-04-01",
  "time": "10:00 AM",
  "reason": "Annual checkup",
  "type": "in-person"
}
```

**Add Vital body:**
```json
{
  "heartRate": { "value": 72 },
  "bloodPressure": { "systolic": 120, "diastolic": 80 },
  "temperature": { "value": 98.6 },
  "oxygenSaturation": { "value": 98 },
  "glucose": { "value": 95, "type": "fasting" },
  "weight": { "value": 75 },
  "height": { "value": 178 }
}
```

---

### 👨‍⚕️ Doctor Routes — `/api/doctor`
*Requires auth + role: `doctor` + `isApproved: true`*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/doctor/dashboard` | Doctor dashboard |
| GET | `/doctor/stats` | Quick stats |
| GET | `/doctor/patients` | All patients list |
| GET | `/doctor/patients/:id` | Patient detail |
| GET | `/doctor/patients/:id/records` | Patient records |
| POST | `/doctor/patients/:id/records` | Add record for patient |
| POST | `/doctor/patients/:id/notes` | Add clinical note |
| GET | `/doctor/appointments` | All appointments |
| PUT | `/doctor/appointments/:id` | Update appointment |
| GET | `/doctor/patients/:id/prescriptions` | Patient prescriptions |
| POST | `/doctor/patients/:id/prescriptions` | Create prescription |

**Add Prescription body:**
```json
{
  "diagnosis": "Hypertension Stage 1",
  "medications": [
    {
      "name": "Amlodipine",
      "dosage": "5mg",
      "frequency": "Once daily",
      "duration": "3 months",
      "route": "oral",
      "instructions": "Take in the morning"
    }
  ],
  "instructions": "Monitor BP daily",
  "followUpDate": "2024-06-01"
}
```

---

### 🛡️ Admin Routes — `/api/admin`
*Requires auth + role: `admin`*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats` | System statistics |
| GET | `/admin/system-health` | Server health info |
| GET | `/admin/logs` | Audit logs |
| GET | `/admin/users` | All users |
| POST | `/admin/users` | Create user |
| GET | `/admin/users/:id` | Get user detail |
| PUT | `/admin/users/:id` | Update user |
| DELETE | `/admin/users/:id` | Delete user |
| PATCH | `/admin/users/:id/toggle-status` | Toggle active/suspended |
| GET | `/admin/doctors` | All doctors |
| PATCH | `/admin/doctors/:id/approve` | Approve/reject doctor |
| GET | `/admin/patients` | All patients |

**Approve Doctor body:**
```json
{ "approve": true }
```

---

### 🤖 AI Routes — `/api/ai`
*Requires auth (any role)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/query` | Ask AI health question |
| GET | `/ai/sessions` | Get query history |

**AI Query body:**
```json
{
  "message": "What is normal blood pressure?",
  "history": [
    { "role": "user", "content": "Previous question" },
    { "role": "assistant", "content": "Previous answer" }
  ]
}
```

**AI Response:**
```json
{
  "success": true,
  "message": "AI response generated",
  "data": {
    "reply": "Blood pressure guide...",
    "timestamp": "2024-03-15T10:30:00.000Z",
    "matched": "kb_match"
  }
}
```

**AI topics supported:**
- Blood pressure & hypertension
- Heart rate & pulse
- Diabetes & blood sugar
- Cholesterol & lipids
- Fever & temperature
- Oxygen saturation
- BMI & weight
- Sleep & insomnia
- Stress & mental health
- Diet & nutrition
- Exercise & fitness
- Medications & side effects
- Vaccinations
- Lab results interpretation
- Smoking & alcohol
- Pregnancy
- Allergies & anaphylaxis
- Headache & migraine
- COVID & respiratory illness
- Emergency guidance

---

## 🧪 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | demo123 |
| Doctor | doctor@demo.com | demo123 |
| Doctor 2 | doctor2@demo.com | demo123 |
| Patient | patient@demo.com | demo123 |
| Patient 2 | patient2@demo.com | demo123 |
| Patient 3 | patient3@demo.com | demo123 |

---

## ⚙️ Environment Variables

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/healthguardian
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d
MAX_FILE_SIZE=10485760
UPLOAD_PATH=uploads/
FRONTEND_URL=http://localhost:3000
```

---

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| express | Web framework |
| mongoose | MongoDB ODM |
| bcryptjs | Password hashing |
| jsonwebtoken | JWT auth |
| cors | Cross-origin requests |
| helmet | Security headers |
| morgan | HTTP logging |
| multer | File uploads |
| express-validator | Input validation |
| express-rate-limit | Rate limiting |
| express-async-errors | Async error handling |
| dotenv | Environment variables |
| uuid | Unique IDs |

---

## 🔒 Security Features

- JWT with expiry
- bcrypt password hashing (12 rounds)
- Rate limiting (200 req/15min, 20 auth/15min)
- Helmet security headers
- CORS whitelisting
- Input validation on all routes
- Role-based access control
- Doctor approval workflow
- Audit logging for all actions
- File type and size validation
