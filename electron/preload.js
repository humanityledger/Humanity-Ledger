// Electron Preload — runs in the renderer with full Node access
// Exposes only a minimal, safe API to the web page via contextBridge.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App metadata
  getVersion:  () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),

  // Flag so the web app knows it's running inside Electron
  isElectron: true,
});
