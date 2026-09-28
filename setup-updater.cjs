const fs = require('fs');
let code = fs.readFileSync('electron-main.cjs', 'utf8');

const autoUpdaterImport = "const { autoUpdater } = require('electron-updater');\n";
if (!code.includes('electron-updater')) {
    code = code.replace(/const path = require\('path'\);/, "const path = require('path');\n" + autoUpdaterImport);
}

// Add autoUpdater logic inside app.whenReady
const updaterLogic = `
  // Bật logging để debug (nếu cần)
  autoUpdater.logger = require('console');
  autoUpdater.logger.transports.file.level = 'info';

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
`;

if (!code.includes('checkForUpdatesAndNotify')) {
    code = code.replace(/app\.whenReady\(\)\.then\(\(\) => \{/, "app.whenReady().then(() => {\n" + updaterLogic);
}

fs.writeFileSync('electron-main.cjs', code, 'utf8');
console.log("Updated electron-main.cjs");
