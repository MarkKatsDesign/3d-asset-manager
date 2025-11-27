import pngToIco from 'png-to-ico';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const pngPath = join(projectRoot, 'resources', 'icon.png');
const icoPath = join(projectRoot, 'resources', 'icon.ico');

console.log('Converting PNG to ICO...');
console.log('Input:', pngPath);
console.log('Output:', icoPath);

try {
  const buf = await pngToIco(pngPath);
  writeFileSync(icoPath, buf);
  console.log('✓ ICO file created successfully');
  console.log('File size:', Math.round(buf.length / 1024), 'KB');
} catch (error) {
  console.error('Error creating ICO:', error);
  process.exit(1);
}
