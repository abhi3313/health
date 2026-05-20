'use strict'

const AuditLog = require('../models/AuditLog')
const { cleanText } = require('./historyService')

async function fetchPreviousAIChatHistory(userId, limit = 6) {
  if (!userId) return []

  const logs = await AuditLog.find({
    user: userId,
    action: 'AI_QUERY',
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 6, 1), 20))
    .lean()

  return logs
    .filter(log => log.details?.userMessage || log.details?.assistantReply)
    .reverse()
    .map(log => ({
      user: cleanText(log.details?.userMessage || '', 300),
      assistant: cleanText(log.details?.assistantReply || '', 500),
      matched: log.details?.matched || '',
      at: log.createdAt,
    }))
}

async function saveChatHistory({
  userId,
  userMessage,
  assistantReply,
  matched,
  contextSummary,
  sessionId,
  ip,
  userAgent,
}) {
  if (!userId) return null

  try {
    return await AuditLog.create({
      user: userId,
      action: 'AI_QUERY',
      resource: 'AI',
      details: {
        messageLength: String(userMessage || '').length,
        replyLength: String(assistantReply || '').length,
        userMessage,
        assistantReply,
        matched,
        contextSummary,
        sessionId,
      },
      ip,
      userAgent,
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Could not save AI chat history:', error.message)
    }
    return null
  }
}

module.exports = {
  fetchPreviousAIChatHistory,
  saveChatHistory,
}
