const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

let lines = content.split('\n');
let newLines = [];
let insideBrokenInput = false;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes('<input') && !line.includes('/>') && !line.includes('checkbox')) {
        let isBroken = false;
        for (let j = i; j < i + 35 && j < lines.length; j++) {
            if (lines[j].includes('></textarea>')) {
                isBroken = true;
                break;
            }
            if (lines[j].includes('/>')) {
                break;
            }
        }
        if (isBroken) {
            line = line.replace('<input', '<textarea');
        }
    }
    newLines.push(line);
}

fs.writeFileSync('src/App.jsx', newLines.join('\n'), 'utf8');
console.log("Fixed!");
