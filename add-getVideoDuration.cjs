const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const defineFunc = `
const getVideoDuration = async (videoPath) => {
  try {
    const res = await execPromise(
      \`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "\${videoPath}"\`
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
`;

code = code.replace('const app = express();', defineFunc + '\nconst app = express();');
fs.writeFileSync('server.js', code, 'utf8');
