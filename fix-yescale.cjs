const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /const ai = new GoogleGenAI\(\{\s*apiKey: GEMINI_API_KEY,\s*httpOptions: \{ baseUrl: "https:\/\/api\.yescale\.io" \},\s*\}\);/g,
  `const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  ...(GEMINI_API_KEY.startsWith("sk-") ? { httpOptions: { baseUrl: "https://api.yescale.io" } } : {})
});`
);

code = code.replace(
  /getClient\(\) \{\s*return new GoogleGenAI\(\{\s*apiKey: this\.getCurrentKey\(\),\s*httpOptions: \{ baseUrl: "https:\/\/api\.yescale\.io" \},\s*\}\);\s*\}/g,
  `getClient() {
    const key = this.getCurrentKey();
    return new GoogleGenAI({
      apiKey: key,
      ...(key && key.startsWith("sk-") ? { httpOptions: { baseUrl: "https://api.yescale.io" } } : {})
    });
  }`
);

fs.writeFileSync('server.js', code, 'utf8');
