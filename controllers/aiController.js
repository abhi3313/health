const { processQuery } = require('../services/aiService')
const {
  MEDICAL_MENTOR_SYSTEM_INSTRUCTION,
  buildMedicalMentorContext,
} = require('../services/medicalContextService')
const { saveChatHistory } = require('../services/chatHistoryService')
const {
  createConversation,
  deleteConversation,
  ensureConversation,
  generateTitle,
  getConversations,
  loadConversation,
  touchConversation,
} = require('../services/conversationService')
const {
  getMessages,
  saveMessage,
} = require('../services/chatService')

// ── POST /api/ai/query ──────────────────────────────────────
const query = async (req, res) => {
  const { message, history = [], sessionId } = req.body

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'A message is required.' })
  }

  if (message.trim().length > 1000) {
    return res.status(400).json({ success: false, message: 'Message too long. Please keep it under 1000 characters.' })
  }

  if (!Array.isArray(history)) {
    return res.status(400).json({ success: false, message: 'History must be an array.' })
  }

  let conversation = await ensureConversation(req.user?._id, sessionId, message.trim())
  const persistedMessages = await getMessages(req.user?._id, conversation.sessionId)
  const aiHistory = persistedMessages.length
    ? persistedMessages.map(m => ({ role: m.role, content: m.message }))
    : history

  if (persistedMessages.length === 0 && conversation.title === 'New chat') {
    conversation = await touchConversation(req.user?._id, conversation.sessionId, {
      title: generateTitle(message.trim()),
    }) || conversation
  }

  const userMessage = await saveMessage({
    userId: req.user?._id,
    sessionId: conversation.sessionId,
    role: 'user',
    content: message.trim(),
  })

  let medicalContext = null
  try {
    medicalContext = await buildMedicalMentorContext(req.user?._id, message.trim(), aiHistory)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Medical mentor context failed:', error.message)
    }
  }

  let result
  try {
    result = await processQuery(message.trim(), aiHistory, {
      contextPrompt: medicalContext?.prompt,
      systemInstruction: MEDICAL_MENTOR_SYSTEM_INSTRUCTION,
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('AI mentor query failed, using local fallback:', error.message)
    }
    result = await processQuery(message.trim(), aiHistory)
  }

  const assistantMessage = await saveMessage({
    userId: req.user?._id,
    sessionId: conversation.sessionId,
    role: 'assistant',
    content: result.reply,
  })

  await saveChatHistory({
    userId: req.user?._id,
    userMessage: message.trim(),
    assistantReply: result.reply,
    matched: result.matched,
    contextSummary: medicalContext?.summary || { contextUnavailable: true },
    sessionId: conversation.sessionId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })

  return res.json({
    success: true,
    message: 'AI response generated',
    data: {
      reply:     result.reply,
      sessionId: conversation.sessionId,
      conversation,
      messages: {
        user: userMessage,
        assistant: assistantMessage,
      },
      timestamp: new Date().toISOString(),
      matched:   result.matched,
    },
  })
}

// ── GET /api/ai/sessions ────────────────────────────────────
const getSessions = async (req, res) => {
  const conversations = await getConversations(req.user._id)

  res.json({ success: true, message: 'AI sessions fetched', data: { sessions: conversations } })
}

const createConversationHandler = async (req, res) => {
  const conversation = await createConversation(req.user._id, req.body?.title || '')
  res.status(201).json({
    success: true,
    message: 'Conversation created',
    data: { conversation },
  })
}

const getConversationsHandler = async (req, res) => {
  const conversations = await getConversations(req.user._id)
  res.json({
    success: true,
    message: 'Conversations fetched',
    data: { conversations },
  })
}

const getConversationMessagesHandler = async (req, res) => {
  const conversation = await loadConversation(req.user._id, req.params.sessionId)
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found.', data: null })
  }

  const messages = await getMessages(req.user._id, req.params.sessionId)
  res.json({
    success: true,
    message: 'Conversation loaded',
    data: { conversation, messages },
  })
}

const deleteConversationHandler = async (req, res) => {
  const result = await deleteConversation(req.user._id, req.params.sessionId)
  if (!result) {
    return res.status(404).json({ success: false, message: 'Conversation not found.', data: null })
  }

  res.json({
    success: true,
    message: 'Conversation deleted',
    data: {
      sessionId: req.params.sessionId,
      deletedMessages: result.deletedMessages,
      deletedAuditLogs: result.deletedAuditLogs,
    },
  })
}

module.exports = {
  createConversationHandler,
  deleteConversationHandler,
  getConversationMessagesHandler,
  getConversationsHandler,
  getSessions,
  query,
}
