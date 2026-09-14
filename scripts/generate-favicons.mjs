import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";

const GRAPHITE = [17, 24, 32, 255];
const COPPER = [196, 119, 67, 255];
const IVORY = [245, 241, 232, 255];
const FOREST = [37, 71, 61, 255];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
    : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function sampleIcon(x, y) {
  const cornerRadius = 0.2;
  const nearLeft = x < cornerRadius;
  const nearRight = x > 1 - cornerRadius;
  const nearTop = y < cornerRadius;
  const nearBottom = y > 1 - cornerRadius;
  if (
    (nearLeft && nearTop && Math.hypot(x - cornerRadius, y - cornerRadius) > cornerRadius) ||
    (nearRight && nearTop && Math.hypot(x - (1 - cornerRadius), y - cornerRadius) > cornerRadius) ||
    (nearLeft &&
      nearBottom &&
      Math.hypot(x - cornerRadius, y - (1 - cornerRadius)) > cornerRadius) ||
    (nearRight &&
      nearBottom &&
      Math.hypot(x - (1 - cornerRadius), y - (1 - cornerRadius)) > cornerRadius)
  )
    return [0, 0, 0, 0];

  const house = [
    [0.28, 0.49],
    [0.5, 0.29],
    [0.72, 0.49],
    [0.72, 0.77],
    [0.28, 0.77],
  ];
  let color = pointInPolygon(x, y, house) ? IVORY : GRAPHITE;
  if (x >= 0.43 && x <= 0.57 && y >= 0.58 && y <= 0.77) color = FOREST;

  const roofDistance = Math.min(
    distanceToSegment(x, y, 0.18, 0.52, 0.5, 0.23),
    distanceToSegment(x, y, 0.5, 0.23, 0.82, 0.52),
  );
  if (roofDistance <= 0.06) color = COPPER;
  return color;
}

function createPng(size) {
  const supersampling = 4;
  const rowLength = size * 4 + 1;
  const raw = Buffer.alloc(rowLength * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * rowLength] = 0;
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < supersampling; sy += 1) {
        for (let sx = 0; sx < supersampling; sx += 1) {
          const color = sampleIcon(
            (x + (sx + 0.5) / supersampling) / size,
            (y + (sy + 0.5) / supersampling) / size,
          );
          color.forEach((channel, index) => {
            totals[index] += channel;
          });
        }
      }
      const offset = y * rowLength + 1 + x * 4;
      totals.forEach((total, index) => {
        raw[offset + index] = Math.round(total / supersampling ** 2);
      });
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const faviconPng = createPng(32);
const appleTouchIcon = createPng(180);
const icoHeader = Buffer.from([0, 0, 1, 0, 1, 0]);
const icoEntry = Buffer.alloc(16);
icoEntry[0] = 32;
icoEntry[1] = 32;
icoEntry.writeUInt16LE(1, 4);
icoEntry.writeUInt16LE(32, 6);
icoEntry.writeUInt32LE(faviconPng.length, 8);
icoEntry.writeUInt32LE(22, 12);

await Promise.all([
  writeFile("public/favicon-32x32.png", faviconPng),
  writeFile("public/apple-touch-icon.png", appleTouchIcon),
  writeFile("public/favicon.ico", Buffer.concat([icoHeader, icoEntry, faviconPng])),
]);

console.info("A favicon PNG, ICO és apple-touch változatai elkészültek.");
