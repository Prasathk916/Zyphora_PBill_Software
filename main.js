const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      // Point to preload script for secure IPC communication
      preload: path.join(__dirname, 'preload.js'),
      // Crucial security settings
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the index.html of the app.
  mainWindow.loadFile('index.html');
}

// This method is called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  // On macOS it's common to re-create a window in the app when the dock icon is clicked
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
