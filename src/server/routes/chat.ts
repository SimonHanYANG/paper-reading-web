import { Router } from 'express'
import { streamChat } from '../services/deepseekService.js'

const router = Router()

router.post('/chat', async (req, res) => {
  const { messages, context } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '请提供对话消息' })
  }

  await streamChat(messages, context || { pdfText: '', currentNote: '' }, res)
})

export default router
