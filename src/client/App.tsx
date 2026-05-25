import { useState, useCallback, useEffect, useRef } from 'react'
import type { PDFInfo, ChatMessage, PaperListItem } from './types'
import FileUploader from './components/FileUploader'
import PDFViewer from './components/PDFViewer'
import TabSwitcher from './components/TabSwitcher'
import NoteEditor from './components/NoteEditor'
import ChatPanel from './components/ChatPanel'
import Sidebar from './components/Sidebar'
import ConfirmDialog from './components/ConfirmDialog'
import { uploadPDF, startAnalyzeStream, saveNote, fetchPaperList, loadHistoricalPdf, loadNote, DuplicatePdfError } from './services/api'
import { useAutoSave } from './hooks/useAutoSave'

type Tab = 'note' | 'chat'

export default function App() {
  const [pdfInfo, setPdfInfo] = useState<PDFInfo | null>(null)
  const [pdfFile, setPdfFile] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('note')
  const [noteContent, setNoteContent] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [paperList, setPaperList] = useState<PaperListItem[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isHistorical, setIsHistorical] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    action: 'analyze' | 'chat'
  }>({ isOpen: false, action: 'analyze' })
  const [duplicateInfo, setDuplicateInfo] = useState<{
    isOpen: boolean
    existingId: string
    existingTitle: string
  }>({ isOpen: false, existingId: '', existingTitle: '' })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pendingAnalyzeRef = useRef<string | null>(null)

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsAnalyzing(false)
  }, [])

  const refreshPaperList = useCallback(() => {
    return fetchPaperList().then(setPaperList).catch(console.error)
  }, [])

  const handleSaveStatus = useCallback((success: boolean) => {
    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current)
    setSaveStatus(success ? 'saved' : 'error')
    if (success) refreshPaperList()
    saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }, [refreshPaperList])

  useAutoSave(pdfInfo?.id || null, noteContent, isAnalyzing, isEditing, handleSaveStatus)

  // Load paper list on mount
  useEffect(() => {
    fetchPaperList().then(setPaperList).catch(console.error)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current)
    }
  }, [])

  const handleUpload = useCallback(async (file: File) => {
    cancelAnalysis()
    try {
      const info = await uploadPDF(file)
      setPdfInfo(info)
      setPdfFile(`/api/pdf/${info.id}/file`)
      setNoteContent('')
      setChatMessages([])
      setIsEditing(false)
      setIsHistorical(false)
      await refreshPaperList()
    } catch (err) {
      if (err instanceof DuplicatePdfError) {
        setDuplicateInfo({ isOpen: true, existingId: err.existingId, existingTitle: err.existingTitle })
      } else {
        alert('上传失败: ' + (err instanceof Error ? err.message : '未知错误'))
      }
    }
  }, [refreshPaperList, cancelAnalysis])

  const handleSelectPaper = useCallback(async (id: string) => {
    if (pdfInfo?.id === id) return
    cancelAnalysis()
    try {
      const info = await loadHistoricalPdf(id)
      setPdfInfo(info)
      setPdfFile(`/api/pdf/${info.id}/file`)
      setChatMessages([])
      setIsEditing(false)
      setIsHistorical(true)
      const savedNote = await loadNote(id)
      setNoteContent(savedNote || '')
    } catch (err) {
      alert('加载论文失败: ' + (err instanceof Error ? err.message : '未知错误'))
    }
  }, [pdfInfo?.id, cancelAnalysis])

  const doAnalyze = useCallback(async () => {
    if (!pdfInfo) return
    cancelAnalysis()

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsAnalyzing(true)
    setNoteContent('')
    setActiveTab('note')
    setIsHistorical(false)

    await startAnalyzeStream(
      pdfInfo.id,
      (content) => setNoteContent(prev => prev + content),
      () => {
        setIsAnalyzing(false)
        abortControllerRef.current = null
      },
      (err) => {
        setIsAnalyzing(false)
        abortControllerRef.current = null
        alert('分析出错: ' + err)
      },
      controller.signal
    )
  }, [pdfInfo, cancelAnalysis])

  // Auto-analyze after duplicate re-analyze action
  useEffect(() => {
    if (pendingAnalyzeRef.current && pdfInfo && pdfInfo.id === pendingAnalyzeRef.current) {
      pendingAnalyzeRef.current = null
      doAnalyze()
    }
  }, [pdfInfo, doAnalyze])

  const handleAnalyze = useCallback(() => {
    if (!pdfInfo) return
    if (isHistorical) {
      setConfirmDialog({ isOpen: true, action: 'analyze' })
      return
    }
    doAnalyze()
  }, [pdfInfo, isHistorical, doAnalyze])

  const handleTabChange = useCallback((tab: Tab) => {
    if (tab === 'chat' && isHistorical && chatMessages.length === 0) {
      setConfirmDialog({ isOpen: true, action: 'chat' })
      return
    }
    setActiveTab(tab)
  }, [isHistorical, chatMessages.length])

  const handleConfirmAction = useCallback(() => {
    setConfirmDialog({ isOpen: false, action: confirmDialog.action })
    setIsHistorical(false)
    if (confirmDialog.action === 'analyze') {
      doAnalyze()
    } else {
      setActiveTab('chat')
    }
  }, [confirmDialog.action, doAnalyze])

  const handleDuplicateAction = useCallback(async (action: 'open' | 'reanalyze' | 'cancel') => {
    const { existingId } = duplicateInfo
    setDuplicateInfo({ isOpen: false, existingId: '', existingTitle: '' })
    if (action === 'cancel') return
    if (action === 'reanalyze') {
      pendingAnalyzeRef.current = existingId
    }
    await handleSelectPaper(existingId)
  }, [duplicateInfo, handleSelectPaper])

  const handleEditToggle = useCallback(() => {
    setIsEditing(prev => !prev)
  }, [])

  const handleManualSave = useCallback(async () => {
    if (!pdfInfo || !noteContent.trim()) return
    try {
      await saveNote(pdfInfo.id, noteContent)
      handleSaveStatus(true)
    } catch {
      handleSaveStatus(false)
    }
  }, [pdfInfo, noteContent, handleSaveStatus])

  const hasNote = noteContent.trim().length > 0

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0">
        <h1 className="text-lg font-bold text-gray-800">文献阅读与解析</h1>
        <div className="flex-1" />
        {pdfInfo && (
          <>
            <span className="text-sm text-gray-500 max-w-xs truncate">{pdfInfo.filename}</span>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAnalyzing ? '分析中...' : 'AI 分析'}
            </button>
            {hasNote && !isAnalyzing && (
              <button
                onClick={handleEditToggle}
                className={`px-4 py-1.5 text-white text-sm rounded-lg transition-colors ${
                  isEditing
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isEditing ? '完成更改' : '更改笔记'}
              </button>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-green-600">已保存</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-red-500">保存失败</span>
            )}
            {(saveStatus === 'error' || (hasNote && !isAnalyzing)) && (
              <button
                onClick={handleManualSave}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
              >
                保存笔记
              </button>
            )}
          </>
        )}
        <FileUploader onUpload={handleUpload} />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          papers={paperList}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(prev => !prev)}
          onSelect={handleSelectPaper}
          currentPdfId={pdfInfo?.id || null}
        />

        {/* Left: PDF Viewer */}
        <div className="flex-1 border-r border-gray-200 flex flex-col bg-gray-100 min-w-0">
          {pdfFile ? (
            <PDFViewer file={pdfFile} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg className="mx-auto h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-lg">上传 PDF 文件开始阅读</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Note / Chat */}
        <div className="w-1/2 flex flex-col min-w-0">
          <TabSwitcher activeTab={activeTab} onTabChange={handleTabChange} />
          <div className="flex-1 overflow-hidden">
            <div style={{ display: activeTab === 'note' ? 'flex' : 'none' }} className="h-full flex-col">
              <NoteEditor
                content={noteContent}
                onChange={setNoteContent}
                isAnalyzing={isAnalyzing}
                isEditing={isEditing}
              />
            </div>
            <div style={{ display: activeTab === 'chat' ? 'flex' : 'none' }} className="h-full flex-col">
              <ChatPanel
                messages={chatMessages}
                onMessagesChange={setChatMessages}
                pdfText={pdfInfo?.text || ''}
                currentNote={noteContent}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.action === 'analyze' ? '重新分析论文' : '开始对话'}
        message={
          confirmDialog.action === 'analyze'
            ? '这是一篇历史论文，重新分析将使用论文全文内容。是否继续？'
            : '这是一篇历史论文，开始对话将加载论文内容到上下文中。是否继续？'
        }
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmDialog({ isOpen: false, action: confirmDialog.action })}
      />

      {/* Duplicate PDF Dialog */}
      <ConfirmDialog
        isOpen={duplicateInfo.isOpen}
        title="论文已存在"
        message={`"${duplicateInfo.existingTitle}" 已在论文目录中。你想做什么？`}
        actions={[
          { label: '取消', onClick: () => handleDuplicateAction('cancel'), variant: 'secondary' },
          { label: '重新 AI 分析', onClick: () => handleDuplicateAction('reanalyze'), variant: 'primary' },
          { label: '打开已有论文', onClick: () => handleDuplicateAction('open'), variant: 'primary' },
        ]}
      />
    </div>
  )
}
