import { Router } from 'express'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { upload } from '../middleware/upload.js'
import { parsePDF, searchInText, sanitizeTitle, readMetadata, writeMetadata, loadAllMetadata, computeFileHash } from '../services/pdfService.js'
import type { PaperMetadata } from '../services/pdfService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = Router()

const uploadsDir = path.resolve(__dirname, '../../../uploads')

export interface PdfStoreEntry {
  filename: string
  filePath: string
  text: string
  numPages: number
  title: string
  originalName: string
  uploadedAt: string
  contentHash: string
}

const pdfStore = new Map<string, PdfStoreEntry>()

function bootstrapFromDisk() {
  const metas = loadAllMetadata(uploadsDir)
  for (const meta of metas) {
    const pdfPath = path.join(uploadsDir, meta.filename)
    if (!fs.existsSync(pdfPath)) continue

    let contentHash = meta.contentHash || ''
    if (!contentHash) {
      const buffer = fs.readFileSync(pdfPath)
      contentHash = computeFileHash(buffer)
      meta.contentHash = contentHash
      writeMetadata(path.join(uploadsDir, meta.id + '.meta.json'), meta)
    }

    pdfStore.set(meta.id, {
      filename: meta.filename,
      filePath: pdfPath,
      text: '',
      numPages: meta.numPages,
      title: meta.title,
      originalName: meta.originalName,
      uploadedAt: meta.uploadedAt,
      contentHash,
    })
  }
}
bootstrapFromDisk()

// List all papers
router.get('/', (_req, res) => {
  const papers: Array<{ id: string; title: string; uploadedAt: string }> = []
  pdfStore.forEach((entry, id) => {
    papers.push({ id, title: entry.title, uploadedAt: entry.uploadedAt })
  })
  papers.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  res.json(papers)
})

// Upload and parse PDF
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 PDF 文件' })
    }

    const filePath = req.file.path
    const fileBuffer = await fs.promises.readFile(filePath)
    const contentHash = computeFileHash(fileBuffer)

    // Check for duplicate
    for (const [id, entry] of pdfStore) {
      if (entry.contentHash === contentHash) {
        fs.unlinkSync(filePath)
        return res.status(409).json({ duplicate: true, existingId: id, existingTitle: entry.title })
      }
    }

    const result = await parsePDF(filePath)

    const rawTitle = (result.info?.Title as string) || path.basename(req.file.originalname, '.pdf')
    const sanitized = sanitizeTitle(rawTitle)
    const randomSuffix = crypto.randomBytes(4).toString('hex')
    const id = sanitized + '_' + Date.now() + '_' + randomSuffix
    const newFilename = id + '.pdf'
    const newPath = path.join(uploadsDir, newFilename)

    fs.renameSync(filePath, newPath)

    const meta: PaperMetadata = {
      id,
      title: rawTitle,
      filename: newFilename,
      originalName: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      numPages: result.numPages,
      contentHash,
    }
    writeMetadata(path.join(uploadsDir, id + '.meta.json'), meta)

    pdfStore.set(id, {
      filename: newFilename,
      filePath: newPath,
      text: result.text,
      numPages: result.numPages,
      title: rawTitle,
      originalName: req.file.originalname,
      uploadedAt: meta.uploadedAt,
      contentHash,
    })

    res.json({
      id,
      filename: rawTitle,
      text: result.text,
      numPages: result.numPages,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '上传失败'
    res.status(500).json({ error: message })
  }
})

// Get PDF file for rendering
router.get('/:id/file', (req, res) => {
  const entry = pdfStore.get(req.params.id)
  if (!entry) {
    return res.status(404).json({ error: '文件未找到' })
  }
  res.sendFile(entry.filePath)
})

// Search text in PDF
router.post('/:id/search', (req, res) => {
  const entry = pdfStore.get(req.params.id)
  if (!entry) {
    return res.status(404).json({ error: '文件未找到' })
  }

  const { query } = req.body
  if (!query) {
    return res.status(400).json({ error: '请提供搜索文本' })
  }

  const result = searchInText(entry.text, query)
  res.json(result)
})

// Get PDF info
router.get('/:id', async (req, res) => {
  const entry = pdfStore.get(req.params.id)
  if (!entry) {
    return res.status(404).json({ error: '文件未找到' })
  }

  if (req.query.loadText === 'true' && !entry.text) {
    const result = await parsePDF(entry.filePath)
    entry.text = result.text
  }

  res.json({
    id: req.params.id,
    filename: entry.title,
    numPages: entry.numPages,
    text: entry.text,
    filePath: entry.filePath,
  })
})

export default router
export { pdfStore }
