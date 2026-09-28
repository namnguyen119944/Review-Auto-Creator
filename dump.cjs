const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const startIdx = code.indexOf('app.post("/api/auto-edit-capcut"');
const block = code.substring(startIdx);
fs.writeFileSync('auto-edit.txt', block);
