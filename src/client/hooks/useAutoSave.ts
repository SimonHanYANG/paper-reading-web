import { useEffect, useRef, useCallback } from 'react'
import { saveNote } from '../services/api'

export function useAutoSave(
  pdfId: string | null,
  noteContent: string,
  isAnalyzing: boolean,
  isEditing: boolean,
  onSaveStatus?: (saved: boolean) => void
) {
  const prevAnalyzing = useRef(isAnalyzing)
  const prevEditing = useRef(isEditing)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSave = useCallback(async (id: string, content: string) => {
    try {
      await saveNote(id, content)
      onSaveStatus?.(true)
    } catch {
      onSaveStatus?.(false)
    }
  }, [onSaveStatus])

  // Debounced save during editing
  useEffect(() => {
    if (!pdfId || !isEditing || isAnalyzing || !noteContent.trim()) return

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      doSave(pdfId, noteContent)
    }, 2000)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [noteContent, isEditing, isAnalyzing, pdfId, doSave])

  // Immediate save on transitions
  useEffect(() => {
    if (!pdfId || !noteContent.trim()) return

    // Analysis just finished
    if (prevAnalyzing.current && !isAnalyzing) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        debounceTimer.current = null
      }
      doSave(pdfId, noteContent)
    }

    // Editing just finished (clicked "完成更改")
    if (prevEditing.current && !isEditing) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        debounceTimer.current = null
      }
      doSave(pdfId, noteContent)
    }

    prevAnalyzing.current = isAnalyzing
    prevEditing.current = isEditing
  }, [isAnalyzing, isEditing, pdfId, noteContent, doSave])
}
