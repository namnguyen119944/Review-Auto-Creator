const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. Extract Download Logic
const downloadRegex = /app\.post\('\/api\/download', async \(req, res\) => \{([\s\S]*?)(?=app\.get\('\/api\/choose-file')/;
const downloadMatch = code.match(downloadRegex);
if(!downloadMatch) { console.log('Download not found'); process.exit(1); }

let downloadCore = downloadMatch[0];
downloadCore = downloadCore.replace(/app\.post\('\/api\/download', async \(req, res\) => \{/, 'async function downloadChapter(url, outputDir, sendLog) {');
downloadCore = downloadCore.replace(/const { url, outputDir } = req\.body;/, '');
downloadCore = downloadCore.replace(/res\.writeHead\([\s\S]*?\}\);/, '');
downloadCore = downloadCore.replace(/const sendLog = [\s\S]*?};\n/, '');
downloadCore = downloadCore.replace(/res\.write\(`data: \$\{JSON\.stringify\(\{ type: 'error', message: '(.*?)' \}\)\}\\n\\n`\);\n\s*return res\.end\(\);/g, 'throw new Error("$1");');
downloadCore = downloadCore.replace(/res\.write\(`data: \$\{JSON\.stringify\(\{ type: 'success', data: `(Đã tải xong.*?)` \}\)\}\\n\\n`\);\n\s*res\.end\(\);/g, 'return `$1`;');
downloadCore = downloadCore.replace(/res\.end\(\);/g, '');
downloadCore = downloadCore.replace(/res\.write\(`data: \$\{JSON\.stringify\(\{ type: 'error', message: error\.message \}\)\}\\n\\n`\);/, 'throw error;');
// Fix the last catch block in download (and remove the app.post closing tag)
downloadCore = downloadCore.replace(/} catch \(error\) {[\s\S]*?throw error;\n\s*}\n\}\);/m, '} catch (error) {\n    if (context) await context.close();\n    throw error;\n  }\n}');

// 2. Extract Generate Logic
const generateRegex = /app\.post\('\/api\/generate-from-folder', async \(req, res\) => \{([\s\S]*?)(?=const PORT = 3001;)/;
const generateMatch = code.match(generateRegex);
if(!generateMatch) { console.log('Generate not found'); process.exit(1); }

let generateCore = generateMatch[0];
generateCore = generateCore.replace(/app\.post\('\/api\/generate-from-folder', async \(req, res\) => \{/, 'async function generateScript(folderPath, loreFilePath, scriptName, sendLog) {');
generateCore = generateCore.replace(/res\.setHeader[\s\S]*?keep-alive';/, '');
generateCore = generateCore.replace(/const { folderPath, loreFilePath, scriptName } = req\.body;/, '');
generateCore = generateCore.replace(/const sendLog = [\s\S]*?};\n/, '');
generateCore = generateCore.replace(/res\.write\(`data: \$\{JSON\.stringify\(\{ type: 'error', message: '(.*?)' \}\)\}\\n\\n`\);\n\s*return res\.end\(\);/g, 'throw new Error("$1");');
generateCore = generateCore.replace(/res\.write\(`data: \$\{JSON\.stringify\(\{ type: 'success', data: finalRes\.text \}\)\}\\n\\n`\);\n\s*res\.end\(\);/, 'return finalRes.text;');
generateCore = generateCore.replace(/res\.end\(\);/g, '');
generateCore = generateCore.replace(/res\.write\(`data: \$\{JSON\.stringify\(\{ type: 'error', message: error\.message \}\)\}\\n\\n`\);/, 'throw error;');
// Fix the last catch block in generate (and remove the app.post closing tag)
generateCore = generateCore.replace(/} catch \(error\) {[\s\S]*?throw error;\n\s*}\n\}\);/m, '} catch (error) {\n    throw error;\n  }\n}');

// Now write the new server.js
let newCode = code.replace(downloadRegex, 
  downloadCore + '\n\n' + 
  'app.post(\'/api/download\', async (req, res) => {\n' +
  '  res.writeHead(200, { \'Content-Type\': \'text/event-stream\', \'Cache-Control\': \'no-cache\', \'Connection\': \'keep-alive\' });\n' +
  '  const sendLog = (msg) => res.write(`data: ${JSON.stringify({ type: \'log\', message: msg })}\\n\\n`);\n' +
  '  try {\n' +
  '    const { url, outputDir } = req.body;\n' +
  '    const result = await downloadChapter(url, outputDir, sendLog);\n' +
  '    res.write(`data: ${JSON.stringify({ type: \'success\', data: result })}\\n\\n`);\n' +
  '  } catch (error) {\n' +
  '    res.write(`data: ${JSON.stringify({ type: \'error\', message: error.message })}\\n\\n`);\n' +
  '  }\n' +
  '  res.end();\n' +
  '});\n\n'
);

newCode = newCode.replace(generateRegex, 
  generateCore + '\n\n' + 
  'app.post(\'/api/generate-from-folder\', async (req, res) => {\n' +
  '  res.writeHead(200, { \'Content-Type\': \'text/event-stream\', \'Cache-Control\': \'no-cache\', \'Connection\': \'keep-alive\' });\n' +
  '  const sendLog = (msg) => res.write(`data: ${JSON.stringify({ type: \'log\', message: msg })}\\n\\n`);\n' +
  '  try {\n' +
  '    const { folderPath, loreFilePath, scriptName } = req.body;\n' +
  '    const result = await generateScript(folderPath, loreFilePath, scriptName, sendLog);\n' +
  '    res.write(`data: ${JSON.stringify({ type: \'success\', data: result })}\\n\\n`);\n' +
  '  } catch (error) {\n' +
  '    res.write(`data: ${JSON.stringify({ type: \'error\', message: error.message })}\\n\\n`);\n' +
  '  }\n' +
  '  res.end();\n' +
  '});\n\n'
);

// Add the bulk-process endpoint
const bulkEndpoint = `
app.post('/api/bulk-process', async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  const sendLog = (msg) => res.write(\`data: \${JSON.stringify({ type: 'log', message: msg })}\\n\\n\`);
  
  try {
    const { urlText, outputDir, loreFilePath } = req.body;
    
    if (!urlText || !outputDir) {
      throw new Error('Vui lòng cung cấp danh sách URL và thư mục lưu.');
    }
    
    const lines = urlText.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
    sendLog(\`🚀 BẮT ĐẦU CHẠY AUTO HÀNG LOẠT (\${lines.length} CHAPTER) 🚀\`);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let url = line;
        let chapName = '';
        
        if (line.includes('|')) {
            const parts = line.split('|');
            url = parts[0].trim();
            chapName = parts[1].trim();
        } else {
            // Tự trích xuất tên chap từ URL (ví dụ: chapter-1)
            const urlParts = url.split('/');
            chapName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || \`Chap_\${i+1}\`;
        }
        
        // Tạo tên thư mục hợp lệ
        chapName = chapName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const chapFolder = path.join(outputDir, chapName);
        if (!fs.existsSync(chapFolder)) {
            fs.mkdirSync(chapFolder, { recursive: true });
        }
        
        sendLog(\`\\n========================================\`);
        sendLog(\`➡️ ĐANG XỬ LÝ: [\${i+1}/\${lines.length}] \${chapName} (\${url})\`);
        
        try {
            // 1. Tải ảnh
            await downloadChapter(url, chapFolder, sendLog);
            
            // 2. Viết kịch bản
            const scriptFileName = \`Kich_Ban_\${chapName}.txt\`;
            await generateScript(chapFolder, loreFilePath, scriptFileName, sendLog);
            
            sendLog(\`✅ HOÀN THÀNH: \${chapName}\`);
        } catch (chapErr) {
            sendLog(\`❌ LỖI TẠI \${chapName}: \${chapErr.message}\`);
            sendLog(\`⏭️ Sẽ tự động bỏ qua và chạy tiếp Chap sau...\`);
        }
    }
    
    sendLog(\`\\n========================================\`);
    sendLog(\`🏆 ĐÃ XỬ LÝ XONG TOÀN BỘ \${lines.length} CHAPTER!\`);
    res.write(\`data: \${JSON.stringify({ type: 'success', data: 'Hoàn tất chạy tự động toàn bộ.' })}\\n\\n\`);
  } catch (error) {
    res.write(\`data: \${JSON.stringify({ type: 'error', message: error.message })}\\n\\n\`);
  }
  res.end();
});
`;

newCode = newCode.replace(/const PORT = 3001;/, bulkEndpoint + '\nconst PORT = 3001;');
fs.writeFileSync('server.js', newCode);
console.log('Refactoring done.');
