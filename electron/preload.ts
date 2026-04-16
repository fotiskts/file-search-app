import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  searchFiles: (files: any[], query: string, caseSensitive: boolean) =>
    ipcRenderer.invoke('search-files', files, query, caseSensitive),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  exportResults: (content: string) => ipcRenderer.invoke('export-results', content),
})