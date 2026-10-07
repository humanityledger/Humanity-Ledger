const { app, BrowserWindow, shell, Menu, Tray, nativeImage, session } = require('electron');
const path = require('path');

// 🚀
// LEDGER CHAT DESKTOP - Native Wrapper
// Connects securely to the decentralized Ledger Chat infrastructure.
// 🚀

const APP_NAME    = 'Ledger Chat';
const APP_VERSION = '1.0.0';
// In production, we point to the live secure infrastructure.
// In dev, we can point to localhost:3000
const PROD_URL = 'https://humanidfi.com/chat';
const DEV_URL  = 'http://localhost:3000/chat';

let mainWindow = null;
let tray       = null;

// 🔒 Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// 🛡️ Security: Disable navigation to external origins
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('https://humanidfi.com') && !url.startsWith('http://localhost')) {
      event.preventDefault();
      shell.openExternal(url); // open external links in OS browser
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

// 💻 Create main browser window
function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width:           1280,
    height:          820,
    minWidth:        900,
    minHeight:       600,
    title:           APP_NAME,
    icon:            iconPath,
    backgroundColor: '#FAFAFA',
    titleBarStyle:   process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences:  {
      nodeIntegration:     false,
      contextIsolation:    true,
      sandbox:             true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  const isDev = !app.isPackaged;
  const url   = isDev ? DEV_URL : PROD_URL;
  
  mainWindow.loadURL(url).catch(err => {
    console.error('Failed to load Ledger Chat infrastructure:', err);
    // If offline, you could load a local "You are offline" HTML here
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  // Minimise-to-tray on close
  mainWindow.on('close', event => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// 🔔 System Tray
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let img;
  try {
    img = nativeImage.createFromPath(iconPath);
  } catch (e) {
    return; // Fallback if no tray icon
  }

  tray = new Tray(img.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: `${APP_NAME} v${APP_VERSION}`, enabled: false },
    { type:  'separator' },
    { label: 'Open Ledger Chat', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type:  'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setToolTip(APP_NAME);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// 🚀 App lifecycle
app.whenReady().then(() => {
  app.setName(APP_NAME);

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'X-Frame-Options': ['DENY'],
        'X-Content-Type-Options': ['nosniff'],
      },
    });
  });

  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep in tray
  }
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
  else mainWindow.show();
});

app.on('before-quit', () => { app.isQuitting = true; });
