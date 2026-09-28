const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');
content = content.replace(/<input([\s\S]*?type="text"[\s\S]*?)\/>/g, '<textarea$1 rows="2" style={{ resize: "vertical", minHeight: "45px", wordBreak: "break-all" }}></textarea>');
fs.writeFileSync('src/App.jsx', content, 'utf8');
console.log("Done");
