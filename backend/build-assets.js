const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Minify JS files using uglify-js
function minifyJS(dir) {
  try {
    fs.readdirSync(dir).forEach(file => {
      if (file.endsWith('.js') && !file.endsWith('.min.js')) {
        const filePath = path.join(dir, file);
        const minFilePath = filePath.replace(/\.js$/, '.min.js');
        try {
          execSync(`npx uglify-js "${filePath}" -o "${minFilePath}" --compress --mangle`, { stdio: 'inherit' });
          console.log(`Minified JS: ${file} -> ${path.basename(minFilePath)}`);
        } catch (error) {
          console.log(`Skipping JS minification for ${file} (${error.message})`);
        }
      }
    });
  } catch (error) {
    console.log('JS minification skipped:', error.message);
  }
}

// Minify CSS files using cssnano (via a temp file)
function minifyCSS(dir) {
  try {
    fs.readdirSync(dir).forEach(file => {
      if (file.endsWith('.css') && !file.endsWith('.min.css')) {
        const filePath = path.join(dir, file);
        const minFilePath = filePath.replace(/\.css$/, '.min.css');
        try {
          const cssnano = require('cssnano');
          const postcss = require('postcss');
          const css = fs.readFileSync(filePath, 'utf8');
          postcss([cssnano])
            .process(css, { from: filePath, to: minFilePath })
            .then(result => {
              fs.writeFileSync(minFilePath, result.css);
              console.log(`Minified CSS: ${file} -> ${path.basename(minFilePath)}`);
            })
            .catch(error => {
              console.log(`Skipping CSS minification for ${file} (${error.message})`);
            });
        } catch (error) {
          console.log(`Skipping CSS minification for ${file} (${error.message})`);
        }
      }
    });
  } catch (error) {
    console.log('CSS minification skipped:', error.message);
  }
}

console.log('Starting asset build...');
minifyJS(path.join(__dirname, 'public', 'js'));
minifyCSS(path.join(__dirname, 'public', 'assets', 'css'));
console.log('Asset build completed!'); 