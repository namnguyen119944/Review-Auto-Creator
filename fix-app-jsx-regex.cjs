const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const regex = /\{activeTab === "autoedit" && \(\s*<div className="tab-content">\s*<div className="input-group">[\s\S]*?<\/button>\s*<\/div>\s*<\/div>\s*\{logs\.length > 0/g;

const uiReplacement = `{activeTab === "autoedit" && (
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
                  <span className="btn-text">
                    {(isLoading && (loadingType === "auto-edit-capcut" || loadingType === "bulk-auto-edit-capcut"))
                      ? "AI ĐANG CẮT GHÉP..."
                      : "✂️ AUTO EDIT: ĐẨY LÊN CAPCUT DRAFT (LÁCH BẢN QUYỀN)"}
                  </span>
                  <div className="btn-glow"></div>
              </button>
            </div>
          </div>
        )}

        {logs.length > 0`;

if (regex.test(code)) {
    code = code.replace(regex, uiReplacement);
    fs.writeFileSync('src/App.jsx', code, 'utf8');
    console.log("Replaced UI successfully");
} else {
    console.log("Regex did not match");
}
