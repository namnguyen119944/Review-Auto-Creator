const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add autoEditPairs state
if (!code.includes('const [autoEditPairs')) {
    code = code.replace(
        'const [autoEditInputDir, setAutoEditInputDir] = useState("");',
        'const [autoEditInputDir, setAutoEditInputDir] = useState("");\n  const [autoEditPairs, setAutoEditPairs] = useState([]);'
    );
}

// 2. Modify handleChooseAutoEditFolder to fetch pairs
const newFolderHandler = `
  const handleChooseAutoEditFolder = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-folder");
      const data = await res.json();
      if (data.path) {
        setAutoEditInputDir(data.path);
        // Fetch pairs
        const scanRes = await fetch("http://localhost:3001/api/scan-auto-edit-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputDir: data.path })
        });
        const scanData = await scanRes.json();
        if (scanData.pairs) {
          setAutoEditPairs(scanData.pairs);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };
`;
code = code.replace(/const handleChooseAutoEditFolder = async \(\) => \{[\s\S]*?console\.error\(error\);\s*\}\s*\};/, newFolderHandler.trim());

// 3. Add handler to remove pair
if (!code.includes('handleRemoveAutoEditPair')) {
    const removeHandler = `
  const handleRemoveAutoEditPair = (id) => {
    setAutoEditPairs(prev => prev.filter(p => p.id !== id));
  };
`;
    code = code.replace('const handleChooseAutoEditFolder =', removeHandler + '\n  const handleChooseAutoEditFolder =');
}

// 4. Update handleBulkAutoEditCapCut to send pairs
code = code.replace(
    'body: JSON.stringify({ inputDir: autoEditInputDir })',
    'body: JSON.stringify({ pairs: autoEditPairs })'
);

// 5. Render pairs list in UI
const uiList = `
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
                    <button className="clear-btn" onClick={() => { setAutoEditInputDir(""); setAutoEditPairs([]); }} title="Xóa đường dẫn">✕</button>
                  )}
                  <button className="choose-folder-btn" onClick={handleChooseAutoEditFolder}>
                    Mở Chọn Thư Mục
                  </button>
                </div>

                {autoEditPairs.length > 0 && (
                  <div className="pairs-list" style={{ marginTop: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#a855f7', fontSize: '14px' }}>Danh sách ghép cặp ({autoEditPairs.length} tập):</h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {autoEditPairs.map((pair, idx) => (
                        <div key={pair.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px', marginBottom: '5px', borderRadius: '4px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <span style={{ color: '#fff', fontSize: '13px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>🎞️ {pair.video}</span>
                            <span style={{ color: '#aaa', fontSize: '12px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>✂️ {pair.srt}</span>
                          </div>
                          <button onClick={() => handleRemoveAutoEditPair(pair.id)} style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', marginLeft: '10px' }}>Xóa</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (`;

code = code.replace(
    /\{isBulkAutoEdit \? \([\s\S]*?\) : \(/,
    uiList
);

fs.writeFileSync('src/App.jsx', code, 'utf8');
