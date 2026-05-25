import fs from 'fs'
import path from 'path'

export function saveNote(
  pdfOriginalPath: string,
  noteContent: string,
  pdfId: string
): { savedPath: string; savedDir: string } {
  const uploadsDir = path.dirname(pdfOriginalPath)
  const notesDir = path.join(uploadsDir, 'notes')
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true })
  }

  const fileName = `${pdfId}.md`
  const filePath = path.join(notesDir, fileName)

  fs.writeFileSync(filePath, noteContent, 'utf-8')

  return { savedPath: filePath, savedDir: notesDir }
}

export function readNote(pdfFilePath: string, pdfId: string): string | null {
  const uploadsDir = path.dirname(pdfFilePath)
  const notesDir = path.join(uploadsDir, 'notes')
  const filePath = path.join(notesDir, `${pdfId}.md`)

  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath, 'utf-8')
}
