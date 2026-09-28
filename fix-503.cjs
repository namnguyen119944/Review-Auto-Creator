const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const regex = /async function withRetryAndKeySwitch\([\s\S]*?throw error;\s*\/\/[^\n]*\n\s*\}\s*\}\s*\}/;

const newFunc = `async function withRetryAndKeySwitch(apiKeyManager, sendLog, operationFn) {
  let loopCount = 0;
  while (true) {
    let aiClient = apiKeyManager.getClient();
    try {
      return await operationFn(aiClient);
    } catch (error) {
      const errStr = error.message.toLowerCase();
      
      // Nếu lỗi 503 (Quá tải) -> Giữ nguyên key, đợi 60s rồi thử lại
      if (errStr.includes('503') || errStr.includes('unavailable') || errStr.includes('overloaded')) {
        sendLog('⚠️ Máy chủ Gemini đang quá tải (503). Hệ thống sẽ đợi 60 giây rồi tự động thử lại...');
        await new Promise((r) => setTimeout(r, 60000));
        continue;
      }

      // Nếu lỗi 429 (Hết Quota) -> Đổi key
      if (
        errStr.includes('429') ||
        errStr.includes('quota') ||
        errStr.includes('exhausted')
      ) {
        sendLog(
          \`⚠️ API Key số \${apiKeyManager.currentIndex + 1} đã hết Quota (429)...\`,
        );

        const isFullCycle = apiKeyManager.markExhausted();

        if (isFullCycle) {
          loopCount++;
          if (loopCount > 3 && apiKeyManager.keys.length === 1) {
            sendLog(
              \`❌ API Key duy nhất của bạn đã bị kiệt quệ hoàn toàn. Đang chờ 60s để hồi phục...\`,
            );
            await new Promise((r) => setTimeout(r, 60000));
          } else {
            sendLog(
              \`🔄 Đã xoay vòng hết danh sách Key. Đang chờ 30 giây trước khi thử lại từ Key số 1...\`,
            );
            await new Promise((r) => setTimeout(r, 30000));
          }
        } else {
          sendLog(
            \`👉 Tự động chuyển sang API Key số \${apiKeyManager.currentIndex + 1}...\`,
          );
        }
        continue;
      }

      // Nếu lỗi khác (không phải 429 hay 503) -> Ném lỗi ra ngoài
      throw error;
    }
  }
}`;

if(regex.test(code)) {
    code = code.replace(regex, newFunc);
    fs.writeFileSync('server.js', code, 'utf8');
    console.log('Successfully updated withRetryAndKeySwitch');
} else {
    console.log('Could not find the function to replace');
}
