import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  content: string
  onChange: (content: string) => void
  isAnalyzing: boolean
  isEditing: boolean
}

export default function NoteEditor({ content, onChange, isAnalyzing, isEditing }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isAnalyzing && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    }
  }, [content, isAnalyzing])

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-auto bg-white">
        {isAnalyzing && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm text-blue-600 flex items-center gap-2 sticky top-0 z-10">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            AI 正在分析论文并生成笔记...
          </div>
        )}

        {!content && !isAnalyzing && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p>点击 "AI 分析" 按钮生成笔记</p>
            </div>
          </div>
        )}

        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-full min-h-[calc(100%-8px)] p-4 text-sm leading-relaxed font-mono resize-none border-none outline-none bg-gray-50"
            placeholder="在此编辑 Markdown 笔记..."
          />
        ) : content ? (
          <div className="note-markdown p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        ) : null}
      </div>
    </div>
  )
}
