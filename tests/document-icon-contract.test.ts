import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function readPngColorType(filePath: string) {
  const buf = fs.readFileSync(filePath);
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return buf[25];
}

describe("Markdown document icon contract", () => {
  it("registers Markdown documents with a custom macOS document icon", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));

    expect(pkg.build.fileAssociations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ext: "md",
        name: "Markdown Document",
        role: "Editor",
        rank: "Default",
        icon: "desktop/src/markdown-document-icon.icns",
      }),
    ]));
    expect(pkg.build.fileAssociations.find((item: { ext: string }) => item.ext === "md").icon)
      .not.toBe(pkg.build.mac.icon);
  });

  it("ships a transparent PNG source and macOS ICNS for the Markdown document icon", () => {
    const pngPath = path.join(ROOT, "desktop", "src", "markdown-document-icon.png");
    const icnsPath = path.join(ROOT, "desktop", "src", "markdown-document-icon.icns");

    expect(fs.existsSync(pngPath)).toBe(true);
    expect(fs.existsSync(icnsPath)).toBe(true);
    expect(readPngColorType(pngPath)).toBe(6);
    expect(fs.readFileSync(icnsPath).subarray(0, 4).toString("ascii")).toBe("icns");
  });
});
