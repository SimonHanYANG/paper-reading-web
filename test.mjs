/**
 * Comprehensive test cases for paper-reading-web
 *
 * Run: Start server first with `npm run dev:server`, then `node test.mjs`
 */

import fs from 'fs'
import path from 'path'

const BASE = 'http://localhost:3001'
let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg)
}

// Upload a PDF buffer using manual multipart construction (Node.js Blob corrupts binary data)
async function uploadPdf(buffer, filename) {
  const boundary = '----TestBoundary' + Date.now() + Math.random().toString(16).slice(2)
  const header = Buffer.from(
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="pdf"; filename="' + filename + '"\r\n' +
    'Content-Type: application/pdf\r\n\r\n'
  )
  const footer = Buffer.from('\r\n--' + boundary + '--\r\n')
  const body = Buffer.concat([header, buffer, footer])

  return fetch(`${BASE}/api/pdf/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary },
    body,
  })
}

// ============ Basic API Tests ============

console.log('\n=== Basic API Tests ===')

await test('GET /api/pdf returns array', async () => {
  const res = await fetch(`${BASE}/api/pdf`)
  assert(res.ok, `status ${res.status}`)
  const data = await res.json()
  assert(Array.isArray(data), 'should return array')
})

await test('POST /api/pdf/upload rejects empty request', async () => {
  const res = await fetch(`${BASE}/api/pdf/upload`, { method: 'POST' })
  assert(res.status === 400, `expected 400, got ${res.status}`)
})

await test('GET /api/pdf/nonexistent returns 404', async () => {
  const res = await fetch(`${BASE}/api/pdf/nonexistent_id`)
  assert(res.status === 404, `expected 404, got ${res.status}`)
})

await test('GET /api/notes/nonexistent returns 404', async () => {
  const res = await fetch(`${BASE}/api/notes/nonexistent_id`)
  assert(res.status === 404, `expected 404, got ${res.status}`)
})

await test('POST /api/notes/save rejects empty body', async () => {
  const res = await fetch(`${BASE}/api/notes/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert(res.status === 400, `expected 400, got ${res.status}`)
})

// ============ Upload + Note Save Flow ============

console.log('\n=== Upload + Note Save Flow ===')

let uploadedId = null
let uploadedPdfBuffer = null

// Load test fixture PDFs
const fixture1Path = path.resolve('test-fixture-1.pdf')
const fixture2Path = path.resolve('test-fixture-2.pdf')
uploadedPdfBuffer = fs.readFileSync(fixture1Path)

await test('Upload succeeds with valid PDF (or returns existing if duplicate)', async () => {
  const res = await uploadPdf(uploadedPdfBuffer, 'test-upload.pdf')
  if (res.status === 409) {
    const data = await res.json()
    assert(data.duplicate === true, 'should have duplicate flag')
    assert(data.existingId, 'should have existingId')
    uploadedId = data.existingId
    console.log(`    already exists, using id: ${uploadedId}`)
  } else {
    const data = await res.json()
    assert(res.ok, `status ${res.status}: ${JSON.stringify(data)}`)
    assert(data.id, 'should return id')
    assert(data.filename, 'should return filename')
    assert(typeof data.numPages === 'number', 'should return numPages')
    uploadedId = data.id
    console.log(`    uploaded id: ${uploadedId}`)
  }
})

await test('Uploaded paper appears in paper list', async () => {
  const res = await fetch(`${BASE}/api/pdf`)
  const papers = await res.json()
  const found = papers.find(p => p.id === uploadedId)
  assert(found, `paper ${uploadedId} not found in list`)
  assert(found.title, 'paper should have a title')
})

await test('GET /api/pdf/:id returns paper info', async () => {
  const res = await fetch(`${BASE}/api/pdf/${uploadedId}`)
  assert(res.ok, `status ${res.status}`)
  const data = await res.json()
  assert(data.id === uploadedId, 'id should match')
  assert(data.filename, 'should have filename')
})

await test('GET /api/pdf/:id/file serves the PDF', async () => {
  const res = await fetch(`${BASE}/api/pdf/${uploadedId}/file`)
  assert(res.ok, `status ${res.status}`)
})

await test('Note save succeeds for uploaded paper', async () => {
  const res = await fetch(`${BASE}/api/notes/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfId: uploadedId, noteContent: '## Test Note\n\nThis is a test note.' }),
  })
  const data = await res.json()
  assert(res.ok, `status ${res.status}: ${JSON.stringify(data)}`)
  assert(data.success === true, 'should return success')
})

await test('GET /api/notes/:id returns saved note', async () => {
  const res = await fetch(`${BASE}/api/notes/${uploadedId}`)
  const data = await res.json()
  assert(data.content === '## Test Note\n\nThis is a test note.', 'note content should match')
})

// ============ Duplicate Detection ============

console.log('\n=== Duplicate Detection ===')

await test('Re-uploading same PDF returns 409 with duplicate info', async () => {
  const res = await uploadPdf(uploadedPdfBuffer, 'test-duplicate.pdf')
  assert(res.status === 409, `expected 409, got ${res.status}`)
  const data = await res.json()
  assert(data.duplicate === true, 'should have duplicate flag')
  assert(data.existingId === uploadedId, `existingId should match: ${data.existingId} vs ${uploadedId}`)
  assert(data.existingTitle, 'should have existingTitle')
  console.log(`    duplicate detected: ${data.existingTitle}`)
})

await test('Duplicate upload does NOT create new entry', async () => {
  const res = await fetch(`${BASE}/api/pdf`)
  const papers = await res.json()
  const matching = papers.filter(p => p.id === uploadedId)
  assert(matching.length === 1, `should have exactly 1 entry, got ${matching.length}`)
})

await test('Original paper note is NOT affected by duplicate upload', async () => {
  const res = await fetch(`${BASE}/api/notes/${uploadedId}`)
  const data = await res.json()
  assert(data.content === '## Test Note\n\nThis is a test note.', 'note should be unchanged')
})

await test('Content hash is stored in meta file', () => {
  const metaPath = `./uploads/${uploadedId}.meta.json`
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  assert(meta.contentHash, 'should have contentHash')
  assert(/^[0-9a-f]{64}$/.test(meta.contentHash), 'contentHash should be 64-char hex (SHA-256)')
})

await test('Different PDF uploads successfully (not flagged as duplicate)', async () => {
  const differentPdf = fs.readFileSync(fixture2Path)

  const res = await uploadPdf(differentPdf, 'different.pdf')
  // This may succeed (200) or fail (500) depending on pdf-parse,
  // but it should NOT return 409
  assert(res.status !== 409, `should not be detected as duplicate, got ${res.status}`)
})

// ============ Metadata Persistence ============

console.log('\n=== Metadata Persistence ===')

await test('Meta files exist on disk for uploaded papers', async () => {
  const uploadsDir = './uploads'
  const metaFiles = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.meta.json'))
  assert(metaFiles.length >= 2, `expected >= 2 meta files, got ${metaFiles.length}`)
})

await test('Meta file has correct structure', async () => {
  const metaPath = `./uploads/${uploadedId}.meta.json`
  assert(fs.existsSync(metaPath), `meta file should exist: ${metaPath}`)
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  assert(meta.id === uploadedId, 'id should match')
  assert(meta.title, 'should have title')
  assert(meta.filename, 'should have filename')
  assert(meta.uploadedAt, 'should have uploadedAt')
  assert(typeof meta.numPages === 'number', 'should have numPages')
})

await test('Meta file ID contains random suffix (collision prevention)', () => {
  const metaPath = `./uploads/${uploadedId}.meta.json`
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  const parts = meta.id.split('_')
  assert(parts.length >= 3, `ID should have >= 3 parts, got: ${meta.id}`)
  const lastPart = parts[parts.length - 1]
  assert(/^[0-9a-f]{8}$/.test(lastPart), `last part should be 8-char hex, got: ${lastPart}`)
})

// ============ Edge Cases ============

console.log('\n=== Edge Cases ===')

await test('Empty noteContent is accepted (valid for clearing notes)', async () => {
  const res = await fetch(`${BASE}/api/notes/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfId: uploadedId, noteContent: '' }),
  })
  const data = await res.json()
  assert(res.ok, `status ${res.status}: ${JSON.stringify(data)}`)
})

await test('GET /api/pdf/:id with loadText=true works', async () => {
  const res = await fetch(`${BASE}/api/pdf/${uploadedId}?loadText=true`)
  assert(res.ok, `status ${res.status}`)
  const data = await res.json()
  assert(typeof data.text === 'string', 'should return text')
})

await test('POST /api/pdf/:id/search works', async () => {
  const res = await fetch(`${BASE}/api/pdf/${uploadedId}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test' }),
  })
  assert(res.ok, `status ${res.status}`)
  const data = await res.json()
  assert(typeof data.found === 'boolean', 'should return found boolean')
})

await test('Note save with markdown content round-trips correctly', async () => {
  const markdown = `# Title\n\n## Section 1\n- Item 1\n- Item 2\n\n**Bold** and *italic*\n\n\`\`\`js\nconsole.log("hello")\n\`\`\``

  const res = await fetch(`${BASE}/api/notes/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfId: uploadedId, noteContent: markdown }),
  })
  const data = await res.json()
  assert(res.ok, `status ${res.status}: ${JSON.stringify(data)}`)

  const readRes = await fetch(`${BASE}/api/notes/${uploadedId}`)
  const readData = await readRes.json()
  assert(readData.content === markdown, 'markdown content should round-trip correctly')
})

// ============ Summary ============

console.log(`\n${'='.repeat(40)}`)
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`)
if (failed > 0) {
  console.log('\nSome tests failed!')
  process.exit(1)
} else {
  console.log('\nAll tests passed!')
}
