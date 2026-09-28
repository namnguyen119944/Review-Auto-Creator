const fs = require('fs');
let code = fs.readFileSync('electron-main.cjs', 'utf8');

code = code.replace(
  "serverProcess = spawn('node', ['server.js'], { \n      cwd: __dirname,\n      stdio: 'ignore' // Hide logs from console\n  });",
  "serverProcess = require('child_process').fork(path.join(__dirname, 'server.js'), [], {\n      cwd: __dirname,\n      stdio: 'ignore'\n  });"
);

fs.writeFileSync('electron-main.cjs', code, 'utf8');
