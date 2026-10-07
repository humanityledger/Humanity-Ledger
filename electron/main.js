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

  // 🔑 Inject Electron identifier into User-Agent so the server can detect this is a desktop app
  mainWindow.webContents.setUserAgent(
    `${mainWindow.webContents.getUserAgent()} LedgerChatDesktop/1.0.0 Electron/${process.versions.electron}`
  );

  mainWindow.setMenuBarVisibility(false);

  const isDev = !app.isPackaged;
  // Always start at /connect so the QR code is shown for login.
  // The middleware will redirect to /chat automatically once a valid session is detected.
  const CONNECT_URL = isDev ? 'http://localhost:3000/connect' : 'https://humanidfi.com/connect';
  
  mainWindow.loadURL(CONNECT_URL).catch(err => {
    console.error('Failed to load Ledger Chat:', err);
    // Offline fallback — show a simple HTML page
    mainWindow.loadURL('data:text/html,<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#FAFAFA"><div style="text-align:center"><h2 style="font-weight:700">No Internet Connection</h2><p style="color:#888">Check your connection and restart Ledger Chat.</p></div></body></html>');
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  // 🔄 After QR login, /connect redirects to /chat — let it through naturally.
  // But if user manually navigates away from humanidfi.com, block it (security).


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
