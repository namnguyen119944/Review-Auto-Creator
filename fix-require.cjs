const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(/require\("path"\)\.parse/g, 'path.parse');

fs.writeFileSync('server.js', code, 'utf8');
