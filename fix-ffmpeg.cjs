const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const targetStr = 'const ffmpegCmd = `"${ffmpegPath}" -y -i "${videoPath}" -vf "fps=0.5,scale=1280:-2" -c:v libx264 -preset fast -crf 28 -c:a copy "${optimizedVideoPath}"`;';
const replacementStr = 'const ffmpegCmd = `"${ffmpegPath}" -y -i "${videoPath}" -vf "fps=0.5,scale=1280:-2" -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p -c:a aac -b:a 64k "${optimizedVideoPath}"`;';

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('server.js', code, 'utf8');
    console.log('Successfully fixed ffmpeg command.');
} else {
    console.log('Target string not found.');
}
