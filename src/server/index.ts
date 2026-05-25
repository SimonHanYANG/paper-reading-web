import 'dotenv/config'
import { execSync } from 'child_process'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import pdfRouter from './routes/pdf.js'
import analyzeRouter from './routes/analyze.js'
import chatRouter from './routes/chat.js'
import notesRouter from './routes/notes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// API routes
app.use('/api/pdf', pdfRouter)
app.use('/api', analyzeRouter)
app.use('/api', chatRouter)
app.use('/api/notes', notesRouter)

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')))

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../dist/client')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

function killPortProcess(port: number) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}.*LISTENING`, { encoding: 'utf-8' })
    const pid = output.trim().split(/\s+/).pop()
    if (pid && pid !== '0') {
      execSync(`taskkill /F /PID ${pid}`)
      console.log(`Killed stale process ${pid} on port ${port}`)
    }
  } catch {
    // No process on port, nothing to do
  }
}

function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} in use, attempting to free it...`)
      killPortProcess(Number(PORT))
      setTimeout(() => startServer(), 500)
    } else {
      throw err
    }
  })
}

startServer()
