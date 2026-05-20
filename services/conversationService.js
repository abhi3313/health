'use strict'

const crypto = require('crypto')
const AuditLog = require('../models/AuditLog')
const ChatMessage = require('../models/ChatMessage')
const Conversation = require('../models/Conversation')

function makeSessionId() {
  return `chat_${crypto.randomUUID()}`
}

function generateTitle(message = '') {
  const cleaned = String(message || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s'-]/g, '')
    .trim()

  if (!cleaned) return 'New chat'

  const words = cleaned.split(' ').filter(Boolean).slice(0, 5)
  const title = words.join(' ')
  return title.length > 42 ? `${title.slice(0, 39).trim()}...` : title
}

async function createConversation(userId, titleSource = '') {
  if (!userId) throw new Error('userId is required')

  const conversation = await Conversation.create({
    sessionId: makeSessionId(),
    userId,
    title: generateTitle(titleSource),
    lastMessageAt: new Date(),
  })

  return conversation.toObject()
}

async function getConversations(userId) {
  if (!userId) return []

  return Conversation.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean()
}

async function loadConversation(userId, sessionId) {
  if (!userId || !sessionId) return null

  return Conversation.findOne({ userId, sessionId }).lean()
}

async function deleteConversation(userId, sessionId) {
  if (!userId || !sessionId) return null

  const conversation = await Conversation.findOneAndDelete({ userId, sessionId }).lean()
  if (!conversation) return null

  const [messagesResult, auditResult] = await Promise.all([
    ChatMessage.deleteMany({ userId, sessionId }),
    AuditLog.deleteMany({
      user: userId,
      action: 'AI_QUERY',
      'details.sessionId': sessionId,
    }),
  ])

  return {
    conversation,
    deletedMessages: messagesResult.deletedCount || 0,
    deletedAuditLogs: auditResult.deletedCount || 0,
  }
}

async function touchConversation(userId, sessionId, updates = {}) {
  if (!userId || !sessionId) return null

  const update = {
    ...updates,
    lastMessageAt: new Date(),
  }

  return Conversation.findOneAndUpdate(
    { userId, sessionId },
    { $set: update },
    { new: true },
  ).lean()
}

async function ensureConversation(userId, sessionId, titleSource = '') {
  if (sessionId) {
    const existing = await loadConversation(userId, sessionId)
    if (existing) return existing
  }

  return createConversation(userId, titleSource)
}

module.exports = {
  createConversation,
  deleteConversation,
  ensureConversation,
  generateTitle,
  getConversations,
  loadConversation,
  touchConversation,
}
