const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. Add /api/scan-auto-edit-folder
const scanCode = `
app.post("/api/scan-auto-edit-folder", (req, res) => {
  try {
    const { inputDir } = req.body;
    if (!inputDir || !fs.existsSync(inputDir)) {
      return res.status(400).json({ error: "Thư mục không tồn tại." });
    }

    const files = fs.readdirSync(inputDir);
    const videoFiles = files.filter(f => f.match(/\\.(mp4|mkv|avi|mov)$/i)).sort();
    const srtFiles = files.filter(f => f.match(/\\.srt$/i)).sort();

    const pairs = [];
    const count = Math.min(videoFiles.length, srtFiles.length);

    for (let i = 0; i < count; i++) {
      pairs.push({
        id: i.toString(),
        video: videoFiles[i],
        srt: srtFiles[i],
        videoPath: require('path').join(inputDir, videoFiles[i]),
        srtPath: require('path').join(inputDir, srtFiles[i])
      });
    }

    res.json({ pairs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
`;

if (!code.includes('/api/scan-auto-edit-folder')) {
    code = code.replace('app.post("/api/bulk-auto-edit-capcut"', scanCode + '\napp.post("/api/bulk-auto-edit-capcut"');
}

// 2. Modify /api/bulk-auto-edit-capcut to take `pairs`
code = code.replace(
  /const \{ inputDir \} = req\.body;[\s\S]*?const count = Math\.min\(videoFiles\.length, srtFiles\.length\);[\s\S]*?for \(let i = 0; i < count; i\+\+\) \{[\s\S]*?const srtPath = require\('path'\)\.join\(inputDir, srtName\);/,
  `const { pairs } = req.body;

    if (!pairs || pairs.length === 0) {
      throw new Error("Không có cặp Video - SRT nào để xử lý.");
    }

    sendLog(\`🔍 Đang xử lý \${pairs.length} tập phim.\`);

    for (let i = 0; i < pairs.length; i++) {
      const { video: videoName, srt: srtName, videoPath, srtPath } = pairs[i];`
);

fs.writeFileSync('server.js', code, 'utf8');
