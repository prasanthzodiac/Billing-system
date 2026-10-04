import sharp from "sharp";
import { writeFileSync } from "node:fs";

const SIZE = 256;
const pngBuffer = await sharp("app/icon.png")
  .resize(SIZE, SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toBuffer();

// Minimal ICO container: ICONDIR header + one ICONDIRENTRY + the PNG payload itself
// (Vista+ supports PNG-encoded icon entries directly, no BMP conversion needed).
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count

const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0); // width (0 = 256)
entry.writeUInt8(0, 1); // height (0 = 256)
entry.writeUInt8(0, 2); // color palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(pngBuffer.length, 8); // image data size
entry.writeUInt32LE(header.length + entry.length, 12); // offset

writeFileSync("public/velmayil-ventures.ico", Buffer.concat([header, entry, pngBuffer]));
console.log("wrote public/velmayil-ventures.ico");
