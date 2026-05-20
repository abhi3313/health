'use strict'

const crypto = require('crypto')
const ChatMessage = require('../models/ChatMessage')
const { touchConversation } = require('./conversationService')

async function saveMessage({ userId, sessionId, role, content, timestamp = new Date() }) {
  if (!userId) throw new Error('userId is required')
  if (!sessionId) throw new Error('sessionId is required')
  if (!['user', 'assistant'].includes(role)) throw new Error('Invalid message role')

  const text = String(content || '').trim()
  if (!text) throw new Error('Message content is required')

  const message = await ChatMessage.create({
    messageId: crypto.randomUUID(),
    userId,
    sessionId,
    role,
    message: text,
    timestamp,
  })

  await touchConversation(userId, sessionId)
  return message.toObject()
}

async function getMessages(userId, sessionId) {
  if (!userId || !sessionId) return []

  return ChatMessage.find({ userId, sessionId })
    .sort({ timestamp: 1, createdAt: 1 })
    .lean()
}

module.exports = {
  getMessages,
  saveMessage,
}
