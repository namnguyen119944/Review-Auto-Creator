const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');
code = code.replace(
/const handleChooseAutoEditFolder = async \(\) => \{\s*try \{\s*const data = await window\.ipcRenderer\.invoke\("dialog:openDirectory"\);\s*if \(data && data\.path\) \{\s*setAutoEditInputDir\(data\.path\);\s*\}\s*\} catch \(err\) \{\s*console\.error\("Lỗi chọn thư mục:", err\);\s*\}\s*\};/,
`const handleChooseAutoEditFolder = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-folder");
      const data = await res.json();
      if (data.path) {
        setAutoEditInputDir(data.path);
      }
    } catch (error) {
      console.error(error);
    }
  };`
);
fs.writeFileSync('src/App.jsx', code, 'utf8');
