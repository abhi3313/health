require('dotenv').config()
require('express-async-errors')

const express    = require('express')
const cors       = require('cors')
const helmet     = require('helmet')
const morgan     = require('morgan')
const path       = require('path')
const rateLimit  = require('express-rate-limit')

const connectDB      = require('./config/db')
const errorHandler   = require('./middleware/errorHandler')
const notFound       = require('./middleware/notFound')

// ── Routes ──────────────────────────────────────────────
const authRoutes        = require('./routes/authRoutes')
const patientRoutes     = require('./routes/patientRoutes')
const doctorRoutes      = require('./routes/doctorRoutes')
const adminRoutes       = require('./routes/adminRoutes')
const aiRoutes          = require('./routes/aiRoutes')
const accessRoutes      = require('./routes/accessRoutes')

const app  = express()
const PORT = process.env.PORT || 5000

// ── Connect Database ─────────────────────────────────────
connectDB()

// ── Security Middleware ───────────────────────────────────
app.use(helmet())

// ── CORS ──────────────────────────────────────────────────
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// ── Rate Limiting ─────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
})

// ── Body Parsers ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Logging ───────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
}

// ── Static Files (Uploads) ────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// ── Health Check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'HealthGuardian API is running',
    data: {
      version:     '1.0.0',
      environment: process.env.NODE_ENV,
      timestamp:   new Date().toISOString(),
      uptime:      `${Math.floor(process.uptime())}s`,
    },
  })
})

// ── API Routes ────────────────────────────────────────────
app.use('/api/auth',    authLimiter, authRoutes)
app.use('/api/patient', patientRoutes)
app.use('/api/doctor',  doctorRoutes)
app.use('/api/admin',   adminRoutes)
app.use('/api/ai',      aiRoutes)
app.use('/api/access',   accessRoutes)

// ── 404 + Error Handlers ─────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏥  HealthGuardian API`)
  console.log(`📡  Server running on http://localhost:${PORT}`)
  console.log(`🌿  Environment: ${process.env.NODE_ENV}`)
  console.log(`📋  API Base URL: http://localhost:${PORT}/api\n`)
})

module.exports = app
