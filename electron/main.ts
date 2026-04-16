import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Extract text from a file based on its extension
async function extractText(filePath: string, ext: string): Promise<string> {
  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf-8')
  }
  if (ext === '.docx') {
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  }
  if (ext === '.pdf') {
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.js')
    const data = new Uint8Array(fs.readFileSync(filePath))
    const doc = await pdfjs.getDocument({ data }).promise
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((item: any) => item.str).join(' ') + '\n'
    }
    return text
  }
  if (ext === '.rtf') {
    const rtfContent = fs.readFileSync(filePath, 'utf-8')
    const text = rtfContent
      .replace(/\{\*?\\[^{}]+}|[{}]|\\[A-Za-z]+\d* ?/g, '')
      .replace(/\\\n/g, '\n')
      .trim()
    return text
  }
  return ''
}

// Recursively scan a folder for supported files — feature 1
function scanFolder(folderPath: string, supportedExtensions: string[]): { name: string; path: string; ext: string }[] {
  const found: { name: string; path: string; ext: string }[] = []
  const entries = fs.readdirSync(folderPath)
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      found.push(...scanFolder(fullPath, supportedExtensions))
    } else {
      const ext = path.extname(entry).toLowerCase()
      if (supportedExtensions.includes(ext)) {
        found.push({ name: entry, path: fullPath, ext })
      }
    }
  }
  return found
}

// Handle folder selection
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled) return []

  const folderPath = result.filePaths[0]
  const supportedExtensions = ['.txt', '.docx', '.pdf', '.rtf']
  const fileList = scanFolder(folderPath, supportedExtensions)

  const files: { name: string; path: string; ext: string; text: string }[] = []
  for (const file of fileList) {
    const text = await extractText(file.path, file.ext)
    files.push({ ...file, text })
  }

  return files
})

// Handle search — feature 2 (case sensitive)
ipcMain.handle('search-files', async (_event, files: any[], query: string, caseSensitive: boolean) => {
  if (!query.trim()) return []

  const needle = caseSensitive ? query : query.toLowerCase()
  const results: { name: string; path: string; ext: string; matches: string[]; preview: string }[] = []

  for (const file of files) {
    const haystack = caseSensitive ? file.text : file.text.toLowerCase()
    if (!haystack.includes(needle)) continue

    const matches: string[] = []
    let searchFrom = 0

    while (true) {
      const index = haystack.indexOf(needle, searchFrom)
      if (index === -1) break
      const contextStart = Math.max(0, index - 100)
      const contextEnd = Math.min(file.text.length, index + needle.length + 100)
      let context = file.text.slice(contextStart, contextEnd).replace(/\n/g, ' ').trim()
      if (contextStart > 0) context = '...' + context
      if (contextEnd < file.text.length) context = context + '...'
      matches.push(context)
      searchFrom = index + needle.length
    }

    results.push({ name: file.name, path: file.path, ext: file.ext, matches, preview: file.text.slice(0, 300) })
  }

  return results
})

// Open file in default app (Word, Acrobat etc.) — feature 3
ipcMain.handle('open-file', async (_event, filePath: string) => {
  await shell.openPath(filePath)
})

// Export results to a .txt file — feature 4
ipcMain.handle('export-results', async (_event, content: string) => {
  const result = await dialog.showSaveDialog({
    title: 'Export Search Results',
    defaultPath: 'search-results.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  })
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf-8')
    return true
  }
  return false
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(createWindow)