const fs = require("fs");
const path = require("path");

const root = process.cwd();
const publicDir = path.join(root, "public");

if (fs.existsSync(publicDir)) {
  fs.rmSync(publicDir, { recursive: true, force: true });
}
fs.mkdirSync(publicDir, { recursive: true });

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(path.join(root, "frontend", "css"), path.join(publicDir, "css"));
copyDir(path.join(root, "frontend", "js"), path.join(publicDir, "js"));
copyDir(path.join(root, "frontend", "assets"), path.join(publicDir, "assets"));

console.log("public/ ready");
