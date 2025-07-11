const fs = require('fs');
const path = require('path');

console.log('Starting simple asset build...');

// Just copy files without minification
function copyAssets() {
  try {
    // Copy JS files
    const jsDir = path.join(__dirname, 'public', 'js');
    if (fs.existsSync(jsDir)) {
      fs.readdirSync(jsDir).forEach(file => {
        if (file.endsWith('.js') && !file.endsWith('.min.js')) {
          const sourcePath = path.join(jsDir, file);
          const destPath = sourcePath.replace(/\.js$/, '.min.js');
          fs.copyFileSync(sourcePath, destPath);
          console.log(`Copied JS: ${file} -> ${path.basename(destPath)}`);
        }
      });
    }

    // Copy CSS files
    const cssDir = path.join(__dirname, 'public', 'assets', 'css');
    if (fs.existsSync(cssDir)) {
      fs.readdirSync(cssDir).forEach(file => {
        if (file.endsWith('.css') && !file.endsWith('.min.css')) {
          const sourcePath = path.join(cssDir, file);
          const destPath = sourcePath.replace(/\.css$/, '.min.css');
          fs.copyFileSync(sourcePath, destPath);
          console.log(`Copied CSS: ${file} -> ${path.basename(destPath)}`);
        }
      });
    }
  } catch (error) {
    console.log('Asset copy completed with warnings:', error.message);
  }
}

copyAssets();
console.log('Simple asset build completed!'); 