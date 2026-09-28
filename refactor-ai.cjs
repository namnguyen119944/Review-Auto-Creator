const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const singleCode = fs.readFileSync('auto-edit.txt', 'utf8');

const logicStart = singleCode.indexOf('if (!videoPath || !fs.existsSync(videoPath))');
const logicEnd = singleCode.indexOf('res.write(\n      `data: ${JSON.stringify({ type: "success"');

let coreLogic = singleCode.substring(logicStart, logicEnd);

// Fix the project name logic to use videoNameOverride if available
coreLogic = coreLogic.replace(
  'const projectName = `Auto_Anime_${Date.now()}`;',
  'let baseName = videoNameOverride ? require("path").parse(videoNameOverride).name : `Auto_Anime_${Date.now()}`;\n    let projectName = baseName;\n    let draftPath = path.join(path.join(process.env.LOCALAPPDATA || process.env.APPDATA, "CapCut", "User Data", "Projects", "com.lveditor.draft"), projectName);\n    let counter = 1;\n    while(fs.existsSync(draftPath)) { projectName = `${baseName}_${counter}`; draftPath = path.join(path.join(process.env.LOCALAPPDATA || process.env.APPDATA, "CapCut", "User Data", "Projects", "com.lveditor.draft"), projectName); counter++; }\n'
);
// Remove the old absolute path logic since we moved it up
coreLogic = coreLogic.replace(
  /const capcutDraftsPath = path\.join\([\s\S]*?const draftPath = path\.join\(capcutDraftsPath, projectName\);/,
  ''
);

const wrappedFunction = `
async function processAutoEditEpisode(videoPath, srtPath, apiKeyManager, sendLog, videoNameOverride) {
  ${coreLogic}
  sendLog(\`🎉 Đã xuất thành công dự án CapCut: \${projectName}\`);
}
`;

const newBulkRoute = `
app.post("/api/bulk-auto-edit-capcut", async (req, res) => {
  req.setTimeout(86400000); // 24 hours
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sendLog = (msg) => res.write(\`data: \${JSON.stringify({ type: "log", message: msg })}\\n\\n\`);

  try {
    const { pairs } = req.body;
    if (!pairs || pairs.length === 0) throw new Error("Không có cặp Video - SRT nào để xử lý.");

    const apiKeyManager = new ApiKeyManager(); // Đọc từ api_keys.txt

    sendLog(\`🔍 Bắt đầu chạy hàng loạt \${pairs.length} tập phim (Lách bản quyền AI)...\`);

    for (let i = 0; i < pairs.length; i++) {
      const { video: videoName, srt: srtName, videoPath, srtPath } = pairs[i];
      sendLog(\`\\n▶️ BẮT ĐẦU TẬP \${i + 1}/\${pairs.length}: \${videoName}\`);
      try {
        await processAutoEditEpisode(videoPath, srtPath, apiKeyManager, sendLog, videoName);
      } catch (err) {
        sendLog(\`❌ Lỗi tập \${videoName}: \${err.message}\`);
      }
    }
    
    sendLog("\\n🎊 HOÀN TẤT CHẠY HÀNG LOẠT TẤT CẢ CÁC TẬP!");
    res.write(\`data: \${JSON.stringify({ type: "done", message: "Tất cả đã xử lý xong!" })}\\n\\n\`);
  } catch (error) {
    sendLog(\`❌ LỖI: \${error.message}\`);
    res.write(\`data: \${JSON.stringify({ type: "error", message: error.message })}\\n\\n\`);
  }
  res.end();
});
`;

const newSingleRoute = `
app.post("/api/auto-edit-capcut", async (req, res) => {
  req.setTimeout(1800000); // 30 mins
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sendLog = (msg) => res.write(\`data: \${JSON.stringify({ type: "log", message: msg })}\\n\\n\`);

  try {
    const { videoPath, srtPath, apiKey } = req.body;
    const apiKeyManager = new ApiKeyManager(apiKey);
    await processAutoEditEpisode(videoPath, srtPath, apiKeyManager, sendLog, "");
    res.write(\`data: \${JSON.stringify({ type: "success", data: "Tuyệt vời! Auto Edit đã đẩy sang CapCut thành công." })}\\n\\n\`);
  } catch (error) {
    sendLog(\`❌ LỖI: \${error.message}\`);
    res.write(\`data: \${JSON.stringify({ type: "error", message: error.message })}\\n\\n\`);
  }
  res.end();
});
`;

const startReplaceIdx = code.indexOf('app.post("/api/bulk-auto-edit-capcut"');
const endReplaceIdx = code.indexOf('const PORT = 3001;');

const finalCode = code.substring(0, startReplaceIdx) + wrappedFunction + newBulkRoute + newSingleRoute + '\n' + code.substring(endReplaceIdx);

fs.writeFileSync('server.js', finalCode, 'utf8');
