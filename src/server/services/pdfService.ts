import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import pdf from 'pdf-parse'

export interface PDFParseResult {
  text: string
  numPages: number
  info: Record<string, unknown>
}

export interface PaperMetadata {
  id: string
  title: string
  filename: string
  originalName: string
  uploadedAt: string
  numPages: number
  contentHash?: string
}

export function sanitizeTitle(title: string): string {
  let s = title
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[{}[\]()#@!$%^&+=~`'";,.]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 100)
  return s || 'untitled'
}

export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export function readMetadata(metaPath: string): PaperMetadata {
  const raw = fs.readFileSync(metaPath, 'utf-8')
  return JSON.parse(raw) as PaperMetadata
}

export function writeMetadata(metaPath: string, meta: PaperMetadata): void {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
}

export function loadAllMetadata(uploadsDir: string): PaperMetadata[] {
  if (!fs.existsSync(uploadsDir)) return []
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.meta.json'))
  const metas: PaperMetadata[] = []
  for (const f of files) {
    try {
      const meta = readMetadata(path.join(uploadsDir, f))
      metas.push(meta)
    } catch {
      // skip corrupted meta files
    }
  }
  metas.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  return metas
}

export async function parsePDF(filePath: string): Promise<PDFParseResult> {
  const buffer = await fs.promises.readFile(filePath)
  const data = await pdf(buffer)
  return {
    text: data.text,
    numPages: data.numpages,
    info: data.info as Record<string, unknown>,
  }
}

export function searchInText(fullText: string, query: string): { found: boolean; index: number; context: string; pageEstimate: number } {
  const normalizedQuery = query.trim().toLowerCase()
  const normalizedText = fullText.toLowerCase()
  const index = normalizedText.indexOf(normalizedQuery)

  if (index === -1) {
    // Try fuzzy search: split by sentences and find best match
    const sentences = fullText.split(/[。！？\n.!?]+/).filter(s => s.trim().length > 10)
    let bestMatch = ''
    let bestScore = 0
    for (const sentence of sentences) {
      const words = normalizedQuery.split(/\s+/)
      const matchCount = words.filter(w => sentence.toLowerCase().includes(w)).length
      const score = matchCount / words.length
      if (score > bestScore && score > 0.5) {
        bestScore = score
        bestMatch = sentence
      }
    }
    if (bestMatch) {
      const idx = fullText.indexOf(bestMatch)
      // Rough page estimate: assume ~2000 chars per page
      const pageEstimate = Math.floor(idx / 2000) + 1
      return { found: true, index: idx, context: bestMatch.trim(), pageEstimate }
    }
    return { found: false, index: -1, context: '', pageEstimate: 1 }
  }

  // Extract surrounding context (500 chars before and after)
  const start = Math.max(0, index - 200)
  const end = Math.min(fullText.length, index + query.length + 200)
  const context = fullText.substring(start, end).trim()
  const pageEstimate = Math.floor(index / 2000) + 1

  return { found: true, index, context, pageEstimate }
}
