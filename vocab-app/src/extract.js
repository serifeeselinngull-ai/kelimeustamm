import fs from 'fs';
import path from 'path';

const logPath = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\da597b11-6afa-4173-a08c-98f6f2deb42b\\.system_generated\\logs\\overview.txt';
const outputPath = 'C:\\Users\\admin\\.gemini\\antigravity\\scratch\\vocab-app\\extracted_prompt.md';

try {
    const fileContent = fs.readFileSync(logPath, 'utf8');
    const firstLine = fileContent.split('\n')[0];
    const parsed = JSON.parse(firstLine);
    fs.writeFileSync(outputPath, parsed.content, 'utf8');
    console.log('Successfully extracted full untruncated prompt to ' + outputPath);
} catch (e) {
    console.error('Error extracting prompt:', e);
}
