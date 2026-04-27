const fs = require("fs");
const path = require("path");

const outputDir = path.resolve(process.argv[2] || "dist");
const indexPath = path.join(outputDir, "index.html");

if (!fs.existsSync(indexPath)) {
  throw new Error(`Expected Expo web export at ${indexPath}`);
}

let html = fs.readFileSync(indexPath, "utf8");

// Expo exports root-relative bundle URLs. GitHub project pages are served from
// /<repo>/, so use relative URLs to keep assets loading under that path.
html = html
  .replaceAll('src="/_expo/', 'src="./_expo/')
  .replaceAll('href="/_expo/', 'href="./_expo/');

fs.writeFileSync(indexPath, html);
fs.writeFileSync(path.join(outputDir, ".nojekyll"), "");
fs.writeFileSync(path.join(outputDir, "404.html"), html);

console.log(`Prepared ${outputDir} for GitHub Pages.`);
