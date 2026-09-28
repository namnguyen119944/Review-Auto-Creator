import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

async function testUpload() {
    try {
        const ai = new GoogleGenAI({
            apiKey: 'sk-tknq9BYKDgSKWKBkchPm8oZxgZZwYBKUA1NvVbU5JSNB9qRE',
            httpOptions: { baseUrl: 'https://api.yescale.io' }
        });

        // Tạo 1 file ảnh giả để test (chỉ cần 1 file text nhỏ đổi tên thành png)
        const testFilePath = path.join(process.cwd(), 'test_image.png');
        fs.writeFileSync(testFilePath, 'dummy image content');

        console.log('Đang thử upload lên yescale...');
        const uploadResult = await ai.files.upload({
            file: testFilePath,
            mimeType: 'image/png'
        });

        console.log('✅ Upload thành công!');
        console.log('URI:', uploadResult.uri);

        // Dọn dẹp
        fs.unlinkSync(testFilePath);
        
    } catch (error) {
        console.error('❌ Lỗi Upload:', error.message);
        if (error.status) console.error('Status:', error.status);
    }
}

testUpload();
