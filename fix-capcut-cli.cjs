const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const startIdx = code.indexOf('const draftsDir =');
const endIdx = code.indexOf('sendLog(`✅ Xong tập ${videoName}`);');

if (startIdx !== -1 && endIdx !== -1) {
    const oldBulkBlock = code.substring(startIdx, endIdx);

    const newBulkBlock = `const capcutDraftsPath = path.join(process.env.LOCALAPPDATA || process.env.APPDATA, 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
        const baseProjectName = path.parse(videoName).name;
        let projectName = baseProjectName;
        let draftPath = path.join(capcutDraftsPath, projectName);
        let counter = 1;
        while (fs.existsSync(draftPath)) {
          projectName = \`\${baseProjectName}_\${counter}\`;
          draftPath = path.join(capcutDraftsPath, projectName);
          counter++;
        }
        
        sendLog(\`🎞️ Đang xử lý Draft: \${projectName}\`);
        
        // Tạo project mới bằng capcut-cli
        await execPromise(\`npx capcut-cli init "\${projectName}"\`);
        
        // Thêm video gốc vào (giới hạn thời lượng bằng finalDuration)
        const durationSec = Math.min(finalDuration, maxDuration);
        await execPromise(
          \`npx capcut-cli add-video "\${draftPath}" "\${videoPath}" 0 \${durationSec} --force-write\`
        );
        
        // Import phụ đề
        await execPromise(
          \`npx capcut-cli import-srt "\${draftPath}" "\${srtPath}" --force-write\`
        );
        
        `;

    code = code.replace(oldBulkBlock, newBulkBlock);
    fs.writeFileSync('server.js', code, 'utf8');
    console.log("Fixed successfully.");
} else {
    console.log("Could not find block to replace.");
}
