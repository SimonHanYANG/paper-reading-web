interface Action {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
}

interface Props {
  isOpen: boolean
  title: string
  message: string
  onConfirm?: () => void
  onCancel?: () => void
  actions?: Action[]
}

export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, actions }: Props) {
  if (!isOpen) return null

  const buttons = actions || [
    { label: '取消', onClick: onCancel || (() => {}), variant: 'secondary' as const },
    { label: '确认', onClick: onConfirm || (() => {}), variant: 'primary' as const },
  ]

  const variantClasses: Record<string, string> = {
    primary: 'text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors',
    secondary: 'text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors',
    danger: 'text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-5 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          {buttons.map((btn, i) => (
            <button
              key={i}
              onClick={btn.onClick}
              className={`px-4 py-1.5 text-sm ${variantClasses[btn.variant || 'secondary']}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
