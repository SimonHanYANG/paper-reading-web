type Tab = 'note' | 'chat'

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export default function TabSwitcher({ activeTab, onTabChange }: Props) {
  return (
    <div className="h-10 bg-white border-b border-gray-200 flex shrink-0">
      <button
        onClick={() => onTabChange('note')}
        className={`flex-1 text-sm font-medium transition-colors ${
          activeTab === 'note'
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        笔记
      </button>
      <button
        onClick={() => onTabChange('chat')}
        className={`flex-1 text-sm font-medium transition-colors ${
          activeTab === 'chat'
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        对话
      </button>
    </div>
  )
}
