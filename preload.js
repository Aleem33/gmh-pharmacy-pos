const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auto-updater
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, err) => callback(err)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, progress) => callback(progress)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (_event, info) => callback(info)),

  installUpdate: () => ipcRenderer.send('install-update'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),

  // Main-process error (replaces Electron's native hang-prone error dialog)
  onMainError: (callback) => ipcRenderer.on('main-process-error', (_event, err) => callback(err)),

  // Cleanup listeners
  removeAllUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-error');
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('main-process-error');
  },
});
