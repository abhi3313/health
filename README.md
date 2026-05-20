# HealthGuardian Backend API

Node.js, Express, and MongoDB backend for HealthGuardian.

## Quick Start

```bash
npm install
cp .env.example .env
```

Edit `.env` with your MongoDB URI, JWT secret, frontend URL, and first admin credentials:

```env
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_a_strong_password
```

Create the first admin account:

```bash
npm run bootstrap:admin
```

Start the API:

```bash
npm run dev
```

API base URL:

```text
http://localhost:5000/api
```

## Authentication

Protected routes require:

```text
Authorization: Bearer <JWT_TOKEN>
```

Use `/api/auth/register` for patient and doctor self-registration. Doctors must be approved by an admin before accessing doctor routes.

## Core Routes

Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/me`
- `PUT /api/auth/change-password`
- `POST /api/auth/logout`

Patient:
- `GET /api/patient/dashboard`
- `GET /api/patient/records`
- `POST /api/patient/records`
- `GET /api/patient/appointments`
- `POST /api/patient/appointments`
- `GET /api/patient/vitals?range=7d`
- `POST /api/patient/vitals`
- `GET /api/patient/prescriptions`

Doctor:
- `GET /api/doctor/dashboard`
- `GET /api/doctor/patients`
- `GET /api/doctor/appointments`
- `PUT /api/doctor/appointments/:id`
- `POST /api/doctor/patients/:id/records`
- `POST /api/doctor/patients/:id/notes`
- `POST /api/doctor/patients/:id/prescriptions`

Admin:
- `GET /api/admin/stats`
- `GET /api/admin/system-health`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/doctors/:id/approve`

## Environment Variables

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/healthguardian
JWT_SECRET=replace_with_a_long_random_secret_at_least_32_chars
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
MAX_FILE_SIZE=10485760
UPLOAD_PATH=uploads/
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_a_strong_password
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_IDS=
REQUIRE_REGISTER_OTP=false
```
