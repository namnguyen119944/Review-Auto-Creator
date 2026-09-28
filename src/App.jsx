import React, { useState, useEffect } from "react";
import "./index.css";

function App() {
  const [activeTab, setActiveTab] = useState("truyen"); // 'truyen' or 'phim'

  // States cho Review Truyện
  const [url, setUrl] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [loreFile, setLoreFile] = useState("");
  const [scriptName, setScriptName] = useState("");
  const [chunkSize, setChunkSize] = useState("4");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState("");
  const [logs, setLogs] = useState([]);

  // States cho Review Phim
  const [videoPath, setVideoPath] = useState("");
  const [movieOutputDir, setMovieOutputDir] = useState("");
  const [movieLoreFile, setMovieLoreFile] = useState("");
  const [movieScriptName, setMovieScriptName] = useState("");
  const [movieName, setMovieName] = useState("");
  const [skipLoreUpdate, setSkipLoreUpdate] = useState(false);
  const [translateToJP, setTranslateToJP] = useState(true);
  const [includeHook, setIncludeHook] = useState(true);
  const [includeOutro, setIncludeOutro] = useState(true);
  const [movieWordCount, setMovieWordCount] = useState("1.500 đến 2.000");

  // States chuyên biệt cho Anime
  const [animeVideoPath, setAnimeVideoPath] = useState("");
  const [animeOutputDir, setAnimeOutputDir] = useState("");
  const [animeLoreFile, setAnimeLoreFile] = useState("");
  const [animeScriptName, setAnimeScriptName] = useState("");
  const [animeName, setAnimeName] = useState("");
  const [animeSkipLoreUpdate, setAnimeSkipLoreUpdate] = useState(false);
  const [hasHook, setHasHook] = useState(true);
  const [hasOutro, setHasOutro] = useState(true);
  const [isBulkAnime, setIsBulkAnime] = useState(false);
  const [animeInputFolder, setAnimeInputFolder] = useState("");

  // States chuyên biệt cho Auto Edit CapCut
  const [autoEditVideoPath, setAutoEditVideoPath] = useState("");
  const [isBulkAutoEdit, setIsBulkAutoEdit] = useState(false);
  const [autoEditInputDir, setAutoEditInputDir] = useState("");
  const [autoEditPairs, setAutoEditPairs] = useState([]);
  const [autoEditSrtFile, setAutoEditSrtFile] = useState("");
  const [autoEditChunkSize, setAutoEditChunkSize] = useState("80");
  // Load cache khi khởi động
  useEffect(() => {
    const savedUrl = localStorage.getItem("savedUrl");
    const savedOutputDir = localStorage.getItem("savedOutputDir");
    const savedLoreFile = localStorage.getItem("savedLoreFile");
    const savedScriptName = localStorage.getItem("savedScriptName");
    const savedChunkSize = localStorage.getItem("savedChunkSize");

    if (savedUrl) setUrl(savedUrl);
    if (savedOutputDir) setOutputDir(savedOutputDir);
    if (savedLoreFile) setLoreFile(savedLoreFile);
    if (savedScriptName) setScriptName(savedScriptName);
    if (savedChunkSize) setChunkSize(savedChunkSize);

    const savedVideoPath = localStorage.getItem("savedVideoPath");
    const savedMovieOutputDir = localStorage.getItem("savedMovieOutputDir");
    const savedMovieLoreFile = localStorage.getItem("savedMovieLoreFile");
    const savedMovieScriptName = localStorage.getItem("savedMovieScriptName");
    const savedMovieName = localStorage.getItem("savedMovieName");
    const savedTranslateToJP = localStorage.getItem("savedTranslateToJP");
    const savedIncludeHook = localStorage.getItem("savedIncludeHook");
    const savedIncludeOutro = localStorage.getItem("savedIncludeOutro");
    const savedMovieWordCount = localStorage.getItem("savedMovieWordCount");

    if (savedVideoPath) setVideoPath(savedVideoPath);
    if (savedMovieOutputDir) setMovieOutputDir(savedMovieOutputDir);
    if (savedMovieLoreFile) setMovieLoreFile(savedMovieLoreFile);
    if (savedMovieScriptName) setMovieScriptName(savedMovieScriptName);
    if (savedMovieName) setMovieName(savedMovieName);
    if (savedTranslateToJP !== null)
      setTranslateToJP(savedTranslateToJP === "true");
    if (savedIncludeHook !== null) setIncludeHook(savedIncludeHook === "true");
    if (savedIncludeOutro !== null) setIncludeOutro(savedIncludeOutro === "true");
    if (savedMovieWordCount) setMovieWordCount(savedMovieWordCount);

    // Anime cache
    const savedAnimeVideoPath = localStorage.getItem("savedAnimeVideoPath");
    const savedAnimeOutputDir = localStorage.getItem("savedAnimeOutputDir");
    const savedAnimeLoreFile = localStorage.getItem("savedAnimeLoreFile");
    const savedAnimeScriptName = localStorage.getItem("savedAnimeScriptName");
    const savedAnimeName = localStorage.getItem("savedAnimeName");
    const savedAnimeInputFolder = localStorage.getItem("savedAnimeInputFolder");

    if (savedAnimeVideoPath) setAnimeVideoPath(savedAnimeVideoPath);
    if (savedAnimeOutputDir) setAnimeOutputDir(savedAnimeOutputDir);
    if (savedAnimeLoreFile) setAnimeLoreFile(savedAnimeLoreFile);
    if (savedAnimeScriptName) setAnimeScriptName(savedAnimeScriptName);
    if (savedAnimeName) setAnimeName(savedAnimeName);
    if (savedAnimeInputFolder) setAnimeInputFolder(savedAnimeInputFolder);

    // Auto Edit cache
    const savedAutoEditVideoPath = localStorage.getItem(
      "savedAutoEditVideoPath",
    );
    const savedAutoEditSrtFile = localStorage.getItem("savedAutoEditSrtFile");
    const savedAutoEditChunkSize = localStorage.getItem("savedAutoEditChunkSize");

    if (savedAutoEditVideoPath) setAutoEditVideoPath(savedAutoEditVideoPath);
    if (savedAutoEditSrtFile) setAutoEditSrtFile(savedAutoEditSrtFile);
    if (savedAutoEditChunkSize) setAutoEditChunkSize(savedAutoEditChunkSize);
  }, []);

  // Lưu cache mỗi khi thay đổi
  useEffect(() => {
    localStorage.setItem("savedUrl", url);
    localStorage.setItem("savedOutputDir", outputDir);
    localStorage.setItem("savedLoreFile", loreFile);
    localStorage.setItem("savedScriptName", scriptName);
    localStorage.setItem("savedChunkSize", chunkSize);
  }, [url, outputDir, loreFile, scriptName, chunkSize]);

  useEffect(() => {
    localStorage.setItem("savedVideoPath", videoPath);
    localStorage.setItem("savedMovieOutputDir", movieOutputDir);
    localStorage.setItem("savedMovieLoreFile", movieLoreFile);
    localStorage.setItem("savedMovieScriptName", movieScriptName);
    localStorage.setItem("savedMovieName", movieName);
    localStorage.setItem("savedTranslateToJP", translateToJP);
    localStorage.setItem("savedIncludeHook", includeHook);
    localStorage.setItem("savedIncludeOutro", includeOutro);
    localStorage.setItem("savedMovieWordCount", movieWordCount);
  }, [
    videoPath,
    movieOutputDir,
    movieLoreFile,
    movieScriptName,
    movieName,
    translateToJP,
    includeHook,
    includeOutro,
    movieWordCount
  ]);

  useEffect(() => {
    localStorage.setItem("savedAnimeVideoPath", animeVideoPath);
    localStorage.setItem("savedAnimeOutputDir", animeOutputDir);
    localStorage.setItem("savedAnimeLoreFile", animeLoreFile);
    localStorage.setItem("savedAnimeScriptName", animeScriptName);
    localStorage.setItem("savedAnimeName", animeName);
    localStorage.setItem("savedAnimeInputFolder", animeInputFolder);
  }, [
    animeVideoPath,
    animeOutputDir,
    animeLoreFile,
    animeScriptName,
    animeName,
    animeInputFolder,
  ]);

  useEffect(() => {
    localStorage.setItem("savedAutoEditVideoPath", autoEditVideoPath);
    localStorage.setItem("savedAutoEditSrtFile", autoEditSrtFile);
    localStorage.setItem("savedAutoEditChunkSize", autoEditChunkSize);
  }, [autoEditVideoPath, autoEditSrtFile, autoEditChunkSize]);

  const handleChooseFolder = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-folder");
      const data = await res.json();
      if (data.path) {
        setOutputDir(data.path);
      }
    } catch (error) {
      console.error(error);
      alert(
        "Không thể mở hộp thoại chọn thư mục. Hãy chắc chắn Backend đang chạy.",
      );
    }
  };

  const handleChooseFile = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-file");
      const data = await res.json();
      if (data.path) {
        setLoreFile(data.path);
      }
    } catch (error) {
      console.error(error);
      alert(
        "Không thể mở hộp thoại chọn file. Hãy chắc chắn Backend đang chạy.",
      );
    }
  };

  const handleChooseVideoFile = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-video-file");
      const data = await res.json();
      if (data.path) {
        setVideoPath(data.path);
      }
    } catch (error) {
      console.error(error);
      alert("Không thể mở hộp thoại chọn video.");
    }
  };

  const handleChooseMovieFolder = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-folder");
      const data = await res.json();
      if (data.path) {
        setMovieOutputDir(data.path);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleChooseMovieLoreFile = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-file");
      const data = await res.json();
      if (data.path) {
        setMovieLoreFile(data.path);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const [animeVideoPaths, setAnimeVideoPaths] = useState([]);

  const handleChooseMultipleAnimeFiles = async () => {
    try {
      const res = await fetch(
        "http://localhost:3001/api/choose-multiple-video-files",
      );
      const data = await res.json();
      if (data.paths && data.paths.length > 0) {
        setAnimeVideoPaths(data.paths);
        setAnimeInputFolder(""); // Clear folder input if files are selected
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleChooseAnimeInputFolder = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-folder");
      const data = await res.json();
      if (data.path) {
        setAnimeInputFolder(data.path);
        setAnimeVideoPaths([]); // Clear files input if folder is selected
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleChooseAnimeVideoFile = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-video-file");
      const data = await res.json();
      if (data.path) {
        setAnimeVideoPath(data.path);
      }
    } catch (error) {
      console.error(error);
      alert("Không thể mở hộp thoại chọn video.");
    }
  };

  const handleChooseAnimeFolder = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-folder");
      const data = await res.json();
      if (data.path) {
        setAnimeOutputDir(data.path);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleChooseAnimeLoreFile = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-file");
      const data = await res.json();
      if (data.path) {
        setAnimeLoreFile(data.path);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleBulkAnimeScript = async () => {
    if (
      !animeInputFolder &&
      (!animeVideoPaths || animeVideoPaths.length === 0)
    ) {
      alert("Vui lòng chọn thư mục hoặc chọn các video anime!");
      return;
    }
    if (!animeOutputDir) {
      alert("Vui lòng chọn thư mục lưu kịch bản đầu ra!");
      return;
    }

    setIsLoading(true);
    setLoadingType("bulk-anime-script");
    setResponse("");
    setLogs([]);

    try {
      const response = await fetch("http://localhost:3001/api/bulk-anime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputDir: animeInputFolder,
          videoPaths: animeVideoPaths,
          outputDir: animeOutputDir,
          loreFilePath: animeLoreFile,
          skipLoreUpdate: animeSkipLoreUpdate,
          movieName: animeName,
        }),
      });
      await processStreamResponse(response);
    } catch (error) {
      console.error("Lỗi khi gọi Backend:", error);
      setResponse("❌ Đã xảy ra lỗi kết nối với Backend nội bộ.");
      setIsLoading(false);
      setLoadingType("");
    }
  };

  const handleGenerateMovieScript = async () => {
    if (!videoPath) {
      alert("Vui lòng chọn video phim!");
      return;
    }
    if (!movieOutputDir) {
      alert("Vui lòng chọn thư mục lưu kịch bản!");
      return;
    }

    setIsLoading(true);
    setLoadingType("movie-script");
    setResponse("");
    setLogs([]);

    try {
      const response = await fetch(
        "http://localhost:3001/api/generate-movie-script",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoPath,
            outputDir: movieOutputDir,
            loreFilePath: movieLoreFile,
            scriptName: movieScriptName,
            skipLoreUpdate,
            translateToJP,
            movieName,
            includeHook,
            includeOutro,
            movieWordCount
          }),
        },
      );
      await processStreamResponse(response);
    } catch (error) {
      console.error("Lỗi khi gọi Backend:", error);
      setResponse("❌ Đã xảy ra lỗi kết nối với Backend nội bộ.");
      setIsLoading(false);
      setLoadingType("");
    }
  };

  const handleGenerateAnimeScript = async () => {
    if (!animeVideoPath) {
      alert("Vui lòng chọn video anime!");
      return;
    }
    if (!animeOutputDir) {
      alert("Vui lòng chọn thư mục lưu kịch bản!");
      return;
    }

    setIsLoading(true);
    setLoadingType("anime-script");
    setResponse("");
    setLogs([]);

    try {
      const response = await fetch(
        "http://localhost:3001/api/generate-anime-script",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoPath: animeVideoPath,
            outputDir: animeOutputDir,
            loreFilePath: animeLoreFile,
            scriptName: animeScriptName,
            skipLoreUpdate: animeSkipLoreUpdate,
            movieName: animeName,
            hasHook,
            hasOutro,
          }),
        },
      );
      await processStreamResponse(response);
    } catch (error) {
      console.error("Lỗi khi gọi Backend:", error);
      setResponse("❌ Đã xảy ra lỗi kết nối với Backend nội bộ.");
      setIsLoading(false);
      setLoadingType("");
    }
  };

  const handleChooseSrtFile = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-srt-file");
      const data = await res.json();
      if (data.path) {
        setAutoEditSrtFile(data.path);
      }
    } catch (error) {
      console.error(error);
    }
  };

  
  
  const handleRemoveAutoEditPair = (id) => {
    setAutoEditPairs(prev => prev.filter(p => p.id !== id));
  };

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

  const handleChooseAutoEditVideoFile = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/choose-video-file");
      const data = await res.json();
      if (data.path) {
        setAutoEditVideoPath(data.path);
      }
    } catch (error) {
      console.error(error);
    }
  };

  
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
        body: JSON.stringify({ pairs: autoEditPairs, chunkSize: autoEditChunkSize }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");
        
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

  const handleAutoEditCapCut = async () => {
    if (!autoEditVideoPath || !autoEditSrtFile) {
      alert("Vui lòng chọn Video và File phụ đề (.srt)!");
      return;
    }

    setIsLoading(true);
    setLoadingType("auto-edit-capcut");
    setResponse("");
    setLogs([]);

    try {
      const response = await fetch(
        "http://localhost:3001/api/auto-edit-capcut",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoPath: autoEditVideoPath,
            srtPath: autoEditSrtFile,
            chunkSize: autoEditChunkSize,
          }),
        },
      );
      await processStreamResponse(response);
    } catch (error) {
      console.error("Lỗi khi gọi Backend:", error);
      setResponse("❌ Đã xảy ra lỗi kết nối với Backend nội bộ.");
      setIsLoading(false);
      setLoadingType("");
    }
  };

  const processStreamResponse = async (response) => {
    if (!response.ok) {
      setResponse(
        `❌ LỖI HỆ THỐNG: Máy chủ phản hồi mã ${response.status}. Có thể bạn chưa khởi động lại Tool đúng cách.`,
      );
      setIsLoading(false);
      setLoadingType("");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          setIsLoading(false);
          setLoadingType("");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop(); // Keep the last incomplete part in the buffer

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            try {
              const data = JSON.parse(part.substring(6));
              if (data.type === "log") {
                setLogs((prev) => [...prev, data.message]);
              } else if (data.type === "success") {
                setResponse(data.data);
              } else if (data.type === "error") {
                setResponse(`❌ LỖI: ${data.message}`);
              }
            } catch (e) {
              console.error("Lỗi parse JSON:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Lỗi khi đọc stream:", error);
      setResponse("❌ Đã xảy ra lỗi kết nối với Backend nội bộ.");
      setIsLoading(false);
      setLoadingType("");
    }
  };

  const handleDownload = async () => {
    if (!url.trim() || !url.startsWith("http")) {
      alert("Vui lòng nhập một URL hợp lệ!");
      return;
    }
    if (!outputDir) {
      alert("Vui lòng chọn thư mục lưu ảnh!");
      return;
    }

    setIsLoading(true);
    setLoadingType("download");
    setResponse("");
    setLogs([]);

    try {
      const response = await fetch("http://localhost:3001/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, outputDir }),
      });
      await processStreamResponse(response);
    } catch (error) {
      console.error("Lỗi khi gọi Backend:", error);
      setResponse("❌ Đã xảy ra lỗi kết nối với Backend nội bộ.");
      setIsLoading(false);
      setLoadingType("");
    }
  };

  const handleGenerateScript = async () => {
    if (!outputDir) {
      alert("Vui lòng chọn thư mục chứa ảnh truyện (bấm Mở Chọn Thư Mục)!");
      return;
    }

    setIsLoading(true);
    setLoadingType("script");
    setResponse("");
    setLogs([]);

    try {
      const response = await fetch(
        "http://localhost:3001/api/generate-from-folder",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderPath: outputDir,
            loreFilePath: loreFile,
            scriptName: scriptName,
            chunkSize,
          }),
        },
      );
      await processStreamResponse(response);
    } catch (error) {
      console.error("Lỗi khi gọi Backend:", error);
      setResponse("❌ Đã xảy ra lỗi kết nối với Backend nội bộ.");
      setIsLoading(false);
      setLoadingType("");
    }
  };

  return (
    <div className="app-container">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <div className="glass-panel">
        <header className="header">
          <div className="logo-glow"></div>
          <h1>
            {activeTab === "truyen"
              ? "Comic Review Auto-Creator"
              : activeTab === "phim"
                ? "Movie Review Auto-Creator"
                : "Anime Review Auto-Creator"}
          </h1>
          <p>
            {activeTab === "truyen"
              ? "Tải ảnh & Viết kịch bản tự động"
              : activeTab === "phim"
                ? "Tạo kịch bản review phim chuyên nghiệp"
                : "Tạo kịch bản tóm tắt anime cực cuốn"}
          </p>
        </header>

        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === "truyen" ? "active" : ""}`}
            onClick={() => setActiveTab("truyen")}
          >
            Review Truyện
          </button>
          <button
            className={`tab-btn ${activeTab === "phim" ? "active" : ""}`}
            onClick={() => setActiveTab("phim")}
          >
            Review Phim
          </button>
          <button
            className={`tab-btn ${activeTab === "anime" ? "active" : ""}`}
            onClick={() => setActiveTab("anime")}
          >
            Review Anime
          </button>
          <button
            className={`tab-btn ${activeTab === "autoedit" ? "active" : ""}`}
            onClick={() => setActiveTab("autoedit")}
          >
            ✂️ Auto Edit
          </button>
        </div>

        {activeTab === "truyen" && (
          <div className="tab-content">
            <div className="input-group">
              <textarea
                className="modern-input"
                style={{ height: "120px", resize: "vertical" }}
                placeholder="🔗 Dán danh sách link Chapter truyện tranh vào đây (Mỗi link 1 dòng)&#10;Cú pháp tùy chọn: <Link> | <Tên Chap>"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="📁 Chọn thư mục lưu (Tool sẽ tạo các thư mục con bên trong)..."
                  value={outputDir}
                  readOnly
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
                {outputDir && (
                  <button
                    className="clear-btn"
                    onClick={() => setOutputDir("")}
                    title="Xóa đường dẫn"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="choose-folder-btn"
                  onClick={handleChooseFolder}
                >
                  Mở Chọn Thư Mục
                </button>
              </div>

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="📄 [Tùy chọn] Chọn file Tóm tắt nhân vật xuyên suốt (.txt)..."
                  value={loreFile}
                  readOnly
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
                {loreFile && (
                  <button
                    className="clear-btn"
                    onClick={() => setLoreFile("")}
                    title="Xóa file"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="choose-folder-btn"
                  onClick={handleChooseFile}
                >
                  Chọn File
                </button>
              </div>

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="✍️ [Tùy chọn] Tên file kịch bản xuất ra (Bỏ qua nếu chạy Hàng loạt)"
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
                {scriptName && (
                  <button
                    className="clear-btn"
                    onClick={() => setScriptName("")}
                    title="Xóa tên file"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="number"
                  placeholder="⚙️ Số lượng ảnh gộp chung trong 1 lần gửi cho AI (Mặc định: 4, giảm nếu lỗi)"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(e.target.value)}
                  min="1"
                  max="50"
                />
              </div>

              <div className="action-buttons">
                <button
                  className={`generate-btn btn-download ${isLoading && loadingType === "download" ? "loading" : ""}`}
                  onClick={handleDownload}
                  disabled={isLoading}
                >
                  <span className="btn-text">
                    {isLoading && loadingType === "download"
                      ? "Đang tải..."
                      : "⬇️ BƯỚC 1: Tải ảnh (1 Chap)"}
                  </span>
                  <div className="btn-glow"></div>
                </button>

                <button
                  className={`generate-btn btn-script ${isLoading && loadingType === "script" ? "loading" : ""}`}
                  onClick={handleGenerateScript}
                  disabled={isLoading}
                >
                  <span className="btn-text">
                    {isLoading && loadingType === "script"
                      ? "AI đang viết..."
                      : "✍️ BƯỚC 2: Viết kịch bản (1 Chap)"}
                  </span>
                  <div className="btn-glow"></div>
                </button>
              </div>

              <div className="action-buttons" style={{ marginTop: "15px" }}>
                <button
                  className={`generate-btn ${isLoading && loadingType === "bulk" ? "loading" : ""}`}
                  style={{
                    width: "100%",
                    background: "linear-gradient(45deg, #10b981, #059669)",
                    border: "none",
                  }}
                  onClick={async () => {
                    if (!url.trim() || !outputDir) {
                      alert(
                        "Vui lòng dán danh sách URL và chọn thư mục lưu ảnh!",
                      );
                      return;
                    }
                    setIsLoading(true);
                    setLoadingType("bulk");
                    setResponse("");
                    setLogs([]);
                    try {
                      const response = await fetch(
                        "http://localhost:3001/api/bulk-process",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            urlText: url,
                            outputDir,
                            loreFilePath: loreFile,
                            chunkSize,
                          }),
                        },
                      );
                      await processStreamResponse(response);
                    } catch (error) {
                      console.error("Lỗi khi gọi Backend:", error);
                      setResponse(
                        "❌ Đã xảy ra lỗi kết nối với Backend nội bộ.",
                      );
                      setIsLoading(false);
                      setLoadingType("");
                    }
                  }}
                  disabled={isLoading}
                >
                  <span className="btn-text">
                    {isLoading && loadingType === "bulk"
                      ? "Đang chạy tự động..."
                      : "🚀 CHẠY TỰ ĐỘNG TOÀN BỘ (TẢI ẢNH + VIẾT KỊCH BẢN CHUỖI)"}
                  </span>
                  <div className="btn-glow"></div>
                </button>
              </div>
            </div>

            {logs.length > 0 && (
              <div className="logs-container">
                {logs.map((log, index) => (
                  <div key={index} className="log-line">
                    {log}
                  </div>
                ))}
              </div>
            )}

            {response && (
              <div className="response-container">
                <h3 className="response-title">KẾT QUẢ KỊCH BẢN:</h3>
                <div className="response-content">{response}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === "phim" && (
          <div className="tab-content">
            <div className="input-group">
              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="🎞️ Chọn file video phim (MP4, MKV, AVI, MOV)..."
                  value={videoPath}
                  readOnly
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
                {videoPath && (
                  <button
                    className="clear-btn"
                    onClick={() => setVideoPath("")}
                    title="Xóa đường dẫn"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="choose-folder-btn"
                  onClick={handleChooseVideoFile}
                >
                  Mở Chọn Video
                </button>
              </div>

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="📝 Chọn thư mục lưu kịch bản đầu ra..."
                  value={movieOutputDir}
                  readOnly
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
                {movieOutputDir && (
                  <button
                    className="clear-btn"
                    onClick={() => setMovieOutputDir("")}
                    title="Xóa đường dẫn"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="choose-folder-btn"
                  onClick={handleChooseMovieFolder}
                >
                  Chọn Thư Mục
                </button>
              </div>

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="📄 [Tùy chọn] Chọn file Tom_Tat_Nhan_Vat.txt..."
                  value={movieLoreFile}
                  readOnly
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
                {movieLoreFile && (
                  <button
                    className="clear-btn"
                    onClick={() => setMovieLoreFile("")}
                    title="Xóa file"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="choose-folder-btn"
                  onClick={handleChooseMovieLoreFile}
                >
                  Chọn File
                </button>
              </div>

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="✏️ [Tùy chọn] Nhập tên file kịch bản đầu ra (VD: KichBan_Tap1)"
                  value={movieScriptName}
                  onChange={(e) => setMovieScriptName(e.target.value)}
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
              </div>

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="✏️ [Tùy chọn] Tên phim (Giúp AI phiên âm Katakana chính xác hơn)"
                  value={movieName}
                  onChange={(e) => setMovieName(e.target.value)}
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
              </div>

              <div className="folder-picker-group">
                <input
                  className="modern-input small-input"
                  type="text"
                  placeholder="⚙️ Giới hạn số từ (VD: 1.500 đến 2.000, hoặc 3.000 đến 4.000)"
                  value={movieWordCount}
                  onChange={(e) => setMovieWordCount(e.target.value)}
                />
              </div>

              <div
                className="checkbox-group"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                  marginBottom: "20px",
                  padding: "0 5px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    id="skipLoreUpdate"
                    checked={skipLoreUpdate}
                    onChange={(e) => setSkipLoreUpdate(e.target.checked)}
                    style={{
                      marginRight: "10px",
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="skipLoreUpdate"
                    style={{
                      color: "#ccc",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    ⚡ Bỏ qua bước quét nhân vật (Chạy thẳng bước Viết kịch bản)
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    id="includeHook"
                    checked={includeHook}
                    onChange={(e) => setIncludeHook(e.target.checked)}
                    style={{
                      marginRight: "10px",
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="includeHook"
                    style={{
                      color: "#ccc",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    🎬 Viết đoạn mở đầu (Hook giật gân)
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    id="includeOutro"
                    checked={includeOutro}
                    onChange={(e) => setIncludeOutro(e.target.checked)}
                    style={{
                      marginRight: "10px",
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="includeOutro"
                    style={{
                      color: "#ccc",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    🏁 Viết đoạn kết (Câu chào Outro)
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    id="translateToJP"
                    checked={translateToJP}
                    onChange={(e) => setTranslateToJP(e.target.checked)}
                    style={{
                      marginRight: "10px",
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="translateToJP"
                    style={{
                      color: "#ccc",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    🇯🇵 Tự động Dịch sang Tiếng Nhật (Sau khi viết xong Tiếng Việt)
                  </label>
                </div>
              </div>

              <div className="action-buttons">
                <button
                  className={`generate-btn btn-script ${isLoading && loadingType === "movie-script" ? "loading" : ""}`}
                  onClick={handleGenerateMovieScript}
                  disabled={isLoading}
                >
                  <span className="btn-text">
                    {isLoading && loadingType === "movie-script"
                      ? "AI đang phân tích & viết..."
                      : "✍️ Bắt Đầu Viết Kịch Bản Phim"}
                  </span>
                  <div className="btn-glow"></div>
                </button>
              </div>
            </div>

            {logs.length > 0 && (
              <div className="logs-container">
                {logs.map((log, index) => (
                  <div key={index} className="log-line">
                    {log}
                  </div>
                ))}
              </div>
            )}

            {response && (
              <div className="response-container">
                <h3 className="response-title">KẾT QUẢ KỊCH BẢN PHIM:</h3>
                <div className="response-content">{response}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === "anime" && (
          <div className="tab-content">
            <div className="input-group">
              <div
                className="checkbox-group"
                style={{
                  display: "flex",
                  gap: "15px",
                  marginBottom: "15px",
                  padding: "0 5px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    id="isBulkAnime"
                    checked={isBulkAnime}
                    onChange={(e) => setIsBulkAnime(e.target.checked)}
                    style={{
                      marginRight: "10px",
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="isBulkAnime"
                    style={{
                      color: "#ffeb3b",
                      cursor: "pointer",
                      userSelect: "none",
                      fontWeight: "bold",
                    }}
                  >
                    🚀 CHẠY TỰ ĐỘNG HÀNG LOẠT (CẢ FOLDER ANIME)
                  </label>
                </div>
              </div>

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder={
                    isBulkAnime
                      ? "📁 Chọn Thư mục chứa các Video HOẶC Chọn Nhiều Video..."
                      : "🎞️ Chọn file video anime (MP4, MKV, AVI, MOV)..."
                  }
                  value={
                    isBulkAnime
                      ? animeVideoPaths.length > 0
                        ? `Đã chọn ${animeVideoPaths.length} video`
                        : animeInputFolder
                      : animeVideoPath
                  }
                  readOnly
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
                {(isBulkAnime
                  ? animeInputFolder || animeVideoPaths.length > 0
                  : animeVideoPath) && (
                  <button
                    className="clear-btn"
                    onClick={() =>
                      isBulkAnime
                        ? (setAnimeInputFolder(""), setAnimeVideoPaths([]))
                        : setAnimeVideoPath("")
                    }
                    title="Xóa đường dẫn"
                  >
                    ✕
                  </button>
                )}
                {isBulkAnime ? (
                  <>
                    <button
                      className="choose-folder-btn"
                      onClick={handleChooseAnimeInputFolder}
                      style={{ marginRight: "5px" }}
                    >
                      Chọn Thư Mục
                    </button>
                    <button
                      className="choose-folder-btn"
                      style={{ background: "#3b82f6" }}
                      onClick={handleChooseMultipleAnimeFiles}
                    >
                      Chọn Nhiều Video
                    </button>
                  </>
                ) : (
                  <button
                    className="choose-folder-btn"
                    onClick={handleChooseAnimeVideoFile}
                  >
                    Mở Chọn Video
                  </button>
                )}
              </div>

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="📝 Chọn thư mục lưu kịch bản đầu ra..."
                  value={animeOutputDir}
                  readOnly
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
                {animeOutputDir && (
                  <button
                    className="clear-btn"
                    onClick={() => setAnimeOutputDir("")}
                    title="Xóa đường dẫn"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="choose-folder-btn"
                  onClick={handleChooseAnimeFolder}
                >
                  Chọn Thư Mục
                </button>
              </div>

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="📄 [Tùy chọn] Chọn file Tom_Tat_Nhan_Vat.txt..."
                  value={animeLoreFile}
                  readOnly
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
                {animeLoreFile && (
                  <button
                    className="clear-btn"
                    onClick={() => setAnimeLoreFile("")}
                    title="Xóa file"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="choose-folder-btn"
                  onClick={handleChooseAnimeLoreFile}
                >
                  Chọn File
                </button>
              </div>

              {!isBulkAnime && (
                <div className="folder-picker-group">
                  <textarea
                    className="modern-input small-input"
                    type="text"
                    placeholder="✏️ [Tùy chọn] Nhập tên file kịch bản đầu ra (VD: KichBan_Tap1)"
                    value={animeScriptName}
                    onChange={(e) => setAnimeScriptName(e.target.value)}
                    rows="2"
                    style={{
                      resize: "vertical",
                      minHeight: "45px",
                      wordBreak: "break-all",
                    }}
                  ></textarea>
                </div>
              )}

              <div className="folder-picker-group">
                <textarea
                  className="modern-input small-input"
                  type="text"
                  placeholder="✏️ [Tùy chọn] Tên Anime (Giúp AI nhận diện nhân vật tốt hơn)"
                  value={animeName}
                  onChange={(e) => setAnimeName(e.target.value)}
                  rows="2"
                  style={{
                    resize: "vertical",
                    minHeight: "45px",
                    wordBreak: "break-all",
                  }}
                ></textarea>
              </div>

              <div
                className="checkbox-group"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                  marginBottom: "20px",
                  padding: "0 5px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <textarea
                    type="checkbox"
                    id="animeSkipLoreUpdate"
                    checked={animeSkipLoreUpdate}
                    onChange={(e) => setAnimeSkipLoreUpdate(e.target.checked)}
                    style={{
                      marginRight: "10px",
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="animeSkipLoreUpdate"
                    style={{
                      color: "#ccc",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    ⚡ Bỏ qua bước quét nhân vật (Chạy thẳng bước Viết kịch bản)
                  </label>
                </div>

                {!isBulkAnime && (
                  <>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        id="hasHook"
                        checked={hasHook}
                        onChange={(e) => setHasHook(e.target.checked)}
                        style={{
                          marginRight: "10px",
                          width: "18px",
                          height: "18px",
                          cursor: "pointer",
                        }}
                      />
                      <label
                        htmlFor="hasHook"
                        style={{
                          color: "#ccc",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        🔥 Viết phần Mở đầu (Hook giật gân)
                      </label>
                    </div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        id="hasOutro"
                        checked={hasOutro}
                        onChange={(e) => setHasOutro(e.target.checked)}
                        style={{
                          marginRight: "10px",
                          width: "18px",
                          height: "18px",
                          cursor: "pointer",
                        }}
                      />
                      <label
                        htmlFor="hasOutro"
                        style={{
                          color: "#ccc",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        👋 Viết phần Kết thúc (Outro kêu gọi like, sub)
                      </label>
                    </div>
                  </>
                )}
              </div>

              <div className="action-buttons">
                {isBulkAnime ? (
                  <button
                    className={`generate-btn btn-script ${isLoading && loadingType === "bulk-anime-script" ? "loading" : ""}`}
                    style={{
                      width: "100%",
                      background: "linear-gradient(45deg, #10b981, #059669)",
                      border: "none",
                    }}
                    onClick={handleBulkAnimeScript}
                    disabled={isLoading}
                  >
                    <span className="btn-text">
                      {isLoading && loadingType === "bulk-anime-script"
                        ? "HỆ THỐNG ĐANG CHẠY TỰ ĐỘNG..."
                        : "🚀 BẮT ĐẦU CHẠY AUTO FULL BỘ ANIME (CHỈ VIẾT KỊCH BẢN)"}
                    </span>
                    <div className="btn-glow"></div>
                  </button>
                ) : (
                  <button
                    className={`generate-btn btn-script ${isLoading && loadingType === "anime-script" ? "loading" : ""}`}
                    onClick={handleGenerateAnimeScript}
                    disabled={isLoading}
                  >
                    <span className="btn-text">
                      {isLoading && loadingType === "anime-script"
                        ? "AI đang phân tích & viết..."
                        : "✍️ Bắt Đầu Viết Kịch Bản Anime"}
                    </span>
                    <div className="btn-glow"></div>
                  </button>
                )}
              </div>
            </div>

            {logs.length > 0 && (
              <div className="logs-container">
                {logs.map((log, index) => (
                  <div key={index} className="log-line">
                    {log}
                  </div>
                ))}
              </div>
            )}

            {response && (
              <div className="response-container">
                <h3 className="response-title">KẾT QUẢ KỊCH BẢN ANIME:</h3>
                <div className="response-content">{response}</div>
              </div>
            )}
          </div>
        )}

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

            <div className="folder-picker-group">
              <input
                className="modern-input small-input"
                type="number"
                placeholder="⚙️ Số câu phụ đề mỗi đợt gửi AI (Mặc định: 80)"
                value={autoEditChunkSize}
                onChange={(e) => setAutoEditChunkSize(e.target.value)}
                title="Giảm số này nếu kịch bản quá dài khiến AI bị loạn"
                style={{ marginTop: "15px" }}
              />
            </div>

            <div className="action-buttons">
              <button
                className={`generate-btn btn-script ${(isLoading && (loadingType === "auto-edit-capcut" || loadingType === "bulk-auto-edit-capcut")) ? "loading" : ""}`}
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
{logs.length > 0 && (
              <div className="logs-container">
                {logs.map((log, index) => (
                  <div key={index} className="log-line">
                    {log}
                  </div>
                ))}
              </div>
            )}

            {response && (
              <div className="response-container">
                <h3 className="response-title">KẾT QUẢ AUTO EDIT:</h3>
                <div className="response-content">{response}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
