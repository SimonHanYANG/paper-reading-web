import type { PDFInfo, SearchResult, PaperListItem } from '../types'

export class DuplicatePdfError extends Error {
  constructor(public existingId: string, public existingTitle: string) {
    super('duplicate')
    this.name = 'DuplicatePdfError'
  }
}

export async function uploadPDF(file: File): Promise<PDFInfo> {
  const formData = new FormData()
  formData.append('pdf', file)
  const res = await fetch('/api/pdf/upload', { method: 'POST', body: formData })
  if (res.status === 409) {
    const data = await res.json()
    throw new DuplicatePdfError(data.existingId, data.existingTitle)
  }
  if (!res.ok) throw new Error('上传失败')
  return res.json()
}

export async function getPdfInfo(id: string): Promise<PDFInfo & { filePath: string }> {
  const res = await fetch(`/api/pdf/${id}`)
  if (!res.ok) throw new Error('获取 PDF 信息失败')
  return res.json()
}

export async function searchInPdf(id: string, query: string): Promise<SearchResult> {
  const res = await fetch(`/api/pdf/${id}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error('搜索失败')
  return res.json()
}

export async function saveNote(pdfId: string, noteContent: string): Promise<{ savedPath: string; message: string }> {
  const res = await fetch('/api/notes/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfId, noteContent }),
  })
  if (!res.ok) throw new Error('保存失败')
  return res.json()
}

export function createAnalyzeStream(pdfId: string): EventSource {
  return new EventSource(`/api/analyze?pdfId=${pdfId}`)
}

export async function startAnalyzeStream(
  pdfId: string,
  onChunk: (content: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  signal?: AbortSignal
) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfId }),
    signal,
  })

  if (!res.ok || !res.body) {
    onError('分析请求失败')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (!data) continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) {
              onError(parsed.error)
              return
            }
            if (parsed.done) {
              onDone()
              return
            }
            if (parsed.content) {
              onChunk(parsed.content)
            }
          } catch {
            // Skip malformed data
          }
        }
      }
    }
    onDone()
  } catch (err) {
    if (signal?.aborted) return // aborted, no callback needed
    onError(err instanceof Error ? err.message : '分析中断')
  }
}

export async function startChatStream(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: { pdfText: string; currentNote: string },
  onChunk: (content: string) => void,
  onDone: () => void,
  onError: (err: string) => void
) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  })

  if (!res.ok || !res.body) {
    onError('对话请求失败')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (!data) continue
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) {
            onError(parsed.error)
            return
          }
          if (parsed.done) {
            onDone()
            return
          }
          if (parsed.content) {
            onChunk(parsed.content)
          }
        } catch {
          // Skip malformed data
        }
      }
    }
  }
  onDone()
}

export async function fetchPaperList(): Promise<PaperListItem[]> {
  const res = await fetch('/api/pdf')
  if (!res.ok) throw new Error('获取论文列表失败')
  return res.json()
}

export async function loadHistoricalPdf(id: string): Promise<PDFInfo> {
  const res = await fetch(`/api/pdf/${id}?loadText=true`)
  if (!res.ok) throw new Error('加载 PDF 失败')
  const data = await res.json()
  return { ...data, isHistorical: true }
}

export async function loadNote(pdfId: string): Promise<string | null> {
  const res = await fetch(`/api/notes/${pdfId}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.content
}
