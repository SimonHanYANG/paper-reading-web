import type { PaperListItem } from '../types'

interface Props {
  papers: PaperListItem[]
  isOpen: boolean
  onToggle: () => void
  onSelect: (id: string) => void
  currentPdfId: string | null
}

export default function Sidebar({ papers, isOpen, onToggle, onSelect, currentPdfId }: Props) {
  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div className="flex shrink-0 h-full">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="w-8 bg-gray-50 border-r border-gray-200 flex flex-col items-center justify-start pt-2 gap-1 hover:bg-gray-100 transition-colors shrink-0"
        title={isOpen ? '收起目录' : '展开目录'}
      >
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-[10px] text-gray-400 writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>
          {isOpen ? '收起' : '目录'}
        </span>
      </button>

      {/* Sidebar panel */}
      <div
        className={`bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-200 ${
          isOpen ? 'w-60' : 'w-0 border-r-0'
        }`}
      >
        <div className="px-3 py-2.5 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700">论文目录</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {papers.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400">
              暂无已上传的论文
            </div>
          ) : (
            papers.map(paper => (
              <button
                key={paper.id}
                onClick={() => onSelect(paper.id)}
                className={`w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-blue-50 transition-colors ${
                  currentPdfId === paper.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="text-sm text-gray-800 line-clamp-2 leading-snug">
                  {paper.title}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {formatDate(paper.uploadedAt)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
