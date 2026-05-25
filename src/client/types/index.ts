export interface PDFInfo {
  id: string
  filename: string
  numPages: number
  text: string
  isHistorical?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SearchResult {
  found: boolean
  index: number
  context: string
  pageEstimate: number
}

export interface PaperListItem {
  id: string
  title: string
  uploadedAt: string
}
