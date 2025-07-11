const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Minify JS files using uglify-js
function minifyJS(dir) {
  fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.js') && !file.endsWith('.min.js')) {
      const filePath = path.join(dir, file);
      const minFilePath = filePath.replace(/\.js$/, '.min.js');
      execSync(`npx uglify-js "${filePath}" -o "${minFilePath}" --compress --mangle`);
      console.log(`Minified JS: ${file} -> ${path.basename(minFilePath)}`);
    }
  });
}

// Minify CSS files using cssnano (via a temp file)
function minifyCSS(dir) {
  fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.css') && !file.endsWith('.min.css')) {
      const filePath = path.join(dir, file);
      const minFilePath = filePath.replace(/\.css$/, '.min.css');
      const cssnano = require('cssnano');
      const postcss = require('postcss');
      const css = fs.readFileSync(filePath, 'utf8');
      postcss([cssnano])
        .process(css, { from: filePath, to: minFilePath })
        .then(result => {
          fs.writeFileSync(minFilePath, result.css);
          console.log(`Minified CSS: ${file} -> ${path.basename(minFilePath)}`);
        });
    }
  });
}

minifyJS(path.join(__dirname, 'public', 'js'));
minifyCSS(path.join(__dirname, 'public', 'assets', 'css')); 