const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// ─── Prevent Electron's native error dialog from opening and hanging the app ─
// Route all unhandled main-process errors to the renderer's built-in error UI.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in main process:', err);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('main-process-error', {
      message: err.message || String(err),
      stack: err.stack || '',
    });
  }
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack   = reason instanceof Error ? (reason.stack || '') : '';
  console.error('Unhandled rejection in main process:', reason);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('main-process-error', { message, stack });
  }
});

// ─── Auto-updater configuration ────────────────────────────────────────────
autoUpdater.autoDownload = true;         // Download silently in background
autoUpdater.autoInstallOnAppQuit = true; // Auto-install when user quits normally

// Replace these with your actual GitHub username and repo name:
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'Aleem33',
  repo: 'gmh-pharmacy-pos',
});

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'), // secure IPC bridge
    },
    title: 'GMH Pharmacy POS',
    show: false,
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Check for updates 3 s after launch so the app is fully ready
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('Update check failed:', err.message);
      });
    }, 3000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Auto-updater events ────────────────────────────────────────────────────

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  mainWindow?.webContents.send('update-available', {
    version: info.version,
    releaseNotes: info.releaseNotes || '',
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Already up to date:', info.version);
  mainWindow?.webContents.send('update-not-available', { version: info.version });
});

autoUpdater.on('download-progress', (progress) => {
  const percent = Math.round(progress.percent);
  mainWindow?.webContents.send('download-progress', {
    percent,
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  mainWindow?.webContents.send('update-downloaded', {
    version: info.version,
    releaseNotes: info.releaseNotes || '',
  });
});

autoUpdater.on('error', (err) => {
  console.error('Updater error:', err.message);
  mainWindow?.webContents.send('update-error', { message: err.message });
});

// ─── IPC handlers ───────────────────────────────────────────────────────────

ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdates().catch((err) => {
    mainWindow?.webContents.send('update-error', { message: err.message });
  });
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

// ─── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
