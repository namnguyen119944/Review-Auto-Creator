const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const regexV = /const videoFiles = files\.filter\(f => f\.match\(\/\\\.\(mp4\|mkv\|avi\|mov\)\$\/i\)\)\.sort\(\);/;
const regexS = /const srtFiles = files\.filter\(f => f\.match\(\/\\\.srt\$\/i\)\)\.sort\(\);/;

code = code.replace(regexV, "const videoFiles = files.filter(f => f.match(/\\.(mp4|mkv|avi|mov)$/i)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));");
code = code.replace(regexS, "const srtFiles = files.filter(f => f.match(/\\.srt$/i)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));");

fs.writeFileSync('server.js', code, 'utf8');
