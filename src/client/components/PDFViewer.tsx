import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  file: string
}

export default function PDFViewer({ file }: Props) {
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.2)

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="h-10 bg-white border-b border-gray-200 flex items-center px-3 gap-2 shrink-0">
        <span className="text-sm text-gray-600">
          共 {numPages || '-'} 页
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
          className="px-2 py-0.5 text-sm bg-gray-100 rounded hover:bg-gray-200"
        >
          −
        </button>
        <span className="text-sm text-gray-600 min-w-[40px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(s => Math.min(3, s + 0.2))}
          className="px-2 py-0.5 text-sm bg-gray-100 rounded hover:bg-gray-200"
        >
          +
        </button>
      </div>

      {/* PDF Content - Continuous scroll */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(err) => console.error('PDF load error:', err)}
          loading={
            <div className="flex items-center justify-center h-64 text-gray-400">
              加载中...
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => (
            <div key={i + 1} className="mb-4">
              <div className="text-center text-xs text-gray-400 mb-1">
                第 {i + 1} 页
              </div>
              <Page
                pageNumber={i + 1}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  )
}
