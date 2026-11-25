const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function run() {
  const svgPath = path.resolve(__dirname, "../apps/web/public/favicon.svg");
  const svgContent = fs.readFileSync(svgPath, "utf8");
  const browser = await chromium.launch();

  for (const size of [192, 512]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1
    });

    const html = `<!DOCTYPE html>
<html>
  <head>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; }
      svg { width: ${size}px; height: ${size}px; display: block; }
    </style>
  </head>
  <body>
    ${svgContent}
  </body>
</html>`;

    await page.setContent(html);
    const outPath = path.resolve(__dirname, `../apps/web/public/icon-${size}.png`);
    await page.screenshot({ path: outPath, omitBackground: true });
    console.log(`✅ Generated: ${outPath} (${size}x${size})`);
  }

  await browser.close();
}

run().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});

