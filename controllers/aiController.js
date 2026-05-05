const { processQuery } = require('../services/aiService')
const AuditLog         = require('../models/AuditLog')

// ── POST /api/ai/query ──────────────────────────────────────
const query = async (req, res) => {
  const { message, history = [] } = req.body

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'A message is required.' })
  }

  if (message.trim().length > 1000) {
    return res.status(400).json({ success: false, message: 'Message too long. Please keep it under 1000 characters.' })
  }

  if (!Array.isArray(history)) {
    return res.status(400).json({ success: false, message: 'History must be an array.' })
  }

  const result = await processQuery(message.trim(), history)

  // Non-blocking audit log
  AuditLog.create({
    user:     req.user?._id,
    action:   'AI_QUERY',
    resource: 'AI',
    details:  { messageLength: message.length, matched: result.matched },
    ip:       req.ip,
  }).catch(() => {})

  return res.json({
    success: true,
    message: 'AI response generated',
    data: {
      reply:     result.reply,
      timestamp: new Date().toISOString(),
      matched:   result.matched,
    },
  })
}

// ── GET /api/ai/sessions ────────────────────────────────────
const getSessions = async (req, res) => {
  const logs = await AuditLog.find({
    user:   req.user._id,
    action: 'AI_QUERY',
  }).sort({ createdAt: -1 }).limit(50)

  res.json({ success: true, message: 'AI sessions fetched', data: { sessions: logs } })
}

module.exports = { query, getSessions }
