import { Router } from 'express'
import { streamAnalyze } from '../services/deepseekService.js'
import { pdfStore } from './pdf.js'

const router = Router()

router.post('/analyze', async (req, res) => {
  const { pdfId, text } = req.body

  let pdfText = text

  if (!pdfText && pdfId) {
    const entry = pdfStore.get(pdfId)
    if (!entry) {
      return res.status(404).json({ error: 'PDF 未找到' })
    }
    pdfText = entry.text
  }

  if (!pdfText) {
    return res.status(400).json({ error: '请提供论文文本' })
  }

  await streamAnalyze(pdfText, res)
})

export default router
