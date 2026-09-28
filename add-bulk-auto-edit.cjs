const fs = require('fs');
const path = require('path');
let code = fs.readFileSync('server.js', 'utf8');

const bulkAutoEditCode = `
app.post("/api/bulk-auto-edit-capcut", async (req, res) => {
  req.setTimeout(86400000); // 24 hours
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sendLog = (msg) =>
    res.write(\`data: \${JSON.stringify({ type: "log", message: msg })}\\n\\n\`);

  try {
    const { inputDir } = req.body;

    if (!inputDir || !fs.existsSync(inputDir)) {
      throw new Error("Không tìm thấy thư mục đầu vào.");
    }

    const files = fs.readdirSync(inputDir);
    const videoFiles = files.filter(f => f.match(/\\.(mp4|mkv|avi|mov)$/i)).sort();
    const srtFiles = files.filter(f => f.match(/\\.srt$/i)).sort();

    if (videoFiles.length === 0) {
      throw new Error("Không tìm thấy video nào trong thư mục.");
    }
    if (srtFiles.length === 0) {
      throw new Error("Không tìm thấy file SRT nào trong thư mục.");
    }

    sendLog(\`🔍 Tìm thấy \${videoFiles.length} video và \${srtFiles.length} file SRT.\`);

    const count = Math.min(videoFiles.length, srtFiles.length);

    for (let i = 0; i < count; i++) {
      const videoName = videoFiles[i];
      const srtName = srtFiles[i];
      const videoPath = require('path').join(inputDir, videoName);
      const srtPath = require('path').join(inputDir, srtName);

      sendLog(\`\\n▶️ BẮT ĐẦU XỬ LÝ TẬP \${i + 1}/\${count}: \${videoName}\`);
      sendLog(\`📜 Phụ đề: \${srtName}\`);

      try {
        const srtContent = fs.readFileSync(srtPath, "utf8");
        const blocks = [];
        const regex = /(\\d+)\\n(\\d{2}:\\d{2}:\\d{2},\\d{3}) --> (\\d{2}:\\d{2}:\\d{2},\\d{3})\\n([\\s\\S]*?)(?=\\n\\n|\\n\\d+\\n\\d{2}:\\d{2}|$)/g;
        let match;
        while ((match = regex.exec(srtContent)) !== null) {
          const startParts = match[2].split(":");
          const endParts = match[3].split(":");
          const startSec = parseInt(startParts[0])*3600 + parseInt(startParts[1])*60 + parseFloat(startParts[2].replace(",", "."));
          const endSec = parseInt(endParts[0])*3600 + parseInt(endParts[1])*60 + parseFloat(endParts[2].replace(",", "."));
          blocks.push({ start: startSec, end: endSec, text: match[4].replace(/\\n/g, " ").trim() });
        }

        if (blocks.length === 0) throw new Error("SRT trống hoặc sai định dạng.");
        let finalDuration = blocks[blocks.length - 1].end + 2;

        const maxDuration = await getVideoDuration(videoPath);
        if (finalDuration > maxDuration) {
          sendLog(\`⚠️ Kịch bản (\${finalDuration.toFixed(1)}s) dài hơn video (\${maxDuration.toFixed(1)}s). Sẽ giới hạn trong video.\`);
          finalDuration = maxDuration;
        }

        const draftsDir = require('path').join(process.env.LOCALAPPDATA || process.env.APPDATA, 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
        const baseProjectName = require('path').parse(videoName).name;
        let projectName = baseProjectName;
        let projectPath = require('path').join(draftsDir, projectName);
        let counter = 1;
        while (fs.existsSync(projectPath)) {
          projectName = \`\${baseProjectName}_\${counter}\`;
          projectPath = require('path').join(draftsDir, projectName);
          counter++;
        }
        
        fs.mkdirSync(projectPath, { recursive: true });
        
        sendLog(\`🎞️ Đang xử lý Draft: \${projectName}\`);

        const capcut = new CapcutDraft({
          draft_materials: [],
          draft_name: projectName,
          draft_root_path: projectPath
        });

        // Add main video
        const videoDuration = Math.min(finalDuration * 1000000, maxDuration * 1000000);
        const mainVideoParams = {
            media_path: videoPath,
            duration: videoDuration,
            type: 'video',
            volume: 0
        };

        capcut.add_media_to_track({
            track_index: 0,
            media_params: mainVideoParams,
            target_timerange: { start: 0, duration: videoDuration },
            source_timerange: { start: 0, duration: videoDuration }
        });

        const srtTrackIndex = 2; // Track 0 is video, 1 is text usually
        let currentPos = 0;
        
        blocks.forEach(block => {
            if (block.start >= finalDuration) return;
            const blockEnd = Math.min(block.end, finalDuration);
            const dur = Math.max((blockEnd - block.start) * 1000000, 100000);
            
            capcut.add_media_to_track({
                track_index: srtTrackIndex,
                media_params: {
                    type: 'text',
                    text: block.text,
                    style_name: 'Subtitle',
                    font_path: 'C:/Windows/Fonts/arial.ttf'
                },
                target_timerange: { start: currentPos, duration: dur }
            });
            currentPos += dur;
        });

        fs.writeFileSync(require('path').join(projectPath, 'draft_content.json'), JSON.stringify(capcut.get_draft_content(), null, 2));
        fs.writeFileSync(require('path').join(projectPath, 'draft_meta_info.json'), JSON.stringify(capcut.get_draft_meta(), null, 2));

        sendLog(\`✅ Xong tập \${videoName}\`);
      } catch (err) {
        sendLog(\`❌ Lỗi tập \${videoName}: \${err.message}\`);
      }
    }

    sendLog("\\n🎉 HOÀN TẤT CHẠY HÀNG LOẠT!");
    res.write(\`data: \${JSON.stringify({ type: "done", message: "Tất cả đã xử lý xong!" })}\\n\\n\`);
  } catch (error) {
    res.write(\`data: \${JSON.stringify({ type: "error", message: error.message })}\\n\\n\`);
  } finally {
    res.end();
  }
});
`;

if (!code.includes('/api/bulk-auto-edit-capcut')) {
    code = code.replace('app.post("/api/auto-edit-capcut"', bulkAutoEditCode + '\n\napp.post("/api/auto-edit-capcut"');
    fs.writeFileSync('server.js', code, 'utf8');
    console.log("Injected API");
} else {
    console.log("Already injected");
}
