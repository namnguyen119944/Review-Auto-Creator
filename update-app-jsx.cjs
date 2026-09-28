const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf8');

if (!code.includes('const [isBulkAutoEdit')) {
  code = code.replace(
    /const \[autoEditVideoPath, setAutoEditVideoPath\] = useState\(""\);/,
    `const [autoEditVideoPath, setAutoEditVideoPath] = useState("");
  const [isBulkAutoEdit, setIsBulkAutoEdit] = useState(false);
  const [autoEditInputDir, setAutoEditInputDir] = useState("");`
  );
}

if (!code.includes('handleChooseAutoEditFolder')) {
  const handler = `
  const handleChooseAutoEditFolder = async () => {
    try {
      const data = await window.ipcRenderer.invoke("dialog:openDirectory");
      if (data && data.path) {
        setAutoEditInputDir(data.path);
      }
    } catch (err) {
      console.error("Lỗi chọn thư mục:", err);
    }
  };
`;
  code = code.replace(/const handleChooseAutoEditVideoFile =/, handler + '\n  const handleChooseAutoEditVideoFile =');
}

if (!code.includes('handleBulkAutoEditCapCut')) {
  const bulkFunc = `
  const handleBulkAutoEditCapCut = async () => {
    if (!autoEditInputDir) {
      alert("Vui lòng chọn thư mục chứa các video và file SRT!");
      return;
    }
    setLogs([]);
    setResponse("");
    setIsLoading(true);
    setLoadingType("bulk-auto-edit-capcut");

    try {
      const response = await fetch("http://localhost:3001/api/bulk-auto-edit-capcut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputDir: autoEditInputDir }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\\n\\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.substring(6);
            if (dataStr.trim() === "") continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.type === "log") {
                setLogs((prev) => [...prev, data.message]);
              } else if (data.type === "done") {
                setResponse(data.message);
                setIsLoading(false);
                setLoadingType("");
              } else if (data.type === "error") {
                setResponse("❌ Lỗi: " + data.message);
                setIsLoading(false);
                setLoadingType("");
              }
            } catch (e) {
              console.error("JSON parse error:", e, dataStr);
            }
          }
        }
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setResponse("❌ Có lỗi kết nối đến server.");
      setIsLoading(false);
      setLoadingType("");
    }
  };
`;
  code = code.replace(/const handleAutoEditCapCut =/, bulkFunc + '\n  const handleAutoEditCapCut =');
}

const uiReplacement = `
        {activeTab === "autoedit" && (
          <div className="tab-content">
            <div className="checkbox-group" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#ffeb3b', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={isBulkAutoEdit}
                  onChange={(e) => setIsBulkAutoEdit(e.target.checked)}
                  style={{ marginRight: '8px', transform: 'scale(1.2)' }}
                />
                CHẠY TỰ ĐỘNG HÀNG LOẠT (CHỌN THƯ MỤC CÓ VIDEO VÀ SRT)
              </label>
            </div>

            {isBulkAutoEdit ? (
              <div className="input-group">
                <div className="folder-picker-group">
                  <textarea
                    className="modern-input small-input"
                    type="text"
                    placeholder="📁 Chọn Thư mục chứa các Video & SRT..."
                    value={autoEditInputDir}
                    readOnly
                    rows="2"
                    style={{ resize: "vertical", minHeight: "45px", wordBreak: "break-all" }}
                  ></textarea>
                  {autoEditInputDir && (
                    <button className="clear-btn" onClick={() => setAutoEditInputDir("")} title="Xóa đường dẫn">✕</button>
                  )}
                  <button className="choose-folder-btn" onClick={handleChooseAutoEditFolder}>
                    Mở Chọn Thư Mục
                  </button>
                </div>
              </div>
            ) : (
              <div className="input-group">
                <div className="folder-picker-group">
                  <textarea
                    className="modern-input small-input"
                    type="text"
                    placeholder="🎞️ Chọn file video gốc (MP4, MKV)..."
                    value={autoEditVideoPath}
                    readOnly
                    rows="2"
                    style={{ resize: "vertical", minHeight: "45px", wordBreak: "break-all" }}
                  ></textarea>
                  {autoEditVideoPath && (
                    <button className="clear-btn" onClick={() => setAutoEditVideoPath("")} title="Xóa đường dẫn">✕</button>
                  )}
                  <button className="choose-folder-btn" onClick={handleChooseAutoEditVideoFile}>
                    Mở Chọn Video
                  </button>
                </div>

                <div className="folder-picker-group">
                  <textarea
                    className="modern-input small-input"
                    type="text"
                    placeholder="✂️ Chọn file phụ đề kịch bản (.srt)..."
                    value={autoEditSrtFile}
                    readOnly
                    rows="2"
                    style={{ resize: "vertical", minHeight: "45px", wordBreak: "break-all" }}
                  ></textarea>
                  {autoEditSrtFile && (
                    <button className="clear-btn" onClick={() => setAutoEditSrtFile("")} title="Xóa file">✕</button>
                  )}
                  <button className="choose-folder-btn" style={{ background: "#9333ea" }} onClick={handleChooseSrtFile}>
                    Chọn SRT
                  </button>
                </div>
              </div>
            )}

            <div className="action-buttons">
              <button
                className={\`generate-btn btn-script \${(isLoading && (loadingType === "auto-edit-capcut" || loadingType === "bulk-auto-edit-capcut")) ? "loading" : ""}\`}
                style={{ width: "100%", marginBottom: "15px", background: "linear-gradient(45deg, #9333ea, #7e22ce)", border: "none" }}
                onClick={isBulkAutoEdit ? handleBulkAutoEditCapCut : handleAutoEditCapCut}
                disabled={isLoading}
              >
                {(isLoading && (loadingType === "auto-edit-capcut" || loadingType === "bulk-auto-edit-capcut")) ? (
                  <span className="loading-text">⏳ Đang xử lý...</span>
                ) : (
                  <span>✂️ TẠO DRAFT CAPCUT TỰ ĐỘNG</span>
                )}
              </button>
            </div>
`;

const oldUI = `        {activeTab === "autoedit" && (
          <div className="tab-content">
            <div className="input-group">
              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="🎞️ Chọn file video gốc (MP4, MKV)..."
                  value={autoEditVideoPath}
                  readOnly
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
                {autoEditVideoPath && (
                  <button
                    className="clear-btn"
                    onClick={() => setAutoEditVideoPath("")}
                    title="Xóa đường dẫn"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="choose-folder-btn"
                  onClick={handleChooseAutoEditVideoFile}
                >
                  Mở Chọn Video
                </button>
              </div>

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="✂️ Chọn file phụ đề kịch bản (.srt)..."
                  value={autoEditSrtFile}
                  readOnly
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
                {autoEditSrtFile && (
                  <button
                    className="clear-btn"
                    onClick={() => setAutoEditSrtFile("")}
                    title="Xóa file"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="choose-folder-btn"
                  style={{ background: "#9333ea" }}
                  onClick={handleChooseSrtFile}
                >
                  Chọn SRT
                </button>
              </div>

              <div className="action-buttons">
                <button
                  className={\`generate-btn btn-script \${isLoading && loadingType === "auto-edit-capcut" ? "loading" : ""}\`}
                  style={{
                    width: "100%",
                    marginBottom: "15px",
                    background: "linear-gradient(45deg, #9333ea, #7e22ce)",
                    border: "none",
                  }}
                  onClick={handleAutoEditCapCut}
                  disabled={isLoading}
                >
                  {isLoading && loadingType === "auto-edit-capcut" ? (
                    <span className="loading-text">⏳ Đang xử lý...</span>
                  ) : (
                    <span>✂️ TẠO DRAFT CAPCUT TỰ ĐỘNG</span>
                  )}
                </button>
              </div>`;

if (!code.includes('CHẠY TỰ ĐỘNG HÀNG LOẠT (CHỌN THƯ MỤC CÓ VIDEO VÀ SRT)')) {
  code = code.replace(oldUI, uiReplacement);
  fs.writeFileSync('src/App.jsx', code, 'utf8');
  console.log("Updated App.jsx successfully!");
} else {
  console.log("App.jsx already updated!");
}
