const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { spawn, exec } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Comic Review Auto-Creator",
    backgroundColor: '#0f111a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the Vite build (Production mode)
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html')).catch(e => {
      console.log("Vite build not found, loading dev server instead...");
      mainWindow.loadURL('http://localhost:5173');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Bật logging để debug (nếu cần)
    
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Có bản cập nhật mới',
      message: 'Đã tìm thấy bản cập nhật mới. Đang tải xuống ngầm...',
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Tải xuống hoàn tất',
      message: 'Bản cập nhật đã được tải xuống. Ứng dụng sẽ khởi động lại để tự động cài đặt.',
      buttons: ['Khởi động lại ngay']
    }).then(() => {
      setImmediate(() => autoUpdater.quitAndInstall());
    });
  });

  // Start backend server silently in the background
  serverProcess = require('child_process').fork(path.join(__dirname, 'server.js'), [], {
      cwd: __dirname,
      stdio: 'ignore'
  });

  // Give backend 1 second to start
  setTimeout(createWindow, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up background processes when app exits
app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
    // Also kill any orphaned node processes just in case (force cleanup)
    exec('taskkill /f /im node.exe');
});
