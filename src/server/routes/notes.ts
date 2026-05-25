import { Router } from 'express'
import { saveNote, readNote } from '../services/noteService.js'
import { pdfStore } from './pdf.js'

const router = Router()

// Read note for a PDF
router.get('/:pdfId', (req, res) => {
  const entry = pdfStore.get(req.params.pdfId)
  if (!entry) {
    return res.status(404).json({ error: 'PDF 未找到' })
  }

  const content = readNote(entry.filePath, req.params.pdfId)
  if (!content) {
    return res.json({ content: null })
  }

  res.json({ content })
})

// Save note
router.post('/save', (req, res) => {
  try {
    const { pdfId, noteContent } = req.body

    if (!pdfId || noteContent === undefined) {
      return res.status(400).json({ error: '请提供 PDF ID 和笔记内容' })
    }

    const entry = pdfStore.get(pdfId)
    if (!entry) {
      return res.status(404).json({ error: 'PDF 未找到' })
    }

    const result = saveNote(entry.filePath, noteContent, pdfId)

    res.json({
      success: true,
      savedPath: result.savedPath,
      savedDir: result.savedDir,
      message: `笔记已保存`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '保存失败'
    res.status(500).json({ error: message })
  }
})

export default router
