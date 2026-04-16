import { useState, useRef } from 'react'

interface FileItem {
  name: string
  path: string
  ext: string
  text: string
}

interface SearchResult {
  name: string
  path: string
  ext: string
  matches: string[]
  preview: string
}

export default function App() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [status, setStatus] = useState('No folder selected')
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [activeFilters, setActiveFilters] = useState<string[]>(['.txt', '.docx', '.pdf', '.rtf'])
  const [darkMode, setDarkMode] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const isDragging = useRef(false)
  const dragStart = useRef(0)
  const dragStartWidth = useRef(0)

  const bg = darkMode ? '#1a1a1a' : '#f9fafb'
  const surface = darkMode ? '#2a2a2a' : '#ffffff'
  const border = darkMode ? '#3a3a3a' : '#e5e7eb'
  const text = darkMode ? '#e5e5e5' : '#111827'
  const muted = darkMode ? '#888' : '#6b7280'
  const inputBg = darkMode ? '#333' : '#ffffff'

  const fileIcon = (ext: string) => {
    if (ext === '.pdf') return '📄'
    if (ext === '.docx') return '📝'
    if (ext === '.rtf') return '📋'
    return '📃'
  }

  const handleSelectFolder = async () => {
    setLoading(true)
    setStatus('Scanning folder...')
    const result = await (window as any).electronAPI.selectFolder()
    setLoading(false)
    if (result.length === 0) {
      setStatus('No supported files found')
    } else {
      setFiles(result)
      setResults([])
      setSelectedFile(null)
      setStatus(`${result.length} file(s) loaded`)
    }
  }

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery ?? query
    if (!q.trim() || files.length === 0) return
    setSearching(true)
    setResults([])
    setSelectedFile(null)
    setShowHistory(false)

    const filteredFiles = files.filter(f => activeFilters.includes(f.ext))
    const found = await (window as any).electronAPI.searchFiles(filteredFiles, q, caseSensitive)
    setResults(found)
    setSearching(false)

    if (!searchHistory.includes(q)) {
      setSearchHistory(prev => [q, ...prev].slice(0, 10))
    }

    if (found.length === 0) {
      setStatus(`No matches for "${q}"`)
    } else {
      const total = found.reduce((sum: number, r: SearchResult) => sum + r.matches.length, 0)
      setStatus(`${found.length} file(s) · ${total} total matches`)
    }
  }

  const handleOpenFile = async (filePath: string) => {
    await (window as any).electronAPI.openFile(filePath)
  }

  const handleExport = async () => {
    if (results.length === 0) return
    let content = `Search Results for: "${query}"\n`
    content += `Date: ${new Date().toLocaleString()}\n`
    content += `${'='.repeat(50)}\n\n`
    for (const r of results) {
      content += `FILE: ${r.name}\n`
      content += `PATH: ${r.path}\n`
      content += `MATCHES: ${r.matches.length}\n`
      content += `${'-'.repeat(30)}\n`
      for (const m of r.matches) {
        content += `  ${m}\n`
      }
      content += '\n'
    }
    await (window as any).electronAPI.exportResults(content)
  }

  const toggleFilter = (ext: string) => {
    setActiveFilters(prev =>
      prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext]
    )
  }

  const highlight = (text: string, q: string) => {
    const flags = caseSensitive ? 'g' : 'gi'
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, flags))
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() || (caseSensitive && part === q)
        ? <mark key={i} style={{ background: '#fef08a', borderRadius: '2px', padding: '0 2px', color: '#713f12' }}>{part}</mark>
        : part
    )
  }

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    dragStart.current = e.clientX
    dragStartWidth.current = sidebarWidth
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return
    const delta = e.clientX - dragStart.current
    const newWidth = Math.min(400, Math.max(180, dragStartWidth.current + delta))
    setSidebarWidth(newWidth)
  }

  const onMouseUp = () => {
    isDragging.current = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  const allExts = ['.txt', '.docx', '.pdf', '.rtf']
  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0)

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', fontSize: '14px', background: bg, color: text }}>

      {/* Sidebar */}
      <div style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', background: darkMode ? '#222' : '#f9fafb', transition: 'background 0.2s' }}>

        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>File Search</span>
            <button
              onClick={() => setDarkMode(d => !d)}
              title="Toggle dark mode"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
            >{darkMode ? '☀️' : '🌙'}</button>
          </div>
          <button
            onClick={handleSelectFolder}
            disabled={loading}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${border}`, background: surface, cursor: 'pointer', fontSize: '13px', color: text }}
          >
            {loading ? '⏳ Scanning...' : '+ Select Folder'}
          </button>
        </div>

        {/* File type filters */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${border}` }}>
          <div style={{ fontSize: '11px', color: muted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>File types</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {allExts.map(ext => (
              <label key={ext} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', color: activeFilters.includes(ext) ? text : muted }}>
                <input
                  type="checkbox"
                  checked={activeFilters.includes(ext)}
                  onChange={() => toggleFilter(ext)}
                  style={{ cursor: 'pointer' }}
                />
                {ext}
              </label>
            ))}
          </div>
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading && (
            <div style={{ padding: '16px', textAlign: 'center', color: muted, fontSize: '12px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              Reading files...
            </div>
          )}
          {!loading && files.length === 0 && (
            <p style={{ color: muted, fontSize: '12px', padding: '8px' }}>No files loaded</p>
          )}
          {!loading && files.map(file => {
            const hasMatch = results.some(r => r.path === file.path)
            const isSelected = selectedFile?.path === file.path
            return (
              <div
                key={file.path}
                onClick={() => setSelectedFile(isSelected ? null : file)}
                title={file.path}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 10px', borderRadius: '6px', cursor: 'pointer',
                  background: isSelected ? (darkMode ? '#1e3a5f' : '#e0f2fe') : hasMatch ? (darkMode ? '#1a2e1a' : '#f0fdf4') : 'transparent',
                  marginBottom: '2px'
                }}
              >
                <span style={{ fontSize: '13px' }}>{fileIcon(file.ext)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: '12px', color: text }}>{file.name}</span>
                {hasMatch && <span style={{ background: '#bbf7d0', color: '#15803d', fontSize: '10px', padding: '1px 5px', borderRadius: '10px', flexShrink: 0 }}>✓</span>}
              </div>
            )
          })}
        </div>

        {/* Status bar */}
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${border}`, fontSize: '11px', color: muted }}>
          {status}
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        style={{ width: '4px', cursor: 'col-resize', background: 'transparent', flexShrink: 0 }}
        onMouseEnter={e => (e.currentTarget.style.background = '#3b82f6')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Search bar */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, background: surface, display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setShowHistory(true) }}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); if (e.key === 'Escape') setShowHistory(false) }}
              onFocus={() => setShowHistory(true)}
              placeholder="Search across all files..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${border}`, fontSize: '14px', background: inputBg, color: text, boxSizing: 'border-box' }}
            />
            {/* Search history dropdown */}
            {showHistory && searchHistory.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: surface, border: `1px solid ${border}`, borderRadius: '6px', marginTop: '4px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ padding: '6px 10px', fontSize: '11px', color: muted, borderBottom: `1px solid ${border}` }}>Recent searches</div>
                {searchHistory.map((h, i) => (
                  <div
                    key={i}
                    onClick={() => { setQuery(h); setShowHistory(false); handleSearch(h) }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', color: text }}
                    onMouseEnter={e => (e.currentTarget.style.background = darkMode ? '#333' : '#f3f4f6')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    🕐 {h}
                  </div>
                ))}
              </div>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: muted, whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} />
            Aa
          </label>

          <button
            onClick={() => handleSearch()}
            disabled={searching || files.length === 0}
            style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: searching ? '#93c5fd' : '#2563eb', color: 'white', cursor: searching ? 'not-allowed' : 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}
          >
            {searching ? '⏳ Searching...' : 'Search'}
          </button>

          {results.length > 0 && (
            <button
              onClick={handleExport}
              title="Export results to .txt"
              style={{ padding: '8px 14px', borderRadius: '6px', border: `1px solid ${border}`, background: surface, color: text, cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              Export
            </button>
          )}
        </div>

        {/* Results summary bar */}
        {results.length > 0 && (
          <div style={{ padding: '8px 16px', background: darkMode ? '#1a2e1a' : '#f0fdf4', borderBottom: `1px solid ${border}`, fontSize: '13px', color: darkMode ? '#86efac' : '#15803d', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✓</span>
            <span><strong>{results.length}</strong> file(s) matched</span>
            <span style={{ color: muted }}>·</span>
            <span><strong>{totalMatches}</strong> total occurrences</span>
          </div>
        )}

        {/* Content area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} onClick={() => setShowHistory(false)}>

          {/* File viewer */}
          {selectedFile && (
            <div style={{ marginBottom: '20px', background: surface, border: `1px solid ${border}`, borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span>{fileIcon(selectedFile.ext)}</span>
                <strong style={{ color: text }}>{selectedFile.name}</strong>
                <button
                  onClick={() => handleOpenFile(selectedFile.path)}
                  style={{ marginLeft: '8px', fontSize: '12px', padding: '3px 10px', borderRadius: '4px', border: `1px solid ${border}`, background: surface, color: '#2563eb', cursor: 'pointer' }}
                >
                  Open in app
                </button>
                <button onClick={() => setSelectedFile(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: '16px' }}>✕</button>
              </div>
              <pre style={{ fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', color: text, maxHeight: '300px', overflowY: 'auto', margin: 0 }}>
                {selectedFile.text || 'No text content'}
              </pre>
            </div>
          )}

          {/* Search results */}
          {results.map(result => (
            <div key={result.path} style={{ background: surface, border: `1px solid ${border}`, borderRadius: '8px', padding: '14px 16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span>{fileIcon(result.ext)}</span>
                <strong style={{ fontSize: '14px', color: text }}>{result.name}</strong>
                <span style={{ fontSize: '11px', color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{result.path}</span>
                <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', flexShrink: 0 }}>
                  {result.matches.length} match{result.matches.length > 1 ? 'es' : ''}
                </span>
              </div>

              {result.matches.slice(0, 3).map((line, i) => (
                <div key={i} style={{ fontSize: '12px', fontFamily: 'monospace', background: darkMode ? '#1a1a1a' : '#f9fafb', borderRadius: '4px', padding: '6px 10px', marginBottom: '4px', color: text, lineHeight: '1.6' }}>
                  {highlight(line, query)}
                </div>
              ))}

              {result.matches.length > 3 && (
                <p style={{ fontSize: '11px', color: muted, margin: '4px 0 8px' }}>
                  +{result.matches.length - 3} more occurrences
                </p>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={() => setSelectedFile(files.find(f => f.path === result.path) || null)}
                  style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  View full file →
                </button>
                <button
                  onClick={() => handleOpenFile(result.path)}
                  style={{ fontSize: '12px', color: muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Open in app →
                </button>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {results.length === 0 && !selectedFile && !searching && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', color: muted }}>
              <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>🔍</div>
              <p style={{ fontSize: '15px', fontWeight: 500, color: text }}>Load a folder and search</p>
              <p style={{ fontSize: '13px' }}>Supports .txt, .docx, .pdf and .rtf files</p>
              <p style={{ fontSize: '13px' }}>Scans all subfolders automatically</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}