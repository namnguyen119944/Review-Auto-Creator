import express from "express";
import cors from "cors";
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import axios from "axios";
import { exec } from "child_process";
import util from "util";
import { GoogleGenAI } from "@google/genai";

const execPromise = util.promisify(exec);

const getVideoDuration = async (videoPath) => {
  try {
    const res = await execPromise(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    const durStr = res.stdout ? res.stdout : res;
    if (durStr && parseFloat(durStr) > 0) {
      return parseFloat(durStr);
    }
  } catch (err) {
    console.error('ffprobe error:', err);
  }
  return 10000;
};

const app = express();
app.use(cors());
app.use(express.json());

// CAUTION: Replace with your actual API key
const GEMINI_API_KEY = "sk-tknq9BYKDgSKWKBkchPm8oZxgZZwYBKUA1NvVbU5JSNB9qRE";

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  ...(GEMINI_API_KEY.startsWith("sk-") ? { httpOptions: { baseUrl: "https://api.yescale.io" } } : {})
});

class ApiKeyManager {
  constructor(keysStr) {
    this.keys = [];

    // Ưu tiên đọc từ file api_keys.txt nếu có
    const apiKeysFilePath = path.join(process.cwd(), "api_keys.txt");
    if (fs.existsSync(apiKeysFilePath)) {
      const fileContent = fs.readFileSync(apiKeysFilePath, "utf8");
      // Tách bằng dấu phẩy hoặc xuống dòng
      const fileKeys = fileContent
        .split(/[\r\n,]+/)
        .map((k) => k.trim())
        .filter((k) => k);
      if (fileKeys.length > 0) {
        this.keys = fileKeys;
      }
    }

    // Nếu trong file không có, đọc từ giao diện (keysStr)
    if (this.keys.length === 0 && keysStr) {
      this.keys = keysStr
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k);
    }

    // Nếu vẫn không có, dùng KEY mặc định trong code
    if (this.keys.length === 0 && GEMINI_API_KEY) {
      this.keys.push(GEMINI_API_KEY);
    }
    this.currentIndex = 0;
  }
  getCurrentKey() {
    return this.keys[this.currentIndex];
  }
  getClient() {
    const key = this.getCurrentKey();
    return new GoogleGenAI({
      apiKey: key,
      ...(key && key.startsWith("sk-") ? { httpOptions: { baseUrl: "https://api.yescale.io" } } : {})
    });
  }
  markExhausted() {
    this.currentIndex++;
    if (this.currentIndex >= this.keys.length) {
      this.currentIndex = 0; // Quay vòng lại từ đầu
      return true; // Báo hiệu là đã hết một vòng
    }
    return false; // Vẫn đang trong vòng lặp hiện tại
  }
}

async function withRetryAndKeySwitch(apiKeyManager, sendLog, operationFn) {
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
          `⚠️ API Key số ${apiKeyManager.currentIndex + 1} đã hết Quota (429)...`,
        );

        const isFullCycle = apiKeyManager.markExhausted();

        if (isFullCycle) {
          loopCount++;
          if (loopCount > 3 && apiKeyManager.keys.length === 1) {
            sendLog(
              `❌ API Key duy nhất của bạn đã bị kiệt quệ hoàn toàn. Đang chờ 60s để hồi phục...`,
            );
            await new Promise((r) => setTimeout(r, 60000));
          } else {
            sendLog(
              `🔄 Đã xoay vòng hết danh sách Key. Đang chờ 30 giây trước khi thử lại từ Key số 1...`,
            );
            await new Promise((r) => setTimeout(r, 30000));
          }
        } else {
          sendLog(
            `👉 Tự động chuyển sang API Key số ${apiKeyManager.currentIndex + 1}...`,
          );
        }
        continue;
      }

      // Nếu lỗi khác (không phải 429 hay 503) -> Ném lỗi ra ngoài
      throw error;
    }
  }
}

const CACHE_FILE = path.join(process.cwd(), "gemini_file_cache.json");
async function uploadAndCacheVideo(aiClient, videoPath, sendLog) {
  let cache = {};
  try {
    if (fs.existsSync(CACHE_FILE)) {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    }
  } catch (e) {}

  let finalCheckFile = null;
  if (cache[videoPath]) {
    try {
      sendLog(
        `🔍 Tìm thấy video đã từng tải lên. Đang kiểm tra trạng thái trên Google Cache...`,
      );
      finalCheckFile = await aiClient.files.get({
        name: cache[videoPath].name,
      });
      if (finalCheckFile.state === "ACTIVE") {
        sendLog(
          `✅ File đã sẵn sàng trên Google, DÙNG LUÔN, KHÔNG CẦN TẢI LẠI!`,
        );
        return finalCheckFile;
      } else if (finalCheckFile.state === "PROCESSING") {
        sendLog(
          `⏳ File đang được Google xử lý từ lần tải trước. Sẽ tiếp tục đợi...`,
        );
      } else {
        finalCheckFile = null;
      }
    } catch (e) {
      sendLog(
        `⚠️ File cũ trên Google đã hết hạn, bắt đầu tải lên lại từ đầu...`,
      );
      finalCheckFile = null;
    }
  }

  if (!finalCheckFile) {
    sendLog(
      `🎬 Đang upload Video lên Google Server để phân tích... (Tốc độ phụ thuộc dung lượng file)`,
    );
    const uploadResult = await aiClient.files.upload({
      file: videoPath,
      config: { mimeType: "video/mp4" },
    });

    sendLog(
      `⏳ Đã upload xong. Chờ Google xử lý video (ID: ${uploadResult.name})...`,
    );
    let isReady = false;
    while (!isReady) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      finalCheckFile = await aiClient.files.get({ name: uploadResult.name });
      sendLog(`🔄 Trạng thái xử lý video: ${finalCheckFile.state}...`);
      if (finalCheckFile.state === "ACTIVE") isReady = true;
      else if (finalCheckFile.state === "FAILED")
        throw new Error("Google không thể phân tích video này.");
    }

    cache[videoPath] = {
      name: finalCheckFile.name,
      uri: finalCheckFile.uri,
      mimeType: finalCheckFile.mimeType,
    };
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (e) {}
  }

  return finalCheckFile;
}

app.get("/api/choose-folder", async (req, res) => {
  try {
    const tempFile = path.join(process.cwd(), "temp_path.txt");
    const psCommand = `
      Add-Type -AssemblyName System.windows.forms;
      $owner = New-Object System.Windows.Forms.Form;
      $owner.TopMost = $true;
      $owner.ShowInTaskbar = $false;
      $owner.WindowState = 'Minimized';
      $f = New-Object System.Windows.Forms.FolderBrowserDialog;
      $f.Description = 'Chọn thư mục để lưu ảnh truyện';
      if ($f.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
          [IO.File]::WriteAllText('${tempFile.replace(/\\/g, "\\\\")}', $f.SelectedPath, [System.Text.Encoding]::UTF8)
      } else {
          [IO.File]::WriteAllText('${tempFile.replace(/\\/g, "\\\\")}', '', [System.Text.Encoding]::UTF8)
      }
    `;

    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    await execPromise(
      `powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`,
    );

    if (fs.existsSync(tempFile)) {
      const selectedPath = fs.readFileSync(tempFile, "utf8").trim();
      fs.unlinkSync(tempFile);
      res.json({ path: selectedPath });
    } else {
      res.json({ path: "" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Không thể mở hộp thoại chọn thư mục." });
  }
});

async function downloadChapter(url, outputDir, sendLog) {
  if (!url) {
    throw new Error("Vui lòng cung cấp URL");
  }
  if (!outputDir || !fs.existsSync(outputDir)) {
    throw new Error("Thư mục không tồn tại. Vui lòng chọn lại thư mục.");
  }

  let context;
  try {
    sendLog(`📁 Ảnh sẽ được lưu tại: ${outputDir}`);

    // TẠO MỘT PROFILE ĐỘC LẬP CHO TOOL ĐỂ KHÔNG XUNG ĐỘT VỚI CHROME CỦA NGƯỜI DÙNG
    const toolProfileDir = path.join(process.cwd(), "tool_profile");
    if (!fs.existsSync(toolProfileDir)) {
      fs.mkdirSync(toolProfileDir, { recursive: true });
    }

    sendLog(`🌐 Đang mở trình duyệt Chrome siêu ẩn danh (Độc lập 100%)...`);

    try {
      context = await chromium.launchPersistentContext(toolProfileDir, {
        headless: false,
        channel: "chrome", // Dùng Chrome thật
        ignoreDefaultArgs: ["--enable-automation"], // XÓA cờ Automation để lừa Google
        args: [
          "--disable-blink-features=AutomationControlled", // Vượt rào chống Bot của Google
          "--disable-web-security",
          "--window-position=0,0",
        ],
        // KHÔNG override userAgent vì làm lệch vân tay trình duyệt (Cloudflare sẽ chặn)
      });
      sendLog(
        `✅ Bạn hoàn toàn có thể vừa chạy Tool, vừa lướt Chrome cá nhân làm việc khác bình thường!`,
      );
    } catch (e) {
      throw e;
    }

    let page;
    const pages = context.pages();
    if (pages.length > 0) {
      const normalPage = pages.find(
        (p) => !p.url().startsWith("chrome-extension://"),
      );
      page = normalPage || (await context.newPage());
    } else {
      page = await context.newPage();
    }

    // BẮT MỌI REQUEST ẢNH TỪ NETWORK (Bypass 100% lỗi onerror làm mất URL trong DOM)
    const networkImgUrls = new Set();
    page.on("request", (request) => {
      if (request.resourceType() === "image") {
        const reqUrl = request.url();
        if (reqUrl.startsWith("http")) {
          const lower = reqUrl.toLowerCase();
          if (
            !lower.includes("logo") &&
            !lower.includes("icon") &&
            !lower.includes("avatar") &&
            !lower.includes("banner") &&
            !lower.includes("qc")
          ) {
            networkImgUrls.add(reqUrl);
          }
        }
      }
    });

    // Tàng hình thêm để vượt Cloudflare Turnstile của truyenqq
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      window.chrome = { runtime: {} };
    });

    await page.bringToFront();

    sendLog(`⏳ Đang tải trang web truyện...`);

    await page
      .goto(url, { waitUntil: "domcontentloaded", timeout: 60000 })
      .catch((e) => {
        sendLog(`⚠️ Cảnh báo tải trang: ${e.message}`);
      });

    sendLog("⏳ Đang chờ 10 giây để trang web tải toàn bộ nội dung...");
    await page.waitForTimeout(10000);
    const title = await page.title();
    sendLog(`📑 Tiêu đề trang hiện tại: ${title}`);

    if (
      title.toLowerCase().includes("login") ||
      title.toLowerCase().includes("đăng nhập") ||
      title.toLowerCase().includes("about:blank")
    ) {
      sendLog(
        `🚨 CHÚ Ý: Vì đây là môi trường hoàn toàn mới, trang web yêu cầu bạn ĐĂNG NHẬP LẦN ĐẦU TIÊN.`,
      );
      sendLog(
        `💡 Tool sẽ tạm dừng 60 GIÂY. Bạn hãy cứ đăng nhập bằng Gmail bình thường (Tool đã tắt cờ Bot nên Google sẽ không chặn nữa).`,
      );
      sendLog(
        `⚠️ Từ những lần sau, Tool sẽ tự nhớ tài khoản của bạn, không cần đăng nhập lại!`,
      );
      await page.waitForTimeout(60000);
    }

    sendLog("📜 Đang cuộn trang để kích hoạt thuật toán Lazy-load ẩn ảnh...");
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(500);
    }

    sendLog(
      "⏳ Đang chờ thêm 10 giây để chắc chắn TẤT CẢ ảnh đã tải xong hoàn toàn...",
    );
    await page.waitForTimeout(10000);

    // CHỈ SỬ DỤNG DOM ĐỂ ĐẢM BẢO CHÍNH XÁC SỐ LƯỢNG ẢNH THEO HTML
    const selectorsToTry = [
      ".page-chapter img",
      ".reading-detail img",
      ".box_doc img",
      "#chapter-content img",
      ".story-see-content img",
      "img",
    ];
    let imageElements = [];

    for (const sel of selectorsToTry) {
      const els = await page.$$(sel);
      if (els.length > 3) {
        imageElements = els;
        sendLog(
          `✅ Đã trích xuất chính xác ${els.length} khung ảnh từ mã nguồn HTML (chỉ định).`,
        );
        break;
      }
    }

    const imgUrls = [];
    const domainCounts = {};
    for (const img of imageElements) {
      const src = await img.getAttribute("src");
      const dataSrc = await img.getAttribute("data-src");
      const dataOriginal = await img.getAttribute("data-original");
      const realSrc = dataOriginal || dataSrc || src;

      if (realSrc) {
        if (realSrc.startsWith("http")) {
          const lowerSrc = realSrc.toLowerCase();
          if (
            !lowerSrc.includes("logo") &&
            !lowerSrc.includes("icon") &&
            !lowerSrc.includes("avatar")
          ) {
            imgUrls.push(realSrc);
            try {
              const hostname = new URL(realSrc).hostname;
              domainCounts[hostname] = (domainCounts[hostname] || 0) + 1;
            } catch (e) {}
          }
        } else if (realSrc.startsWith("data:image")) {
          imgUrls.push(realSrc);
        }
      }
    }

    let mainDomain = "";
    let maxCount = 0;
    for (const [domain, count] of Object.entries(domainCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mainDomain = domain;
      }
    }

    let filteredUrls = [];
    for (const url of imgUrls) {
      if (url.startsWith("data:image")) {
        filteredUrls.push(url);
      } else {
        try {
          if (new URL(url).hostname === mainDomain) {
            filteredUrls.push(url);
          }
        } catch (e) {}
      }
    }

    let urlsArray = filteredUrls;
    if (urlsArray.length === 0) {
      sendLog(
        `❌ Không tìm thấy ảnh nào. Trang web chặn bot, yêu cầu đăng nhập, hoặc sai cấu trúc.`,
      );
      await context.close();
      throw new Error("Không tải được ảnh nào.");
    }

    sendLog(`📸 Bắt đầu tải ${urlsArray.length} ảnh truyện về máy...`);

    const cookies = await context.cookies();
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    await context.close();

    const downloadedFiles = [];
    const failedImages = [];

    for (let i = 0; i < urlsArray.length; i++) {
      const imgUrl = urlsArray[i];
      let success = false;
      let lastError = "";

      if (imgUrl.startsWith("data:image")) {
        try {
          // Phân tích cú pháp chuỗi base64
          const matches = imgUrl.match(
            /^data:image\/([a-zA-Z0-9]+);base64,(.+)$/,
          );
          if (matches && matches.length === 3) {
            let ext = `.${matches[1]}`;
            if (ext === ".jpeg") ext = ".jpg";
            const base64Data = matches[2];
            const filePath = path.join(outputDir, `${i + 1}${ext}`);
            fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
            downloadedFiles.push(filePath);
            success = true;
            sendLog(
              `✅ Tải thành công ảnh ${i + 1} (Dạng ảnh mã hóa Base64 ẩn trong web)`,
            );
          } else {
            lastError = "Chuỗi base64 không hợp lệ hoặc không đúng định dạng";
          }
        } catch (e) {
          lastError = e.message;
        }
      } else {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const response = await axios.get(imgUrl, {
              responseType: "arraybuffer",
              timeout: 15000, // 15 seconds timeout
              headers: {
                Referer: url,
                Cookie: cookieString,
              },
            });
            let ext = ".jpg";
            if (imgUrl.toLowerCase().includes(".png")) ext = ".png";
            else if (imgUrl.toLowerCase().includes(".webp")) ext = ".webp";

            const filePath = path.join(outputDir, `${i + 1}${ext}`);
            fs.writeFileSync(filePath, response.data);
            downloadedFiles.push(filePath);
            success = true;
            break; // Thoát vòng lặp thử lại nếu thành công
          } catch (e) {
            lastError = e.message;
            if (attempt < 3) {
              sendLog(
                `⚠️ Lỗi tải ảnh ${i + 1} (Thử lại lần ${attempt}/3): Đang kết nối lại...`,
              );
              await new Promise((resolve) => setTimeout(resolve, 2000)); // Đợi 2s trước khi thử lại
            }
          }
        }
      }

      if (!success) {
        failedImages.push(i + 1);
        sendLog(`❌ BỎ QUA ảnh ${i + 1} sau 3 lần thử thất bại: ${lastError}`);
      }
    }

    if (failedImages.length > 0) {
      sendLog(
        `🚨 CẢNH BÁO: Quá trình tải thiếu ${failedImages.length} ảnh (Số thứ tự: ${failedImages.join(", ")}). Nguyên nhân do server truyện chặn hoặc đứt cáp.`,
      );
      sendLog(
        `👉 LỜI KHUYÊN: Bạn có thể tự tải tay ảnh bị thiếu và chép đè vào thư mục với đúng số thứ tự đó.`,
      );
    }

    sendLog(
      `🎉 ĐÃ HOÀN TẤT TẢI ${downloadedFiles.length}/${urlsArray.length} ẢNH VÀO THƯ MỤC!`,
    );
    return `Đã tải xong ${downloadedFiles.length}/${urlsArray.length} ảnh vào ${outputDir}`;
  } catch (error) {
    if (context) await context.close();
    throw error;
  }
}

// TỰ ĐỘNG SẮP XẾP SỐ TỰ NHIÊN CHO TÊN FILE (1.jpg, 2.jpg... 10.jpg)
const naturalCompare = (a, b) => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
};

// API ĐỂ MỞ HỘP THOẠI CHỌN FILE (CHO TÓM TẮT NHÂN VẬT)

app.post("/api/download", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sendLog = (msg) =>
    res.write(`data: ${JSON.stringify({ type: "log", message: msg })}\n\n`);
  try {
    let { url, outputDir } = req.body;

    // Xử lý trường hợp sếp dán nhầm cú pháp chạy tự động (URL | Tên) vào ô chạy đơn
    if (url && url.includes("|")) {
      url = url.split("|")[0].trim();
    }

    const result = await downloadChapter(url, outputDir, sendLog);
    res.write(`data: ${JSON.stringify({ type: "success", data: result })}\n\n`);
  } catch (error) {
    res.write(
      `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`,
    );
  }
  res.end();
});

app.get("/api/choose-file", async (req, res) => {
  try {
    const tempOut = path.join(process.cwd(), "temp_file_out.txt");
    const psCommand = `
      Add-Type -AssemblyName System.windows.forms;
      $owner = New-Object System.Windows.Forms.Form;
      $owner.TopMost = $true;
      $owner.ShowInTaskbar = $false;
      $owner.WindowState = 'Minimized';
      $f = New-Object System.Windows.Forms.OpenFileDialog;
      $f.Filter = 'Text files (*.txt)|*.txt|All files (*.*)|*.*';
      $f.Title = 'Chon file Tom tat nhan vat';
      if ($f.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
          [IO.File]::WriteAllText('${tempOut.replace(/\\/g, "\\\\")}', $f.FileName, [System.Text.Encoding]::UTF8)
      } else {
          [IO.File]::WriteAllText('${tempOut.replace(/\\/g, "\\\\")}', '', [System.Text.Encoding]::UTF8)
      }
    `;

    if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
    await execPromise(
      `powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`,
    );

    let selectedPath = "";
    if (fs.existsSync(tempOut)) {
      selectedPath = fs.readFileSync(tempOut, "utf8").trim();
      // Xóa ký tự BOM nếu có
      if (selectedPath.charCodeAt(0) === 0xfeff) {
        selectedPath = selectedPath.slice(1);
      }
      fs.unlinkSync(tempOut);
    }

    res.json({ path: selectedPath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to open file dialog" });
  }
});

// API VIẾT KỊCH BẢN TỪ THƯ MỤC BẰNG QUY TRÌNH 2 BƯỚC (TWO-STEP)
async function generateScript(
  folderPath,
  loreFilePath,
  scriptName,
  sendLog,
  customChunkSize = 4,
  apiKeyManager,
) {
  const {
    folderPath: _f,
    loreFilePath: _l,
    scriptName: _s,
  } = { folderPath, loreFilePath, scriptName }; // dummy to avoid unused vars if any

  if (!folderPath || !fs.existsSync(folderPath)) {
    throw new Error("Thư mục không tồn tại. Vui lòng kiểm tra lại.");
  }

  try {
    sendLog(`📂 Đang quét thư mục: ${folderPath}`);

    let currentLore = "";
    let finalLorePath = path.join(folderPath, "Tom_Tat_Nhan_Vat.txt");

    if (loreFilePath && fs.existsSync(loreFilePath)) {
      currentLore = fs.readFileSync(loreFilePath, "utf8");
      finalLorePath = loreFilePath; // Ghi đè lại file gốc
      sendLog(`📝 Đã tải Bách khoa toàn thư nhân vật từ file sếp chọn!`);
    } else {
      sendLog(
        `📜 Không có file nhân vật. AI sẽ tự động tạo file "Tom_Tat_Nhan_Vat.txt" cho Chap này.`,
      );
    }

    // Đọc tất cả file trong thư mục
    const files = fs.readdirSync(folderPath);

    // Lọc ra các file ảnh (jpg, png, webp...)
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    });

    if (imageFiles.length === 0) {
      throw new Error("Không tìm thấy ảnh nào trong thư mục này.");
    }

    // Sắp xếp ảnh theo số thứ tự tên file một cách tự nhiên (VD: 1.jpg -> 2.jpg -> 10.jpg)
    imageFiles.sort(naturalCompare);

    sendLog(
      `📸 Đã tìm thấy ${imageFiles.length} ảnh. Bắt đầu quy trình "Cao Thủ"...`,
    );

    // BƯỚC 1: TRÍCH XUẤT NỘI DUNG (CHIA NHỎ ĐỂ TRÁNH LỖI OVERLOAD / BODY TOO LARGE)
    const chunkSize = parseInt(customChunkSize, 10) || 4;
    const summaries = [];
    let previousSummary = ""; // Kỹ thuật Rolling Context (Nhớ dữ liệu)

    sendLog(`🧠 BƯỚC 1: Đang trích xuất dữ liệu chi tiết từng khung hình...`);

    for (let i = 0; i < imageFiles.length; i += chunkSize) {
      const chunkFiles = imageFiles.slice(i, i + chunkSize);
      sendLog(
        `  🔍 Đang soi nhóm ảnh từ ${i + 1} đến ${i + chunkFiles.length} / ${imageFiles.length}...`,
      );

      const uploadedFiles = [];
      for (const file of chunkFiles) {
        const filePath = path.join(folderPath, file);
        const mimeType = file.toLowerCase().endsWith(".png")
          ? "image/png"
          : file.toLowerCase().endsWith(".webp")
            ? "image/webp"
            : "image/jpeg";
        const fileData = fs.readFileSync(filePath).toString("base64");
        uploadedFiles.push({
          inlineData: {
            data: fileData,
            mimeType: mimeType,
          },
        });
      }

      let extractPrompt = `Đây là phần ${Math.floor(i / chunkSize) + 1} của một chapter truyện tranh (Webtoon). 
LƯU Ý QUAN TRỌNG VỀ ẢNH: Một bức ảnh Webtoon là một dải dài CHỨA RẤT NHIỀU "KHUNG TRANH" (Panels) nhỏ bên trong. Hệ thống cắt ngang thành nhiều ảnh rời rạc nên một khung tranh hoặc bóng thoại có thể bị cắt làm đôi (nửa ở ảnh này, nửa ở ảnh kia). Hãy tự động ĐỌC GHÉP NỐI chúng cho hoàn chỉnh.`;

      if (currentLore) {
        extractPrompt += `\n\nBÁCH KHOA TOÀN THƯ NHÂN VẬT TỪ TÁC GIẢ: ${currentLore}\n(Hãy đối chiếu đặc điểm ngoại hình trong ảnh với danh sách trên để gọi ĐÚNG TÊN nhân vật thay vì miêu tả chung chung).`;
      }

      extractPrompt += `\n\nNhiệm vụ của bạn KHÔNG PHẢI là viết kịch bản review. Bạn chỉ đóng vai trò là 'Người ghi chép'. 
YÊU CẦU BẮT BUỘC KHI TRÍCH XUẤT:
- Phải bóc tách và miêu tả LẦN LƯỢT TỪNG "KHUNG TRANH" (Panel) xuất hiện từ trên xuống dưới trong các bức ảnh.
- BỎ QUA hoàn toàn các ảnh bìa truyện. Đối với những khung tranh trống (chỉ có nền trắng/đen và CHỮ DẪN TRUYỆN), TUYỆT ĐỐI KHÔNG miêu tả cảnh vật (CẤM ghi "dòng chữ xuất hiện trên nền trắng"...), mà CHỈ CẦN CHÉP LẠI NGUYÊN VĂN chữ dẫn truyện đó.
- NHẬN DIỆN CHI TIẾT BẰNG SUY LUẬN (RẤT QUAN TRỌNG): Trước khi ghi chép hành động, BẮT BUỘC phải viết ra một thẻ [Nhận diện: ...] chứa BẰNG CHỨNG CỤ THỂ để tự suy luận xem nhân vật đó là ai. Trong thẻ này, phải miêu tả CẶN KẼ ngoại hình hiện tại (màu/kiểu tóc, màu sắc/kiểu dáng quần áo, vũ khí, hoặc manh mối từ bóng thoại) rồi mới đối chiếu với Bách Khoa Toàn Thư để kết luận tên. TUYỆT ĐỐI KHÔNG đoán bừa hay ghi sơ sài. VD: "[Nhận diện: Nam, tóc đỏ vuốt ngược, nay đã đổi sang mặc giáp đen vảy rồng, người kia gọi tên là Yohan -> Đây là Kim Yohan] Kim Yohan vung gươm chém tới". Việc miêu tả cặn kẽ quần áo/vóc dáng ở bước này là dữ liệu cốt lõi để Cập nhật Bách Khoa Toàn Thư cho các chap sau.
- Về Xưng hô: Nếu đã nhận diện được tên nhân vật, HÃY GỌI BẰNG TÊN hoặc xưng là "cậu", "anh", "hắn". Chỉ dùng "chàng trai/cô gái" cho nhân vật quần chúng không có trong Bách Khoa Toàn Thư.
- Tuyệt đối KHÔNG ĐƯỢC gộp chung nhiều khung tranh vào một câu miêu tả. Mỗi khung tranh/hành động phải tách riêng biệt. 
- Trích xuất ĐẦY ĐỦ các đoạn hội thoại đi kèm đúng với từng khung tranh đó. Khung tranh nào không thoại cũng phải miêu tả.
- Phần miêu tả hành động/cảnh vật phải viết thật NGẮN GỌN, SÚC TÍCH, đi thẳng vào trọng tâm, không miêu tả dài dòng.`;

      if (previousSummary) {
        extractPrompt += `\n\nLƯU Ý LIÊN KẾT: Dưới đây là tóm tắt của phần trước. Hãy đọc để NẮM BẮT ĐÚNG TÊN NHÂN VẬT, tránh việc gọi sai tên hoặc mô tả chung chung (như 'chàng trai', 'cô gái') nếu nhân vật đó đã xuất hiện ở phần trước:\n---TÓM TẮT PHẦN TRƯỚC---\n${previousSummary}`;
      }

      const extractAI = async (aiClient) => {
        return await aiClient.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [extractPrompt, ...uploadedFiles],
        });
      };
      const generateRes = await withRetryAndKeySwitch(
        apiKeyManager,
        sendLog,
        extractAI,
      );

      previousSummary = generateRes.text; // Lưu lại để truyền cho phần sau
      summaries.push(
        `--- PHẦN ${Math.floor(i / chunkSize) + 1} ---\n${generateRes.text}`,
      );
    }

    const fullSummaryText = summaries.join("\n\n");

    // Lưu bản tóm tắt thô Bước 1 ra file để người dùng kiểm tra
    const summaryFilePath = path.join(folderPath, "Tom_Tat_Buoc_1.txt");
    fs.writeFileSync(summaryFilePath, fullSummaryText, "utf8");
    sendLog(`✅ Đã lưu bản nháp vào file "Tom_Tat_Buoc_1.txt".`);

    // BƯỚC 1.5: CẬP NHẬT TỪ ĐIỂN NHÂN VẬT
    sendLog(`🧠 BƯỚC 1.5: AI đang tự động học và cập nhật Từ Điển Nhân Vật...`);
    const updateLorePrompt = `Bạn là hệ thống lưu trữ thông tin nhân vật truyện tranh.
Dữ liệu nhân vật cũ:
${currentLore || "(Chưa có dữ liệu, đây là chap đầu tiên)"}

Tóm tắt diễn biến Chap mới (chứa các thẻ [Nhận diện: ...]):
${fullSummaryText}

NHIỆM VỤ: 
1. Đọc kỹ các thẻ [Nhận diện: ...] trong tóm tắt để thu thập BẰNG CHỨNG NGOẠI HÌNH mới nhất (màu tóc, trang phục mới, vũ khí).
2. HỢP NHẤT và XUẤT RA danh sách nhân vật được cập nhật (Thêm nhân vật mới xuất hiện, hoặc CẬP NHẬT GHI ĐÈ đặc điểm ngoại hình mới nhất của nhân vật cũ).
Chỉ trả về nội dung danh sách rõ ràng (Tên: Ngoại hình chi tiết hiện tại, Tính cách, Vai trò). Không kể lể cốt truyện.`;

    const loreAI = async (aiClient) => {
      return await aiClient.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [updateLorePrompt],
      });
    };
    const loreRes = await withRetryAndKeySwitch(apiKeyManager, sendLog, loreAI);
    const updatedLore = loreRes.text;
    fs.writeFileSync(finalLorePath, updatedLore, "utf8");
    sendLog(`✅ Đã cập nhật xong Bách Khoa Toàn Thư Nhân Vật vào file gốc!`);

    // 3. Bước 2: Chấp bút kịch bản
    sendLog(
      `✍️ BƯỚC 2: AI đang chấp bút viết kịch bản điện ảnh... (Vui lòng đợi)`,
    );

    let finalPrompt = `Bạn là một Tiktoker/Youtuber chuyên nghiệp chuyên review truyện tranh, manga, manhwa. 
Dưới đây là TÓM TẮT CHI TIẾT diễn biến của một chapter truyện (đã được bóc tách theo từng khung tranh). Dựa BÁM SÁT vào dữ liệu này, hãy viết một kịch bản Video Review.`;

    if (updatedLore) {
      finalPrompt += `\n\nBÁCH KHOA TOÀN THƯ NHÂN VẬT TỪ TÁC GIẢ: ${updatedLore}\n(Hãy sử dụng thông tin này để đảm bảo gọi chuẩn xác tên và đặc điểm nhân vật xuyên suốt kịch bản).`;
    }

    finalPrompt += `\n\nYÊU CẦU ĐỊNH DẠNG BẮT BUỘC (TUYỆT ĐỐI TUÂN THỦ):
- Phải viết kịch bản LẦN LƯỢT THEO TỪNG KHUNG TRANH, KHÔNG BỎ SÓT bất kỳ khung tranh nào (nhưng TUYỆT ĐỐI BỎ QUA các khung chỉ chứa ảnh bìa, logo truyện).
- Cấu trúc chung: [Miêu tả hành động], [Trích thoại] (Ngăn cách bằng DUY NHẤT dấu phẩy ","). TRƯỜNG HỢP ĐẶC BIỆT: Đối với khung tranh trống CHỈ CÓ CHỮ DẪN TRUYỆN (không có hành động/nhân vật), BẮT BUỘC chỉ ghi lại nguyên văn câu dẫn truyện đó, KHÔNG ĐƯỢC tự bịa thêm hành động hay cảnh vật.
- PHẦN MIÊU TẢ PHẢI VIẾT THẬT NGẮN GỌN, SÚC TÍCH. Lược bỏ các từ ngữ dư thừa, đi thẳng vào hành động chính (VD: "Main vung kiếm", "Kẻ địch ngã gục"). TUYỆT ĐỐI KHÔNG miêu tả văn vẻ dài dòng lê thê.
- VỀ XƯNG HÔ VÀ TRÁNH LẶP TỪ (QUAN TRỌNG): 
  + Nếu đã biết tên nhân vật (ví dụ Main), tuyệt đối KHÔNG gọi là "chàng trai/cô gái". Chỉ dùng "chàng trai/cô gái" cho người lạ chưa biết tên.
  + KHI MIÊU TẢ 1 NHÂN VẬT LIÊN TỤC TRONG NHIỀU KHUNG TRANH, BẮT BUỘC PHẢI ĐAN XEN LINH HOẠT giữa Tên riêng và Đại từ (cậu, anh, gã, hắn, y, ông ta, bà ấy...).
  + TUYỆT ĐỐI KHÔNG lặp đi lặp lại một cái tên hoặc một đại từ (như "Kim Yohan...", "Kim Yohan...", "Người mẹ...", "Người mẹ...") ở đầu mỗi câu. Nếu câu trước đã gọi Tên, câu sau phải đổi sang Đại từ nhân xưng. Việc lặp từ sẽ khiến người nghe cực kỳ khó chịu.
- KHÔNG sử dụng bất kỳ dấu câu nào khác ngoài dấu phẩy (,) và dấu chấm (.). (Tức là CẤM dùng ngoặc kép, gạch đầu dòng, dấu hai chấm, chấm hỏi, chấm than...).
- Hết 1 KHUNG TRANH phải XUỐNG DÒNG 1 lần. Đảm bảo cấu trúc: 1 khung tranh = 1 dòng duy nhất. Không được gộp 2, 3 khung tranh vào cùng 1 dòng.
- BỎ QUA HOÀN TOÀN phần Mở bài (chào hỏi) và Kết bài (kêu gọi). Lao thẳng trực tiếp vào kể diễn biến của chapter.
- TRONG DỮ LIỆU TÓM TẮT CÓ CÁC ĐOẠN "[Nhận diện: ...]": Đây chỉ là ghi chú nháp của người ghi chép. Khi viết kịch bản cuối cùng, BẠN PHẢI XÓA BỎ hoàn toàn các chữ "[Nhận diện: ...]" này, tuyệt đối không được đưa vào kịch bản đọc.

Ví dụ định dạng đúng (1 dòng = 1 khung tranh, miêu tả cực ngắn gọn):
Thanh niên vung kiếm chém tới, cút đi con quái vật.
Quái vật gầm lên đau đớn, grừ grừ.
Bầu trời chuyển đen kịt.
...

Chỉ trả về duy nhất nội dung kịch bản, tuân thủ chính xác các dấu câu và xuống dòng như trên.

DỮ LIỆU TÓM TẮT:
${fullSummaryText}`;

    const scriptAI = async (aiClient) => {
      return await aiClient.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [finalPrompt],
      });
    };
    const finalRes = await withRetryAndKeySwitch(
      apiKeyManager,
      sendLog,
      scriptAI,
    );

    // Lưu kịch bản ra file text trong thư mục chứa ảnh
    let finalScriptName = scriptName
      ? scriptName.trim()
      : "Kich_Ban_Review.txt";
    if (!finalScriptName.toLowerCase().endsWith(".txt")) {
      finalScriptName += ".txt";
    }

    const scriptFilePath = path.join(folderPath, finalScriptName);
    fs.writeFileSync(scriptFilePath, finalRes.text, "utf8");

    sendLog(
      `🎉 ĐÃ HOÀN TẤT KỊCH BẢN! Đã tự động lưu thành file "${finalScriptName}" trong thư mục ảnh.`,
    );
    return finalRes.text;
  } catch (error) {
    throw error;
  }
}

app.post("/api/generate-from-folder", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sendLog = (msg) =>
    res.write(`data: ${JSON.stringify({ type: "log", message: msg })}\n\n`);
  try {
    const { folderPath, loreFilePath, scriptName, chunkSize } = req.body;
    const apiKeyManager = new ApiKeyManager();
    const result = await generateScript(
      folderPath,
      loreFilePath,
      scriptName,
      sendLog,
      chunkSize,
      apiKeyManager,
    );
    res.write(`data: ${JSON.stringify({ type: "success", data: result })}\n\n`);
  } catch (error) {
    res.write(
      `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`,
    );
  }
  res.end();
});

app.post("/api/bulk-process", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sendLog = (msg) =>
    res.write(`data: ${JSON.stringify({ type: "log", message: msg })}\n\n`);

  try {
    const { urlText, outputDir, loreFilePath, chunkSize } = req.body;

    if (!urlText || !outputDir) {
      throw new Error("Vui lòng cung cấp danh sách URL và thư mục lưu.");
    }

    const lines = urlText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    sendLog(`🚀 BẮT ĐẦU CHẠY AUTO HÀNG LOẠT (${lines.length} CHAPTER) 🚀`);

    let currentLorePath = loreFilePath; // Khởi tạo bằng file sếp chọn (nếu có)

    const apiKeyManager = new ApiKeyManager();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let url = line;
      let chapName = "";

      if (line.includes("|")) {
        const parts = line.split("|");
        url = parts[0].trim();
        chapName = parts[1].trim();
      } else {
        // Tự trích xuất tên chap từ URL (ví dụ: chapter-1)
        const urlParts = url.split("/");
        chapName =
          urlParts[urlParts.length - 1] ||
          urlParts[urlParts.length - 2] ||
          `Chap_${i + 1}`;
      }

      // Tạo tên thư mục hợp lệ
      chapName = chapName.replace(/[^a-zA-Z0-9_-]/g, "_");
      const chapFolder = path.join(outputDir, chapName);
      if (!fs.existsSync(chapFolder)) {
        fs.mkdirSync(chapFolder, { recursive: true });
      }

      sendLog(`\n========================================`);
      sendLog(`➡️ ĐANG XỬ LÝ: [${i + 1}/${lines.length}] ${chapName} (${url})`);

      try {
        // 1. Tải ảnh
        await downloadChapter(url, chapFolder, sendLog);

        // 2. Viết kịch bản
        const scriptFileName = `Kich_Ban_${chapName}.txt`;
        await generateScript(
          chapFolder,
          currentLorePath,
          scriptFileName,
          sendLog,
          chunkSize,
          apiKeyManager,
        );

        // 3. Nối file Lore cho chap sau: Nếu chap này vừa tạo ra file Lore mới, hãy gán nó cho chap tiếp theo học!
        const generatedLorePath = path.join(chapFolder, "Tom_Tat_Nhan_Vat.txt");
        if (fs.existsSync(generatedLorePath)) {
          currentLorePath = generatedLorePath;
        }

        sendLog(`✅ HOÀN THÀNH: ${chapName}`);
      } catch (chapErr) {
        sendLog(`❌ LỖI TẠI ${chapName}: ${chapErr.message}`);
        sendLog(`⏭️ Sẽ tự động bỏ qua và chạy tiếp Chap sau...`);
      }
    }

    sendLog(`\n========================================`);
    sendLog(`🏆 ĐÃ XỬ LÝ XONG TOÀN BỘ ${lines.length} CHAPTER!`);
    res.write(
      `data: ${JSON.stringify({ type: "success", data: "Hoàn tất chạy tự động toàn bộ." })}\n\n`,
    );
  } catch (error) {
    res.write(
      `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`,
    );
  }
  res.end();
});

const aiGoogle = new GoogleGenAI({
  apiKey: "AIzaSyCKKSjvSfn9fOWBgQV271yTiW3rf5flvcQ",
});

const aiAnime = new GoogleGenAI({
  apiKey: "AIzaSyD3URezuXK974rOV7AES0Ox4kcysCEqEc0",
});

app.get("/api/choose-video-file", async (req, res) => {
  try {
    const tempFile = path.join(process.cwd(), "temp_video_path.txt");
    const psCommand = `
      Add-Type -AssemblyName System.windows.forms;
      $owner = New-Object System.Windows.Forms.Form;
      $owner.TopMost = $true;
      $owner.ShowInTaskbar = $false;
      $owner.WindowState = 'Minimized';
      $f = New-Object System.Windows.Forms.OpenFileDialog;
      $f.Filter = 'Video Files (*.mp4;*.mkv;*.avi;*.mov)|*.mp4;*.mkv;*.avi;*.mov|All files (*.*)|*.*';
      $f.Title = 'Chọn file video phim';
      if ($f.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
          [IO.File]::WriteAllText('${tempFile.replace(/\\/g, "\\\\")}', $f.FileName, [System.Text.Encoding]::UTF8)
      } else {
          [IO.File]::WriteAllText('${tempFile.replace(/\\/g, "\\\\")}', '', [System.Text.Encoding]::UTF8)
      }
    `;
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    await execPromise(
      `powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`,
    );
    if (fs.existsSync(tempFile)) {
      const selectedPath = fs.readFileSync(tempFile, "utf8").trim();
      fs.unlinkSync(tempFile);
      res.json({ path: selectedPath });
    } else {
      res.json({ path: "" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Không thể mở hộp thoại chọn video." });
  }
});

app.get("/api/choose-multiple-video-files", async (req, res) => {
  try {
    const tempFile = path.join(process.cwd(), "temp_multiple_video_paths.txt");
    const psCommand = `
      Add-Type -AssemblyName System.windows.forms;
      $owner = New-Object System.Windows.Forms.Form;
      $owner.TopMost = $true;
      $owner.ShowInTaskbar = $false;
      $owner.WindowState = 'Minimized';
      $f = New-Object System.Windows.Forms.OpenFileDialog;
      $f.Filter = 'Video Files (*.mp4;*.mkv;*.avi;*.mov)|*.mp4;*.mkv;*.avi;*.mov|All files (*.*)|*.*';
      $f.Title = 'Chọn nhiều file video anime';
      $f.Multiselect = $true;
      if ($f.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
          $paths = $f.FileNames -join '|||';
          [IO.File]::WriteAllText('${tempFile.replace(/\\/g, "\\\\")}', $paths, [System.Text.Encoding]::UTF8)
      } else {
          [IO.File]::WriteAllText('${tempFile.replace(/\\/g, "\\\\")}', '', [System.Text.Encoding]::UTF8)
      }
    `;
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    await execPromise(
      `powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`,
    );
    if (fs.existsSync(tempFile)) {
      const selectedPathsText = fs.readFileSync(tempFile, "utf8").trim();
      fs.unlinkSync(tempFile);
      if (selectedPathsText) {
        const paths = selectedPathsText.split("|||");
        res.json({ paths });
      } else {
        res.json({ paths: [] });
      }
    } else {
      res.json({ paths: [] });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Không thể mở hộp thoại chọn video." });
  }
});

app.post("/api/generate-movie-script", async (req, res) => {
  req.setTimeout(1800000); // 30 mins timeout for large video
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sendLog = (msg) =>
    res.write(`data: ${JSON.stringify({ type: "log", message: msg })}\n\n`);

  try {
    const {
      videoPath,
      outputDir,
      loreFilePath,
      scriptName,
      skipLoreUpdate,
      translateToJP,
      movieName,
      includeHook,
      includeOutro,
      movieWordCount
    } = req.body;

    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error("Không tìm thấy file Video.");
    }
    if (!outputDir || !fs.existsSync(outputDir)) {
      throw new Error("Không tìm thấy thư mục lưu.");
    }

    let currentLore = "";
    let finalLorePath = path.join(outputDir, "Tom_Tat_Nhan_Vat.txt");

    if (loreFilePath && fs.existsSync(loreFilePath)) {
      currentLore = fs.readFileSync(loreFilePath, "utf8");
      finalLorePath = loreFilePath;
      sendLog(`📜 Đã tải Tóm Tắt Nhân Vật từ file.`);
    } else if (fs.existsSync(finalLorePath)) {
      currentLore = fs.readFileSync(finalLorePath, "utf8");
      sendLog(`📜 Đã tải Tóm Tắt Nhân Vật từ thư mục lưu.`);
    } else {
      sendLog(
        `📜 Không có file nhân vật. AI sẽ tự động định hình nhân vật qua video và lưu vào "Tom_Tat_Nhan_Vat.txt".`,
      );
    }

    let finalVideoPath = videoPath;
    const ffmpegPath = path.join(process.cwd(), "..", "ffmpeg.exe");
    const optimizedVideoPath = path.join(
      outputDir,
      `optimized_${path.parse(videoPath).name}.mp4`
    );

    if (fs.existsSync(ffmpegPath)) {
      sendLog(
        `⚙️ Đang dùng FFMPEG nén video (1 khung hình/giây) để tối ưu...`,
      );
      // fps=1 -> 1 frame per second. scale=1280:-2 -> Max width 1280px to save size.
      const ffmpegCmd = `"${ffmpegPath}" -y -i "${videoPath}" -vf "fps=1,scale=1280:-2" -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p -c:a aac -b:a 64k "${optimizedVideoPath}"`;
      try {
        await execPromise(ffmpegCmd);
        sendLog(`✅ Nén video thành công! Bắt đầu upload bản tối ưu...`);
        finalVideoPath = optimizedVideoPath;
      } catch (err) {
        sendLog(
          `⚠️ Lỗi khi nén bằng ffmpeg: ${err.message}. Sẽ upload bản gốc...`,
        );
      }
    } else {
      sendLog(
        `⚠️ Không tìm thấy ffmpeg.exe ở thư mục gốc. Sẽ upload video gốc (Có thể gây lỗi nếu video quá dài)...`,
      );
    }

    const apiKeyManager = new ApiKeyManager();

    sendLog(`🎬 Đang chuẩn bị Upload và Xử Lý Kịch Bản Phim...`);

    const processMovie = async (aiClient) => {
      const finalCheckFile = await uploadAndCacheVideo(
        aiClient,
        finalVideoPath,
        sendLog,
      );

      if (!skipLoreUpdate) {
        sendLog(
          `🧠 Đang quét video để phân tích và cập nhật danh sách Tóm Tắt Nhân Vật...`,
        );
        try {
          let updateLorePrompt = `Tôi cung cấp cho bạn một video phim${movieName ? ` (Tên phim: ${movieName})` : ""} và dữ liệu nhân vật cũ (nếu có): ${currentLore || "Chưa có dữ liệu"}\n. Hãy xem video, nhận diện các nhân vật (cũ và mới) xuất hiện, hợp nhất và xuất ra danh sách BÁCH KHOA TOÀN THƯ NHÂN VẬT mới nhất.\nĐịnh dạng bắt buộc cho mỗi nhân vật: [Tên nhân vật] - Ngoại hình: ..., Vai trò: ..., Tính cách/Tâm lý: ...\nChỉ xuất duy nhất danh sách, ghi càng chi tiết đặc điểm nhận dạng càng tốt để không bị nhầm lẫn. TUYỆT ĐỐI KHÔNG viết kịch bản ở bước này.`;

          const loreRes = await aiClient.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [
              {
                fileData: {
                  mimeType: finalCheckFile.mimeType || "video/mp4",
                  fileUri: finalCheckFile.uri,
                },
              },
              updateLorePrompt,
            ],
            config: {
              safetySettings: [
                {
                  category: "HARM_CATEGORY_HATE_SPEECH",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_HARASSMENT",
                  threshold: "BLOCK_NONE",
                },
              ],
            },
          });

          const newLoreText = loreRes.text || "";
          if (!newLoreText) {
            throw new Error(
              "Google API trả về nội dung rỗng hoặc bị chặn bởi bộ lọc an toàn.",
            );
          }
          currentLore = newLoreText;
          fs.writeFileSync(finalLorePath, currentLore, "utf8");
          sendLog(`✅ Đã cập nhật xong file Tom_Tat_Nhan_Vat.txt!`);
        } catch (loreError) {
          if (
            loreError.message.includes("429") ||
            loreError.message.includes("quota") ||
            loreError.message.includes("exhausted") ||
            loreError.message.includes("503") ||
            loreError.message.includes("unavailable")
          ) {
            throw loreError; // Nhả lỗi ra ngoài để đổi key
          }
          sendLog(
            `⚠️ Cảnh báo: Lỗi khi trích xuất nhân vật (${loreError.message}). Sẽ tiếp tục viết kịch bản với dữ liệu cũ.`,
          );
        }

        sendLog(
          `⏳ Đang đợi 60 giây để làm mát API, tránh lỗi Quota Limit của Google...`,
        );
        await new Promise((r) => setTimeout(r, 60000));
      } else {
        sendLog(
          `⚡ Chế độ bỏ qua quét nhân vật. Sẽ sử dụng trực tiếp Tóm Tắt Nhân Vật hiện tại!`,
        );
      }

      sendLog(`🎬 Bắt đầu viết Kịch Bản Phim...`);

      let prompt = `Bạn là một Youtuber/Tiktoker hàng đầu Việt Nam chuyên làm nội dung "Review Phim" (Tóm tắt phim) với hàng triệu lượt theo dõi. 
Tôi cung cấp cho bạn một video phim${movieName ? ` (Tên phim: ${movieName})` : ""}. Hãy xem kỹ toàn bộ diễn biến, biểu cảm nhân vật, âm thanh và viết một kịch bản đọc voice-off (thuyết minh) hoàn chỉnh.

BÁCH KHOA TOÀN THƯ NHÂN VẬT (Dùng để gọi đúng tên):
${currentLore}
(TUYỆT ĐỐI KHÔNG IN LẠI DANH SÁCH NHÂN VẬT VÀO KỊCH BẢN, CHỈ ĐỌC ĐỂ BIẾT TÊN).

YÊU CẦU QUAN TRỌNG VỀ ĐỘ DÀI VÀ CHI TIẾT:
- Kịch bản phải dài khoảng ${movieWordCount ? movieWordCount : "1.500 đến 2.000"} từ. Hãy lướt qua nhanh hoặc cắt bỏ những cảnh không đặc sắc, rườm rà. Tập trung vào cốt phim chính. Kể lại những sự kiện quan trọng, từng mưu hèn kế bẩn, từng pha hành động, tính toán. Viết giống như bạn đang kể chuyện cho đứa bạn thân nghe chứ không phải tập trung mô tả tỉ mỉ từng chi tiết nhỏ giống như tiểu thuyết. Đây là Recap Phim.

YÊU CẦU VỀ VĂN PHONG VÀ CÁCH KỂ CHUYỆN (RẤT QUAN TRỌNG):
- TUYỆT ĐỐI KHÔNG viết kiểu văn vẻ, tiểu thuyết, hàn lâm (VD: không dùng "bánh xe lịch sử", "không khí đặc quánh", "tấn bi kịch"). 
- PHẢI viết bằng giọng điệu Review Phim Tiktok/Facebook: Nhanh, hài hước, mỉa mai, đời thường và cực kỳ "bựa". Giống như bạn đang kể một câu chuyện giật gân cho đứa bạn thân nghe.
- BẮT BUỘC SỬ DỤNG NHIỀU TỪ LÓNG MẠNG: "đăng xuất", "bay màu", "toang", "tốc độ bàn thờ", "bế đi", "bóc lịch", "xơ múi", "quay xe cực gắt", "báo thủ", "hào quang nhân vật chính", "bật lại", "out trình", "bán muối", "đăng xuất khỏi Trái Đất"...
- CÁCH XƯNG HÔ: Đan xen gọi tên thật với các đại từ như "thanh niên", "ông chú", "nữ chính báo thủ", "gã", "ả", "tên đại ca", "lão già"...
- Lâu lâu hãy chèn những bình luận cá nhân, mỉa mai, châm biếm hoặc tấu hài về hành động ngu ngốc của nhân vật.
- TUYỆT ĐỐI KHÔNG sử dụng các ngoặc vuông [] gợi ý kỹ thuật. Kịch bản chỉ là chữ liền mạch để đọc voice.

CẤU TRÚC:
${includeHook !== false ? "1. MỞ ĐẦU (HOOK): Chọn phân cảnh giật gân hoặc vô lý nhất để mở đầu. Tuyệt đối không chào hỏi dài dòng." : "1. MỞ ĐẦU: TUYỆT ĐỐI KHÔNG viết đoạn hook giật gân hay mở bài. Bắt đầu ngay lập tức vào diễn biến tiếp nối của câu chuyện."}
2. DIỄN BIẾN: Kể chi tiết, bám sát các cú twist, đấu trí, đánh nhau.
${includeOutro !== false ? "3. KẾT THÚC (FAIR USE): Dừng ở đoạn cao trào. TRƯỚC KHI CHÀO TẠM BIỆT, BẮT BUỘC dành ra 1 đoạn ngắn (khoảng 100-150 từ) để làm 'Góc nhìn phê bình / Bật mí thú vị' (Tổng kết ý nghĩa thâm sâu, bóc trần dụng ý đạo diễn, so sánh với đời thực/game...). Cuối cùng mới chèn câu Outro quen thuộc kêu gọi like/share và hẹn gặp lại." : "3. KẾT THÚC: Dừng ngay tại diễn biến cao trào cuối cùng. TUYỆT ĐỐI KHÔNG chèn thêm câu chào tạm biệt hay hẹn gặp lại."}`;

      const response = await aiClient.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            fileData: {
              mimeType: finalCheckFile.mimeType || "video/mp4",
              fileUri: finalCheckFile.uri,
            },
          },
          prompt,
        ],
        config: {
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE",
            },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          ],
        },
      });

      let scriptText = response.text || "";
      if (!scriptText) {
        throw new Error(
          "Không nhận được kịch bản trả về từ API (Google API trả về nội dung rỗng hoặc bị chặn bởi bộ lọc an toàn).",
        );
      }
      return scriptText;
    };

    let scriptText = await withRetryAndKeySwitch(
      apiKeyManager,
      sendLog,
      processMovie,
    );

    // LƯU KỊCH BẢN
    let finalScriptName = `Kich_Ban_Phim_${Date.now()}.txt`;
    if (scriptName && scriptName.trim() !== "") {
      finalScriptName = scriptName.trim();
      if (!finalScriptName.toLowerCase().endsWith(".txt")) {
        finalScriptName += ".txt";
      }
    }
    const scriptFilePath = path.join(outputDir, finalScriptName);
    fs.writeFileSync(scriptFilePath, scriptText, "utf8");
    sendLog(
      `✅ Đã lưu thành công Kịch bản phim vào file: ${path.basename(scriptFilePath)}`,
    );

    // --- BƯỚC 4: DỊCH SANG TIẾNG NHẬT (Nếu được yêu cầu) ---
    if (translateToJP) {
      sendLog(
        `⏳ Đang chia nhỏ kịch bản để dịch sang Tiếng Nhật (tránh lỗi 503 Quá tải)...`,
      );

      // Tách văn bản thành các đoạn văn (split by \n\n)
      const paragraphs = scriptText.replace(/\r\n/g, "\n").split(/\n{2,}/);
      
      let chunks = [];
      let currentChunk = [];
      let currentWordCount = 0;
      
      for (const para of paragraphs) {
        if (!para.trim()) continue;
        const wordCount = para.split(/\s+/).length;
        if (currentWordCount + wordCount > 500 && currentChunk.length > 0) {
          chunks.push(currentChunk.join("\n\n"));
          currentChunk = [];
          currentWordCount = 0;
        }
        currentChunk.push(para.trim());
        currentWordCount += wordCount;
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n\n"));
      }

      let finalJpScriptText = "";
      
      for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
          sendLog(
            `⏳ Đang đợi 90 giây để làm mát API trước khi dịch phần đầu tiên...`,
          );
          await new Promise((r) => setTimeout(r, 90000));
        } else {
          sendLog(
            `⏳ Đang đợi 30 giây để làm mát API trước khi dịch phần tiếp theo...`,
          );
          await new Promise((r) => setTimeout(r, 30000));
        }

        sendLog(
          `🇯🇵 Bắt đầu dịch Phần ${i + 1}/${chunks.length} sang Tiếng Nhật (Phong cách Kansou/Kosatsu)...`,
        );

        let jpPrompt = `Bạn là chuyên gia dịch thuật và biên tập Review Phim.
Tên bộ phim: "${movieName || "Không rõ"}"
ĐÂY LÀ PHẦN ${i + 1}/${chunks.length} CỦA KỊCH BẢN.
YÊU CẦU BẮT BUỘC:
1. Tôi sẽ gửi cho bạn một phần của kịch bản Review Phim bằng tiếng Việt.
2. Bạn PHẢI dịch đoạn này sang bản dịch tiếng Nhật Bản (日本語) và viết lại thành MỘT BÀI VIẾT KỂ CHUYỆN.
3. PHONG CÁCH KỂ CHUYỆN (BẮT BUỘC): Dịch theo phong cách Review Phim Nhật Bản chuyên sâu (Kansou/Kosatsu). Tập trung mô tả tâm lý nhân vật và ý nghĩa ẩn dụ sâu sắc thay vì chỉ kể lể cốt truyện thô cứng. VĂN PHONG VÀ NGÔN TỪ: Sử dụng ngôn từ tinh tế, ngữ pháp chuẩn mực.
4. LÁCH LUẬT BẠO LỰC (BẮT BUỘC): TUYỆT ĐỐI KHÔNG dùng từ ngữ bạo lực. Phải dùng cách nói giảm nói tránh của tiếng Nhật. 
5. TÊN NHÂN VẬT: PHẢI phiên âm tự động TOÀN BỘ tên nhân vật sang Katakana chuẩn của Nhật.
6. XỬ LÝ SONG NGỮ (TỐI QUAN TRỌNG): BẮT BUỘC chèn nghĩa Tiếng Việt vào trong ngoặc đơn ( ) ngay sau mỗi câu. DỊCH LIỀN MẠCH, TỰ NHIÊN. Ngay sau mỗi dấu ngắt câu tiếng Nhật (。 hoặc ?), BẮT BUỘC viết ngay nghĩa Tiếng Việt của câu đó vào ( ). Ví dụ: 彼は走った。(Anh ấy chạy.)
7. BẮT BUỘC CHIA ĐOẠN (xuống dòng 2 lần) hợp lý khi chuyển cảnh. TUYỆT ĐỐI KHÔNG DỊCH LẠI ĐẦU PHIM, CHỈ DỊCH ĐOẠN DƯỚI ĐÂY.

KỊCH BẢN CẦN DỊCH (PHẦN ${i + 1}):
${chunks[i]}`;

        try {
          const translateAI = async (aiClient) => {
            return await aiClient.models.generateContent({
              model: "gemini-3.8-flash",
              contents: jpPrompt,
              config: {
                safetySettings: [
                  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                ],
              },
            });
          };

          const jpResponse = await withRetryAndKeySwitch(apiKeyManager, sendLog, translateAI);
          let jpScriptPart = jpResponse.text || "";
          
          if (!jpScriptPart) {
             throw new Error(`API trả về nội dung rỗng ở Phần ${i + 1}.`);
          }
          finalJpScriptText += jpScriptPart + "\n\n";

        } catch (jpErr) {
          sendLog(`⚠️ Lỗi khi dịch phần ${i + 1}: ${jpErr.message}. (Sẽ bỏ qua phần này và dịch tiếp)`);
        }
      }

      if (finalJpScriptText.trim()) {
        let finalJpScriptName = finalScriptName.replace(/\.txt$/i, "_JP.txt");
        if (finalJpScriptName === finalScriptName) {
          finalJpScriptName += "_JP.txt";
        }
        const jpScriptFilePath = path.join(outputDir, finalJpScriptName);
        fs.writeFileSync(jpScriptFilePath, finalJpScriptText, "utf8");
        sendLog(`✅ Đã lưu thành công Kịch bản Tiếng Nhật tổng hợp vào file: ${path.basename(jpScriptFilePath)}`);
      }
    }

    sendLog(`🎉 ĐÃ HOÀN TẤT QUY TRÌNH REVIEW PHIM!`);
    res.write(
      `data: ${JSON.stringify({ type: "success", data: scriptText })}\n\n`,
    );
  } catch (error) {
    sendLog(`❌ LỖI: ${error.message}`);
    res.write(
      `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`,
    );
  }
  res.end();
});

function getAnimeAi(customKey) {
  if (customKey && customKey.trim() !== "") {
    return new GoogleGenAI({ apiKey: customKey.trim() });
  }
  return aiAnime;
}

app.post("/api/generate-anime-script", async (req, res) => {
  req.setTimeout(1800000);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sendLog = (msg) =>
    res.write(`data: ${JSON.stringify({ type: "log", message: msg })}\n\n`);

  try {
    const {
      videoPath,
      outputDir,
      loreFilePath,
      scriptName,
      skipLoreUpdate,
      movieName,
      apiKey,
    } = req.body;

    const apiKeyManager = new ApiKeyManager(apiKey);

    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error("Không tìm thấy file Video.");
    }
    if (!outputDir || !fs.existsSync(outputDir)) {
      throw new Error("Không tìm thấy thư mục lưu.");
    }

    let currentLore = "";
    let finalLorePath = path.join(outputDir, "Tom_Tat_Nhan_Vat.txt");

    if (loreFilePath && fs.existsSync(loreFilePath)) {
      currentLore = fs.readFileSync(loreFilePath, "utf8");
      finalLorePath = loreFilePath;
      sendLog(`📜 Đã tải Tóm Tắt Nhân Vật từ file.`);
    } else if (fs.existsSync(finalLorePath)) {
      currentLore = fs.readFileSync(finalLorePath, "utf8");
      sendLog(`📜 Đã tải Tóm Tắt Nhân Vật từ thư mục lưu.`);
    } else {
      sendLog(
        `📜 Không có file nhân vật. AI sẽ tự động định hình nhân vật qua video và lưu vào "Tom_Tat_Nhan_Vat.txt".`,
      );
    }

    let finalVideoPath = videoPath;

    // Anime (thường 20-26 phút) nhỏ, không lo thiếu token nên bỏ qua bước FFMPEG nén hình
    sendLog(
      `⚙️ Bỏ qua bước nén FFMPEG. Anime ngắn nên sẽ dùng trực tiếp video gốc để giữ chất lượng!`,
    );

    const processAI = async (aiClient) => {
      // Dùng uploadAndCacheVideo để tối ưu thời gian (có sẵn logic kiểm tra cache file trên cloud)
      const finalCheckFile = await uploadAndCacheVideo(
        aiClient,
        finalVideoPath,
        sendLog,
      );

      if (!skipLoreUpdate) {
        sendLog(
          `🧠 Đang quét video để phân tích và cập nhật danh sách Tóm Tắt Nhân Vật Anime...`,
        );
        try {
          let updateLorePrompt = `Tôi cung cấp cho bạn một video anime${movieName ? ` (Tên anime: ${movieName})` : ""} và dữ liệu nhân vật cũ (nếu có): ${currentLore || "Chưa có dữ liệu"}\n. Hãy xem video, nhận diện các nhân vật (cũ và mới) xuất hiện, hợp nhất và xuất ra danh sách BÁCH KHOA TOÀN THƯ NHÂN VẬT mới nhất.\nĐịnh dạng bắt buộc cho mỗi nhân vật: [Tên nhân vật] - Ngoại hình: ..., Vai trò: ..., Tính cách/Tâm lý (như tsundere, yandere, wibu...): ...\nChỉ xuất duy nhất danh sách, ghi càng chi tiết đặc điểm nhận dạng càng tốt để không bị nhầm lẫn. TUYỆT ĐỐI KHÔNG viết kịch bản ở bước này.`;

          const loreRes = await aiClient.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [
              {
                fileData: {
                  mimeType: finalCheckFile.mimeType || "video/mp4",
                  fileUri: finalCheckFile.uri,
                },
              },
              updateLorePrompt,
            ],
            config: {
              safetySettings: [
                {
                  category: "HARM_CATEGORY_HATE_SPEECH",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_HARASSMENT",
                  threshold: "BLOCK_NONE",
                },
              ],
            },
          });

          const newLoreText = loreRes.text || "";
          if (!newLoreText) {
            throw new Error(
              "Google API trả về nội dung rỗng hoặc bị chặn bởi bộ lọc an toàn.",
            );
          }
          currentLore = newLoreText;
          fs.writeFileSync(finalLorePath, currentLore, "utf8");
          sendLog(`✅ Đã cập nhật xong file Tom_Tat_Nhan_Vat.txt!`);
        } catch (loreError) {
          if (
            loreError.message.includes("429") ||
            loreError.message.includes("quota") ||
            loreError.message.includes("exhausted") ||
            loreError.message.includes("503") ||
            loreError.message.includes("unavailable")
          ) {
            throw loreError; // Nhả lỗi ra ngoài để đổi key
          }
          sendLog(
            `⚠️ Cảnh báo: Lỗi khi trích xuất nhân vật (${loreError.message}). Sẽ tiếp tục viết kịch bản với dữ liệu cũ.`,
          );
        }

        sendLog(
          `⏳ Đang đợi 60 giây để làm mát API, tránh lỗi Quota Limit của Google...`,
        );
        await new Promise((r) => setTimeout(r, 60000));
      } else {
        sendLog(
          `⚡ Chế độ bỏ qua quét nhân vật. Sẽ sử dụng trực tiếp Tóm Tắt Nhân Vật hiện tại!`,
        );
      }

      sendLog(`🎬 Bắt đầu viết Kịch Bản Tóm Tắt Anime...`);

      let prompt = `Bạn là một Youtuber/Tiktoker hàng đầu Việt Nam chuyên làm nội dung "Tóm Tắt Anime" (Review Anime) với hàng triệu lượt theo dõi từ cộng đồng Wibu/Otaku. 
Tôi cung cấp cho bạn một video anime${movieName ? ` (Tên anime: ${movieName})` : ""}. Hãy xem kỹ toàn bộ diễn biến, biểu cảm nhân vật, âm thanh, các pha combat và viết một kịch bản đọc voice-off (thuyết minh) hoàn chỉnh.

BÁCH KHOA TOÀN THƯ NHÂN VẬT (Dùng để gọi đúng tên):
${currentLore}
(TUYỆT ĐỐI KHÔNG IN LẠI DANH SÁCH NHÂN VẬT VÀO KỊCH BẢN, CHỈ ĐỌC ĐỂ BIẾT TÊN).

YÊU CẦU QUAN TRỌNG VỀ ĐỘ DÀI VÀ CHI TIẾT:
- Kịch bản dài khoảng 700 đến 1000 từ. Cắt bỏ những cảnh hội thoại rườm rà. Tập trung kể lại diễn biến chính, các trận combat mãn nhãn, sự buff sức mạnh hoặc những tình huống tấu hài/harem đặc trưng của anime. Viết như kể chuyện cho đồng dâm wibu nghe. Đây là Recap Anime.

YÊU CẦU VỀ VĂN PHONG VÀ CÁCH KỂ CHUYỆN (RẤT QUAN TRỌNG):
- Giọng điệu "bựa", mỉa mai, hài hước, phản ứng thái quá theo phong cách người xem anime.
- BẮT BUỘC SỬ DỤNG NHIỀU TỪ LÓNG CỦA CỘNG ĐỒNG ANIME VIỆT NAM: "main giấu nghề", "buff bẩn", "sức mạnh tình bạn", "sức mạnh tình yêu", "hào quang nhân vật chính", "ảo ma canada", "out trình", "ao chình", "cháy máy", "bay màu", "báo thủ", "waifu", "husbando", "tsundere", "isekai", "gánh còng lưng", "chúa tể bóng tối"...
- KHAI THÁC MOTIF: Hãy mỉa mai các motif kinh điển (ví dụ: đang đánh nhau thì nhớ lại quá khứ, trút hơi thở cuối cùng nhưng vẫn lải nhải đạo lý, main vô tình ngã vào gái, phản diện lắm mồm...).
- CÁCH XƯNG HÔ: Đan xen tên thật với đại từ: "main", "nam chính báo thủ", "na phụ", "waifu quốc dân", "ông chú", "tên phản diện", "chú bé đần"...
- TUYỆT ĐỐI KHÔNG sử dụng các ngoặc vuông [] gợi ý kỹ thuật. Kịch bản chỉ là chữ liền mạch để đọc voice.

CẤU TRÚC (TUÂN THỦ NGHIÊM NGẶT YÊU CẦU DƯỚI ĐÂY VỀ MỞ ĐẦU VÀ KẾT THÚC):
${req.body.hasHook !== false ? "1. MỞ ĐẦU (HOOK): Nhắm vào cảnh combat ảo ma nhất hoặc sự giấu nghề của main để mở đầu giật gân. Không chào hỏi dài dòng." : "1. MỞ ĐẦU: KHÔNG ĐƯỢC VIẾT HOOK HOẶC CÂU CHÀO HỎI. Hãy ĐÂM THẲNG NGAY VÀO LUÔN diễn biến tiếp nối của câu chuyện từ những giây đầu tiên."}
2. DIỄN BIẾN: Kể chi tiết, bám sát hành trình, sức mạnh, và các cú twist.
${req.body.hasOutro !== false ? "3. KẾT THÚC: Dừng ở cao trào và chèn outro (VD: Cùng lót dép chờ xem main thể hiện ở phần sau nhé, nhớ like và subcribe!)." : "3. KẾT THÚC: KHÔNG ĐƯỢC VIẾT OUTRO KÊU GỌI LIKE HAY TẠM BIỆT. Hãy kết thúc lửng lơ đột ngột ngay khi hết diễn biến của tập này để khớp với tập tiếp theo."}`;

      return await aiClient.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            fileData: {
              mimeType: finalCheckFile.mimeType || "video/mp4",
              fileUri: finalCheckFile.uri,
            },
          },
          prompt,
        ],
        config: {
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE",
            },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          ],
        },
      });
    };

    const response = await withRetryAndKeySwitch(
      apiKeyManager,
      sendLog,
      processAI,
    );

    let scriptText = response.text || "";
    if (!scriptText) {
      throw new Error(
        "Không nhận được kịch bản trả về từ API (Google API trả về nội dung rỗng hoặc bị chặn bởi bộ lọc an toàn).",
      );
    }

    // LƯU KỊCH BẢN
    let finalScriptName = `Kich_Ban_Anime_${Date.now()}.txt`;
    if (scriptName && scriptName.trim() !== "") {
      finalScriptName = scriptName.trim();
      if (!finalScriptName.toLowerCase().endsWith(".txt")) {
        finalScriptName += ".txt";
      }
    }
    const scriptFilePath = path.join(outputDir, finalScriptName);
    fs.writeFileSync(scriptFilePath, scriptText, "utf8");
    sendLog(
      `✅ Đã lưu thành công Kịch bản Anime vào file: ${path.basename(scriptFilePath)}`,
    );

    sendLog(`🎉 ĐÃ HOÀN TẤT QUY TRÌNH REVIEW ANIME!`);
    res.write(
      `data: ${JSON.stringify({ type: "success", data: scriptText })}\n\n`,
    );
  } catch (error) {
    sendLog(`❌ LỖI: ${error.message}`);
    res.write(
      `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`,
    );
  }
  res.end();
});

app.post("/api/bulk-anime", async (req, res) => {
  req.setTimeout(86400000); // 24 hours
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sendLog = (msg) =>
    res.write(`data: ${JSON.stringify({ type: "log", message: msg })}\n\n`);

  try {
    const {
      inputDir,
      videoPaths,
      outputDir,
      loreFilePath,
      skipLoreUpdate,
      movieName,
      apiKey,
    } = req.body;

    const apiKeyManager = new ApiKeyManager(apiKey);

    if (!outputDir || !fs.existsSync(outputDir)) {
      throw new Error("Không tìm thấy thư mục lưu đầu ra.");
    }

    let videoFiles = [];

    if (videoPaths && Array.isArray(videoPaths) && videoPaths.length > 0) {
      // User selected multiple files
      videoFiles = videoPaths.map((p) => ({
        name: path.basename(p),
        fullPath: p,
      }));
    } else if (inputDir && fs.existsSync(inputDir)) {
      // User selected a folder
      const allFiles = fs.readdirSync(inputDir);
      videoFiles = allFiles
        .filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return [".mp4", ".mkv", ".avi", ".mov"].includes(ext);
        })
        .map((file) => ({
          name: file,
          fullPath: path.join(inputDir, file),
        }));
    } else {
      throw new Error("Vui lòng chọn thư mục hoặc các file Video.");
    }

    if (videoFiles.length === 0) {
      throw new Error("Không tìm thấy video nào.");
    }

    // Sort files naturally by extracting numbers (like before)
    videoFiles.sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.name.replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });

    sendLog(
      `📦 TÌM THẤY ${videoFiles.length} TẬP ANIME. BẮT ĐẦU CHẠY HÀNG LOẠT!`,
    );

    let currentLore = "";
    let finalLorePath = path.join(outputDir, "Tom_Tat_Nhan_Vat_Bulk.txt");

    if (loreFilePath && fs.existsSync(loreFilePath)) {
      currentLore = fs.readFileSync(loreFilePath, "utf8");
      sendLog(`📜 Đã tải Tóm Tắt Nhân Vật từ file có sẵn.`);
    }

    const cacheFilePath = path.join(outputDir, "google_upload_cache.json");
    let uploadCache = {};
    if (fs.existsSync(cacheFilePath)) {
      try {
        uploadCache = JSON.parse(fs.readFileSync(cacheFilePath, "utf8"));
        sendLog(`♻️ Tải cache upload Google thành công.`);
      } catch (e) {}
    }

    for (let i = 0; i < videoFiles.length; i++) {
      const videoName = videoFiles[i].name;
      const videoPath = videoFiles[i].fullPath;
      const isFirst = i === 0;
      const isLast = i === videoFiles.length - 1;
      const tapNum = i + 1;

      sendLog(`\n==================================================`);
      sendLog(`▶️ ĐANG XỬ LÝ TẬP ${tapNum}/${videoFiles.length}: ${videoName}`);

      const processEpisode = async (aiClient) => {
        let uploadName = uploadCache[videoName];
        let finalCheckFile = null;

        if (uploadName) {
          sendLog(
            `♻️ Tìm thấy bản upload cũ trên Google (ID: ${uploadName}). Đang kiểm tra trạng thái...`,
          );
          try {
            finalCheckFile = await aiClient.files.get({ name: uploadName });
            if (finalCheckFile.state === "FAILED") {
              uploadName = null;
            } else {
              sendLog(
                `✅ Video đã sẵn sàng trên máy chủ Google! Không cần upload lại.`,
              );
            }
          } catch (e) {
            uploadName = null;
            finalCheckFile = null;
          }
        }

        if (
          !uploadName ||
          !finalCheckFile ||
          finalCheckFile.state !== "ACTIVE"
        ) {
          sendLog(`🎬 Đang upload Video lên server Google...`);
          const uploadResult = await aiClient.files.upload({
            file: videoPath,
            config: { mimeType: "video/mp4" },
          });

          uploadName = uploadResult.name;
          uploadCache[videoName] = uploadName;
          fs.writeFileSync(cacheFilePath, JSON.stringify(uploadCache, null, 2));

          sendLog(`⏳ Đã upload xong. Chờ Google xử lý (ID: ${uploadName})...`);

          let isReady = false;
          while (!isReady) {
            await new Promise((resolve) => setTimeout(resolve, 10000));
            finalCheckFile = await aiClient.files.get({ name: uploadName });
            if (finalCheckFile.state === "ACTIVE") {
              isReady = true;
            } else if (finalCheckFile.state === "FAILED") {
              throw new Error(`Google không thể phân tích video ${videoName}.`);
            }
          }
        }

        if (!skipLoreUpdate) {
          sendLog(`🧠 Đang cập nhật Bách Khoa Toàn Thư Nhân Vật từ tập này...`);
          try {
            let updateLorePrompt = `Tôi cung cấp cho bạn một video anime${movieName ? ` (Tên anime: ${movieName})` : ""} và dữ liệu nhân vật cũ (nếu có): ${currentLore || "Chưa có dữ liệu"}\n. Hãy xem video, nhận diện các nhân vật (cũ và mới) xuất hiện, hợp nhất và xuất ra danh sách BÁCH KHOA TOÀN THƯ NHÂN VẬT mới nhất.\nĐịnh dạng bắt buộc cho mỗi nhân vật: [Tên nhân vật] - Ngoại hình: ..., Vai trò: ..., Tính cách/Tâm lý (như tsundere, yandere, wibu...): ...\nChỉ xuất duy nhất danh sách, ghi càng chi tiết đặc điểm nhận dạng càng tốt để không bị nhầm lẫn. TUYỆT ĐỐI KHÔNG viết kịch bản ở bước này.`;

            const loreRes = await aiClient.models.generateContent({
              model: "gemini-3.8-flash",
              contents: [
                {
                  fileData: {
                    mimeType: finalCheckFile.mimeType || "video/mp4",
                    fileUri: finalCheckFile.uri,
                  },
                },
                updateLorePrompt,
              ],
              config: {
                safetySettings: [
                  {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_NONE",
                  },
                  {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_NONE",
                  },
                  {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_NONE",
                  },
                  {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_NONE",
                  },
                ],
              },
            });

            if (loreRes.text) {
              currentLore = loreRes.text;
              fs.writeFileSync(finalLorePath, currentLore, "utf8");
              sendLog(`✅ Đã kế thừa & lưu cập nhật nhân vật!`);
            }
          } catch (loreError) {
            if (
              loreError.message.includes("429") ||
              loreError.message.includes("quota") ||
              loreError.message.includes("exhausted") ||
              loreError.message.includes("503") ||
              loreError.message.includes("unavailable")
            ) {
              throw loreError; // Để retry vòng ngoài
            }
            sendLog(
              `⚠️ Lỗi khi trích xuất nhân vật (${loreError.message}). Dùng dữ liệu cũ.`,
            );
          }

          sendLog(`⏳ Đợi 60s làm mát API...`);
          await new Promise((r) => setTimeout(r, 60000));
        }

        sendLog(
          `🎬 Đang viết Kịch Bản (Hook: ${isFirst ? "CÓ" : "KHÔNG"}, Outro: ${isLast ? "CÓ" : "KHÔNG"})...`,
        );

        let prompt = `Bạn là một Youtuber/Tiktoker hàng đầu Việt Nam chuyên làm nội dung "Tóm Tắt Anime" (Review Anime) với hàng triệu lượt theo dõi từ cộng đồng Wibu/Otaku. 
Tôi cung cấp cho bạn một video anime${movieName ? ` (Tên anime: ${movieName})` : ""}. Hãy xem kỹ toàn bộ diễn biến, biểu cảm nhân vật, âm thanh, các pha combat và viết một kịch bản đọc voice-off (thuyết minh) hoàn chỉnh.

BÁCH KHOA TOÀN THƯ NHÂN VẬT (Dùng để gọi đúng tên):
${currentLore}
(TUYỆT ĐỐI KHÔNG IN LẠI DANH SÁCH NHÂN VẬT VÀO KỊCH BẢN, CHỈ ĐỌC ĐỂ BIẾT TÊN).

YÊU CẦU QUAN TRỌNG VỀ ĐỘ DÀI VÀ CHI TIẾT:
- Kịch bản dài khoảng 700 đến 1000 từ. Cắt bỏ những cảnh hội thoại rườm rà. Tập trung kể lại diễn biến chính.

YÊU CẦU VỀ VĂN PHONG VÀ CÁCH KỂ CHUYỆN (RẤT QUAN TRỌNG):
- Giọng điệu "bựa", mỉa mai, hài hước. Dùng từ lóng: "main giấu nghề", "buff bẩn", "sức mạnh tình bạn"...
- Đan xen tên thật với đại từ: "main", "nam chính báo thủ", "waifu quốc dân", "ông chú"...
- TUYỆT ĐỐI KHÔNG sử dụng ngoặc vuông []. Kịch bản chỉ là chữ liền mạch.

CẤU TRÚC (TUÂN THỦ NGHIÊM NGẶT YÊU CẦU DƯỚI ĐÂY VỀ MỞ ĐẦU VÀ KẾT THÚC):
${isFirst ? "1. MỞ ĐẦU (HOOK): Nhắm vào cảnh combat ảo ma nhất hoặc sự giấu nghề của main để mở đầu giật gân. Không chào hỏi dài dòng." : "1. MỞ ĐẦU: KHÔNG ĐƯỢC VIẾT HOOK HOẶC CÂU CHÀO HỎI. Đây là tập nối tiếp nên hãy ĐÂM THẲNG NGAY VÀO LUÔN diễn biến tiếp nối của câu chuyện từ những giây đầu tiên."}
2. DIỄN BIẾN: Kể chi tiết, bám sát hành trình, sức mạnh, và các cú twist.
${isLast ? "3. KẾT THÚC: Dừng ở cao trào và chèn outro (VD: Cùng lót dép chờ xem main thể hiện ở phần sau nhé, nhớ like và subcribe!)." : "3. KẾT THÚC: KHÔNG ĐƯỢC VIẾT OUTRO KÊU GỌI LIKE HAY TẠM BIỆT. Hãy kết thúc lửng lơ đột ngột ngay khi hết diễn biến của tập này để nó tự động khớp liền mạch với kịch bản của tập tiếp theo."}`;

        return await aiClient.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [
            {
              fileData: {
                mimeType: finalCheckFile.mimeType || "video/mp4",
                fileUri: finalCheckFile.uri,
              },
            },
            prompt,
          ],
          config: {
            safetySettings: [
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE",
              },
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            ],
          },
        });
      };

      const response = await withRetryAndKeySwitch(
        apiKeyManager,
        sendLog,
        processEpisode,
      );

      let scriptText = response.text || "";
      if (!scriptText) {
        sendLog(`❌ Lỗi API trả về rỗng ở tập ${videoName}. Bỏ qua tập này.`);
        continue;
      }

      const safeBaseName = path.basename(videoName, path.extname(videoName));
      let finalScriptName = `Kich_Ban_${safeBaseName}.txt`;
      const scriptFilePath = path.join(outputDir, finalScriptName);
      fs.writeFileSync(scriptFilePath, scriptText, "utf8");
      sendLog(`✅ Đã lưu xong Kịch bản Tập ${tapNum} vào: ${finalScriptName}`);

      if (i < videoFiles.length - 1) {
        sendLog(`⏳ Đợi 30s trước khi chạy tập tiếp theo để an toàn API...`);
        await new Promise((r) => setTimeout(r, 30000));
      }
    }

    sendLog(`🎉 ĐÃ HOÀN TẤT TOÀN BỘ SERIES ANIME!`);
    res.write(
      `data: ${JSON.stringify({ type: "success", data: "Tuyệt vời! Toàn bộ series anime đã được chuyển thành kịch bản." })}\n\n`,
    );
  } catch (error) {
    sendLog(`❌ LỖI: ${error.message}`);
    res.write(
      `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`,
    );
  }
  res.end();
});

app.get("/api/choose-srt-file", async (req, res) => {
  try {
    const tempFile = path.join(process.cwd(), "temp_srt_path.txt");
    const psCommand = `
      Add-Type -AssemblyName System.windows.forms;
      $owner = New-Object System.Windows.Forms.Form;
      $owner.TopMost = $true;
      $owner.ShowInTaskbar = $false;
      $owner.WindowState = 'Minimized';
      $f = New-Object System.Windows.Forms.OpenFileDialog;
      $f.Filter = 'SRT Subtitles (*.srt)|*.srt|All files (*.*)|*.*';
      $f.Title = 'Chọn file phụ đề .srt';
      if ($f.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
          [IO.File]::WriteAllText('${tempFile.replace(/\\/g, "\\\\")}', $f.FileName, [System.Text.Encoding]::UTF8)
      } else {
          [IO.File]::WriteAllText('${tempFile.replace(/\\/g, "\\\\")}', '', [System.Text.Encoding]::UTF8)
      }
    `;
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    await execPromise(
      `powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`,
    );
    if (fs.existsSync(tempFile)) {
      let selectedPath = fs.readFileSync(tempFile, "utf8").trim();
      if (selectedPath.charCodeAt(0) === 0xfeff)
        selectedPath = selectedPath.slice(1);
      fs.unlinkSync(tempFile);
      res.json({ path: selectedPath });
    } else {
      res.json({ path: "" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi chọn srt" });
  }
});



app.post("/api/scan-auto-edit-folder", (req, res) => {
  try {
    const { inputDir } = req.body;
    if (!inputDir || !fs.existsSync(inputDir)) {
      return res.status(400).json({ error: "Thư mục không tồn tại." });
    }

    const files = fs.readdirSync(inputDir);
    const videoFiles = files.filter(f => f.match(/\.(mp4|mkv|avi|mov)$/i)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const srtFiles = files.filter(f => f.match(/\.srt$/i)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const pairs = [];
    const count = Math.min(videoFiles.length, srtFiles.length);

    for (let i = 0; i < count; i++) {
      pairs.push({
        id: i.toString(),
        video: videoFiles[i],
        srt: srtFiles[i],
        videoPath: path.join(inputDir, videoFiles[i]),
        srtPath: path.join(inputDir, srtFiles[i])
      });
    }

    res.json({ pairs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


async function processAutoEditEpisode(videoPath, srtPath, apiKeyManager, sendLog, videoNameOverride, chunkSize = 80) {
  if (!videoPath || !fs.existsSync(videoPath))
      throw new Error("Không tìm thấy file Video.");
    if (!srtPath || !fs.existsSync(srtPath))
      throw new Error("Không tìm thấy file SRT.");

    const srtContent = fs.readFileSync(srtPath, "utf8");
    const chunkSizeNum = parseInt(chunkSize) || 80;

    // Phân tích SRT để tính duration
    const blocks = [];
    const blocksRaw = srtContent.replace(/\r\n/g, "\n").split("\n\n");
    for (const raw of blocksRaw) {
      const lines = raw.trim().split("\n");
      if (lines.length >= 3) {
        const index = parseInt(lines[0]);
        const times = lines[1].split(" --> ");
        if (times.length === 2) {
          const parseTime = (t) => {
            const [hms, ms] = t.split(",");
            const [h, m, s] = hms.split(":");
            return (
              parseInt(h) * 3600000 +
              parseInt(m) * 60000 +
              parseInt(s) * 1000 +
              parseInt(ms || 0)
            );
          };
          const start = parseTime(times[0]);
          const end = parseTime(times[1]);
          blocks.push({ index, start, end, text: lines.slice(2).join(" ") });
        }
      }
    }

    // Tính required clips cho toàn bộ
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const prevEnd = i === 0 ? 0 : blocks[i - 1].end;
      const targetDuration = block.end - prevEnd;
      const requiredClips = Math.ceil(targetDuration / 2000) || 1;
      block.targetDuration = targetDuration;
      block.requiredClips = requiredClips;
    }

    let finalVideoPathToUpload = videoPath;
    const ffmpegPath = path.join(process.cwd(), "..", "ffmpeg.exe");
    
    // Đổi tên file proxy thành chuỗi Hex để tránh lỗi ByteString khi up lên Google (nếu tên file gốc có tiếng Hàn/Việt/Trung)
    const safeName = Buffer.from(path.parse(videoPath).name).toString('hex');
    const optimizedVideoPath = path.join(
      path.dirname(videoPath),
      `optimized_autoedit_${safeName}.mp4`
    );

    if (fs.existsSync(ffmpegPath)) {
      if (!fs.existsSync(optimizedVideoPath)) {
        sendLog(`⚙️ Đang dùng FFMPEG tạo bản Proxy siêu nhẹ (480p, giữ nguyên FPS) để lách giới hạn 2GB của Google...`);
        const ffmpegCmd = `"${ffmpegPath}" -y -i "${videoPath}" -vf "scale=-2:480" -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p -c:a aac -b:a 64k "${optimizedVideoPath}"`;
        try {
          await execPromise(ffmpegCmd);
          sendLog(`✅ Tạo Proxy thành công! Bắt đầu upload bản Proxy...`);
          finalVideoPathToUpload = optimizedVideoPath;
        } catch (err) {
          sendLog(`⚠️ Lỗi khi nén bằng ffmpeg: ${err.message}. Sẽ upload bản gốc...`);
        }
      } else {
        sendLog(`⚙️ Đã tìm thấy bản Proxy cũ (optimized_autoedit_${safeName}.mp4), sẽ dùng lại để tiết kiệm thời gian...`);
        finalVideoPathToUpload = optimizedVideoPath;
      }
    } else {
      sendLog(`⚠️ Không tìm thấy ffmpeg.exe ở thư mục gốc. Sẽ upload video gốc (Có thể gây lỗi 413 nếu video > 2GB)...`);
    }

    let allAiResults = [];
    let lastAnchorTime = 0;
    
    // Lưu vết API Key để upload lại nếu có sự kiện đổi Key
    let lastUsedKeyIndex = -1;
    let currentCheckFile = null;

    // CHIA NHỎ ĐỂ GỌI AI (Chunking)
    for (let i = 0; i < blocks.length; i += chunkSizeNum) {
      const chunkBlocks = blocks.slice(i, i + chunkSizeNum);
      const chunkIndex = Math.floor(i / chunkSizeNum) + 1;
      const totalChunks = Math.ceil(blocks.length / chunkSizeNum);

      let srtPromptList = "";
      for (const block of chunkBlocks) {
        srtPromptList += `Câu ${block.index} [Cần tìm ${block.requiredClips} clip]: ${block.text}\n`;
      }

      const prompt = `Dưới đây là danh sách các câu phụ đề kịch bản review (Phần ${chunkIndex}/${totalChunks}). Mỗi câu đã được tôi tính toán sẵn SỐ LƯỢNG CLIP CẦN THIẾT để lấp đầy thời gian đọc.
${lastAnchorTime > 0 ? `\nLƯU Ý QUAN TRỌNG VỀ THỜI GIAN: Ở phần trước, câu phụ đề gần nhất đã lấy hình ảnh ở khoảng giây thứ ${lastAnchorTime.toFixed(1)}. Hãy tiếp tục tìm hình ảnh cho các câu dưới đây bắt đầu TỪ SAU GIÂY THỨ ${lastAnchorTime.toFixed(1)} TRỞ ĐI, tuyệt đối không được tua ngược lại đầu phim.\n` : ""}
NỘI DUNG YÊU CẦU:
${srtPromptList}

NHIỆM VỤ CỦA BẠN:
1. Xem video đính kèm. (Lưu ý quan trọng: Nội dung phụ đề bên trên có thể được viết bằng Tiếng Nhật hoặc ngôn ngữ khác. Hãy tự động đọc hiểu ngữ nghĩa của chúng để bốc đúng cảnh quay trong video).
2. Đối với MỖI câu, hãy tìm ĐÚNG số lượng clip yêu cầu (không thừa, không thiếu). Hình ảnh trong các clip phải liên quan đến nội dung câu nói.
3. ĐIỀU KIỆN LÁCH BẢN QUYỀN: Các clip KHÔNG được cắt liên tục một mạch (phải bị đứt gãy phân cảnh). Để lách bản quyền mà vẫn giữ được nội dung sát nghĩa, giữa các clip lấy ra chỉ cần nhảy cóc/bỏ cách nhau tối thiểu 1 giây là đủ (không cần phải cách nhau quá xa).
4. Trả về ĐỊNH DẠNG JSON MẢNG TỔNG HỢP. Kết quả cuối cùng là một mảng JSON thuần túy (không bọc trong \`\`\`json):
[
  { 
    "srt_index": ${chunkBlocks[0].index}, 
    "clips": [
       { "start_time_seconds": 15.2 },
       { "start_time_seconds": 50.1 }
    ]
  }
]`;

      const processAI = async (currentClient) => {
        // Nếu Tool vừa đổi sang API Key mới (hoặc đây là lần chạy đầu tiên)
        if (apiKeyManager.currentIndex !== lastUsedKeyIndex) {
          if (lastUsedKeyIndex !== -1) {
             sendLog(`🔄 Phát hiện Tool đã tự động đổi sang API Key số ${apiKeyManager.currentIndex + 1}. Đang tái kết nối file Video sang Key mới...`);
          }
          currentCheckFile = await uploadAndCacheVideo(currentClient, finalVideoPathToUpload, sendLog);
          lastUsedKeyIndex = apiKeyManager.currentIndex;
        }

        sendLog(`🧠 [Phần ${chunkIndex}/${totalChunks}] Đang yêu cầu AI tìm các đoạn cắt khớp với phụ đề...`);

        return await currentClient.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [
            {
              fileData: {
                mimeType: currentCheckFile.mimeType || "video/mp4",
                fileUri: currentCheckFile.uri,
              },
            },
            prompt,
          ],
        });
      };

      const response = await withRetryAndKeySwitch(apiKeyManager, sendLog, processAI);

      let jsonStr = response.text || "";
      jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();

      let chunkResults = [];
      try {
        chunkResults = JSON.parse(jsonStr);
      } catch (e) {
        sendLog(`⚠️ AI trả về dữ liệu Phần ${chunkIndex} không chuẩn JSON, đang kích hoạt bộ lọc Regex khẩn cấp...`);
        // Fallback: Quét Regex cưỡng bức để cứu vớt dữ liệu dù JSON có bị thiếu dấu phẩy hay đóng ngoặc sai
        const srtRegex = /"srt_index"\s*:\s*(\d+)[\s\S]*?"clips"\s*:\s*\[([\s\S]*?)\]/g;
        let srtMatch;
        while ((srtMatch = srtRegex.exec(jsonStr)) !== null) {
            const index = parseInt(srtMatch[1]);
            const clipsStr = srtMatch[2];
            const clips = [];
            const timeRegex = /"start_time_seconds"\s*:\s*([0-9.]+)/g;
            let timeMatch;
            while ((timeMatch = timeRegex.exec(clipsStr)) !== null) {
                clips.push({ start_time_seconds: parseFloat(timeMatch[1]) });
            }
            if (clips.length > 0) {
                chunkResults.push({ srt_index: index, clips: clips });
            }
        }
        
        if (chunkResults.length === 0) {
            throw new Error(`Cứu vớt dữ liệu thất bại ở Phần ${chunkIndex}. Lỗi gốc: ${e.message}`);
        } else {
            sendLog(`✅ Bộ lọc Regex đã bóc tách thành công ${chunkResults.length} câu phụ đề từ đống đổ nát!`);
        }
      }

      if (!Array.isArray(chunkResults) || chunkResults.length === 0) {
        throw new Error(`AI không trả về được danh sách phân đoạn nào cho Phần ${chunkIndex}.`);
      }

      allAiResults = allAiResults.concat(chunkResults);

      // Cập nhật mỏ neo thời gian (lấy start_time_seconds lớn nhất của chunk vừa rồi)
      const lastItem = chunkResults[chunkResults.length - 1];
      if (lastItem && lastItem.clips && lastItem.clips.length > 0) {
        const lastClip = lastItem.clips[lastItem.clips.length - 1];
        if (lastClip && lastClip.start_time_seconds) {
          lastAnchorTime = parseFloat(lastClip.start_time_seconds);
        }
      }

      sendLog(`✅ Đã phân tích xong Phần ${chunkIndex}/${totalChunks}!`);
      
      if (chunkIndex < totalChunks) {
        sendLog(`⏳ Đang đợi 90 giây để làm mát API (tránh lỗi Quota) trước khi chạy phần tiếp theo...`);
        await new Promise((resolve) => setTimeout(resolve, 90000));
      }
    }

    const aiResults = allAiResults;

    sendLog(
      `✅ AI đã phân tích xong. Bắt đầu đẩy lên CapCut Draft với thuật toán Random Timeline...`,
    );

    let baseName = videoNameOverride ? path.parse(videoNameOverride).name : `Auto_Anime_${Date.now()}`;
    let projectName = baseName;
    let draftPath = path.join(path.join(process.env.LOCALAPPDATA || process.env.APPDATA, "CapCut", "User Data", "Projects", "com.lveditor.draft"), projectName);
    let counter = 1;
    while(fs.existsSync(draftPath)) { projectName = `${baseName}_${counter}`; draftPath = path.join(path.join(process.env.LOCALAPPDATA || process.env.APPDATA, "CapCut", "User Data", "Projects", "com.lveditor.draft"), projectName); counter++; }

    await execPromise(`npx capcut-cli init "${projectName}"`);

    // TÌM ĐƯỜNG DẪN ABSOLUTE TỚI CAPCUT DRAFT (Windows)
    

    sendLog(`📁 Đã tạo dự án CapCut mới: ${projectName} tại ${draftPath}`);

    // Tạo thư mục tạm để chứa các clip cắt ra
    const tempClipsDir = path.join(process.cwd(), "temp_clips_" + Date.now());
    if (!fs.existsSync(tempClipsDir)) {
      fs.mkdirSync(tempClipsDir);
    }

    // Lấy tổng thời lượng video gốc để chống lỗi AI chém gió thời gian vượt quá video
    let maxDuration = 10000;
    try {
      const durStr = await execPromise(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
      );
      if (durStr && parseFloat(durStr) > 0) {
        maxDuration = parseFloat(durStr);
        sendLog(`⏱ Tổng thời lượng video gốc: ${maxDuration.toFixed(1)} giây.`);
      }
    } catch (e) {}

    let currentTimelineSec = 0; // Thời gian chạy nối tiếp trên timeline của CapCut
    let lastValidStartSeconds = 10; // Đưa ra ngoài vòng lặp để đảm bảo tịnh tiến liên tục

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const aiBlock = aiResults.find((c) => c.srt_index == block.index) || {
        clips: [],
      };
      let remainingDuration = block.targetDuration;

      let clipIdx = 0;

      while (remainingDuration > 0) {
        const minClipMs = 1500;
        const maxClipMs = 4000;
        let randomDurMs =
          Math.floor(Math.random() * (maxClipMs - minClipMs + 1)) + minClipMs;

        let useDuration = Math.min(randomDurMs, remainingDuration);
        if (remainingDuration - useDuration < 1000) {
          useDuration = remainingDuration;
        }

        let startSeconds = 0;
        if (aiBlock.clips && aiBlock.clips[clipIdx]) {
          startSeconds =
            parseFloat(aiBlock.clips[clipIdx].start_time_seconds) ||
            lastValidStartSeconds + 1;
        } else {
          startSeconds = lastValidStartSeconds + useDuration / 1000 + 1.5; // Nhảy cóc 1.5s để lách bản quyền
        }

        // CHỐNG TRÀN THỜI GIAN (AI bị ngáo hoặc tịnh tiến quá đà)
        if (startSeconds + useDuration / 1000 >= maxDuration) {
          startSeconds = 10; // Reset quay lại đầu video
        }
        lastValidStartSeconds = startSeconds;

        const startSec = startSeconds.toFixed(3);
        const durationSec = (useDuration / 1000).toFixed(3);

        // CẮT VIDEO GỐC BẰNG FFMPEG (SIÊU TỐC, ĐẢM BẢO KHÔNG BỊ LỆCH KHUNG HÌNH)
        const clipName = `clip_${block.index}_${clipIdx}.mp4`;
        const clipPath = path.join(tempClipsDir, clipName);

        try {
          sendLog(
            `✂️ Đang trích xuất đoạn ${clipName} (từ ${startSec}s, dài ${durationSec}s)...`,
          );
          // Thêm -pix_fmt yuv420p để fix lỗi màn hình đen với anime MKV 10-bit
          await execPromise(
            `ffmpeg -y -ss ${startSec} -i "${videoPath}" -t ${durationSec} -map 0:v:0 -map 0:a:0? -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac "${clipPath}"`,
          );

          // CHÈN VÀO TIMELINE CAPCUT NỐI TIẾP NHAU
          await execPromise(
            `npx capcut-cli add-video "${draftPath}" "${clipPath}" ${currentTimelineSec.toFixed(3)} ${durationSec} --force-write`,
          );

          // Cộng dồn thời gian để clip sau chèn tiếp vào đuôi clip trước
          currentTimelineSec += useDuration / 1000;
        } catch (err) {
          sendLog(
            `⚠️ Lỗi cắt/chèn đoạn video cho SRT ${block.index}: ${err.message}`,
          );
          // Vẫn phải cộng thời gian để khỏi lệch SRT
          currentTimelineSec += useDuration / 1000;
        }

        remainingDuration -= useDuration;
        clipIdx++;
      }
    }

    sendLog(`📝 Đang chèn phụ đề SRT vào timeline...`);
    try {
      await execPromise(
        `npx capcut-cli import-srt "${draftPath}" "${srtPath}" --force-write`,
      );
    } catch (err) {
      sendLog(`⚠️ Lỗi import SRT: ${err.message}`);
    }

    try {
      if (fs.existsSync(tempClipsDir)) {
        fs.rmSync(tempClipsDir, { recursive: true, force: true });
        sendLog(`🧹 Đã dọn dẹp các file video tạm.`);
      }
    } catch (e) {}

    sendLog(
      `🎉 HOÀN TẤT! Hãy mở CapCut PC lên, bạn sẽ thấy dự án "${projectName}" đã được cắt ghép sẵn!`,
    );
    
  sendLog(`🎉 Đã xuất thành công dự án CapCut: ${projectName}`);
}

app.post("/api/bulk-auto-edit-capcut", async (req, res) => {
  req.setTimeout(86400000); // 24 hours
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sendLog = (msg) => res.write(`data: ${JSON.stringify({ type: "log", message: msg })}\n\n`);

  try {
    const { pairs, chunkSize } = req.body;
    if (!pairs || pairs.length === 0) throw new Error("Không có cặp Video - SRT nào để xử lý.");

    const apiKeyManager = new ApiKeyManager(); // Đọc từ api_keys.txt

    sendLog(`🔍 Bắt đầu chạy hàng loạt ${pairs.length} tập phim (Lách bản quyền AI)...`);

    for (let i = 0; i < pairs.length; i++) {
      const { video: videoName, srt: srtName, videoPath, srtPath } = pairs[i];
      sendLog(`\n▶️ BẮT ĐẦU TẬP ${i + 1}/${pairs.length}: ${videoName}`);
      try {
        await processAutoEditEpisode(videoPath, srtPath, apiKeyManager, sendLog, videoName, chunkSize);
      } catch (err) {
        sendLog(`❌ Lỗi tập ${videoName}: ${err.message}`);
      }
    }
    
    sendLog("\n🎊 HOÀN TẤT CHẠY HÀNG LOẠT TẤT CẢ CÁC TẬP!");
    res.write(`data: ${JSON.stringify({ type: "done", message: "Tất cả đã xử lý xong!" })}\n\n`);
  } catch (error) {
    sendLog(`❌ LỖI: ${error.message}`);
    res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
  }
  res.end();
});

app.post("/api/auto-edit-capcut", async (req, res) => {
  req.setTimeout(1800000); // 30 mins
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sendLog = (msg) => res.write(`data: ${JSON.stringify({ type: "log", message: msg })}\n\n`);

  try {
    const { videoPath, srtPath, apiKey, chunkSize } = req.body;
    const apiKeyManager = new ApiKeyManager(apiKey);
    await processAutoEditEpisode(videoPath, srtPath, apiKeyManager, sendLog, "", chunkSize);
    res.write(`data: ${JSON.stringify({ type: "success", data: "Tuyệt vời! Auto Edit đã đẩy sang CapCut thành công." })}\n\n`);
  } catch (error) {
    sendLog(`❌ LỖI: ${error.message}`);
    res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
  }
  res.end();
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
