// THE WORLD — front page for Monday 23 November 2026.
// Pure Node (stdlib only): own rasterizer + own PNG encoder.
// Renders a 1024x1024 newspaper front page to $MAKEFUN_OUTPUT_DIR/entry.png.
// Written from scratch for the make.fun bounty "news-image-20261123".
// Run:  node main.ts        (or: MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts)

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

// ---------------------------------------------------------------- framebuffer
const W = 1024, H = 1024;
const fb = new Uint8Array(W * H * 3);
const PAPER = [253, 252, 247];
const INK = [17, 17, 17];
const NAVY = [27, 58, 107];
const RED = [185, 28, 28];
const GREEN = [21, 128, 61];
const GREY = [102, 102, 102];
const LGREY = [205, 205, 200];
const LGREEN = [217, 242, 227];

for (let i = 0; i < W * H; i++) {
  fb[i * 3] = PAPER[0]; fb[i * 3 + 1] = PAPER[1]; fb[i * 3 + 2] = PAPER[2];
}

function px(x, y, c) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  fb[o] = c[0]; fb[o + 1] = c[1]; fb[o + 2] = c[2];
}
function rect(x, y, w, h, c) {
  // Floor everything: fractional coords silently draw nothing on a
  // Uint8Array (non-integer indexes are ignored), which once blanked
  // the whole BY THE NUMBERS strip (centred text lands on .5 x).
  x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let o = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      fb[o] = c[0]; fb[o + 1] = c[1]; fb[o + 2] = c[2]; o += 3;
    }
  }
}
function hline(x, y, w, c, t) { rect(x, y, w, t || 1, c); }
function vline(x, y, h, c, t) { rect(x, y, t || 1, h, c); }
function frame(x, y, w, h, c, t) {
  const th = t || 1;
  hline(x, y, w, c, th); hline(x, y + h - th, w, c, th);
  vline(x, y, h, c, th); vline(x + w - th, y, h, c, th);
}
// Bresenham line, stamped thick.
function line(x0, y0, x1, y1, c, t) {
  const th = t || 1, r = Math.floor(th / 2);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    rect(x - r, y - r, th, th, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function diamond(cx, cy, r, c) {
  for (let dy = -r; dy <= r; dy++) {
    const w = r - Math.abs(dy);
    for (let dx = -w; dx <= w; dx++) px(cx + dx, cy + dy, c);
  }
}
function polyFill(points, top, c) {
  // Fill area under a polyline down to y=top (used for the chart area).
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1];
    const steps = Math.max(1, x1 - x0);
    for (let s = 0; s <= steps; s++) {
      const x = x0 + s;
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      for (let yy = y; yy <= top; yy++) px(x, yy, c);
    }
  }
}

// ---------------------------------------------------------------- 6x8 bitmap font
// Each glyph: 8 rows of 6 bits, '1' = on. Rows 0-6 are the cap/x-height body,
// row 7 is the descender/baseline gap.
const F = {
  "A": ["011110", "100001", "100001", "111111", "100001", "100001", "100001", "000000"],
  "B": ["111110", "100001", "100001", "111110", "100001", "100001", "111110", "000000"],
  "C": ["011110", "100001", "100000", "100000", "100000", "100001", "011110", "000000"],
  "D": ["111110", "100001", "100001", "100001", "100001", "100001", "111110", "000000"],
  "E": ["111111", "100000", "100000", "111110", "100000", "100000", "111111", "000000"],
  "F": ["111111", "100000", "100000", "111110", "100000", "100000", "100000", "000000"],
  "G": ["011110", "100001", "100000", "101111", "100001", "100001", "011111", "000000"],
  "H": ["100001", "100001", "100001", "111111", "100001", "100001", "100001", "000000"],
  "I": ["011100", "001100", "001100", "001100", "001100", "001100", "011100", "000000"],
  "J": ["000111", "000001", "000001", "000001", "000001", "100001", "011110", "000000"],
  "K": ["100001", "100010", "100100", "111000", "100100", "100010", "100001", "000000"],
  "L": ["100000", "100000", "100000", "100000", "100000", "100000", "111111", "000000"],
  "M": ["100001", "110011", "101101", "101101", "100001", "100001", "100001", "000000"],
  "N": ["100001", "110001", "101001", "100101", "100011", "100001", "100001", "000000"],
  "O": ["011110", "100001", "100001", "100001", "100001", "100001", "011110", "000000"],
  "P": ["111110", "100001", "100001", "111110", "100000", "100000", "100000", "000000"],
  "Q": ["011110", "100001", "100001", "100001", "101001", "100010", "011101", "000000"],
  "R": ["111110", "100001", "100001", "111110", "100100", "100010", "100001", "000000"],
  "S": ["011111", "100000", "100000", "011110", "000001", "000001", "111110", "000000"],
  "T": ["111111", "001100", "001100", "001100", "001100", "001100", "001100", "000000"],
  "U": ["100001", "100001", "100001", "100001", "100001", "100001", "011110", "000000"],
  "V": ["100001", "100001", "100001", "100001", "100001", "010010", "001100", "000000"],
  "W": ["100001", "100001", "100001", "101101", "101101", "110011", "100001", "000000"],
  "X": ["100001", "100001", "010010", "001100", "010010", "100001", "100001", "000000"],
  "Y": ["100001", "100001", "010010", "001100", "001100", "001100", "001100", "000000"],
  "Z": ["111111", "000001", "000010", "001100", "010000", "100000", "111111", "000000"],
  "a": ["000000", "000000", "011110", "000001", "011111", "100001", "011111", "000000"],
  "b": ["100000", "100000", "111110", "100001", "100001", "100001", "111110", "000000"],
  "c": ["000000", "000000", "011110", "100000", "100000", "100001", "011110", "000000"],
  "d": ["000001", "000001", "011111", "100001", "100001", "100001", "011111", "000000"],
  "e": ["000000", "000000", "011110", "100001", "111111", "100000", "011110", "000000"],
  "f": ["001100", "010010", "010000", "111110", "010000", "010000", "010000", "000000"],
  "g": ["000000", "000000", "011111", "100001", "100001", "011111", "000001", "011110"],
  "h": ["100000", "100000", "111110", "100001", "100001", "100001", "100001", "000000"],
  "i": ["001100", "000000", "011100", "001100", "001100", "001100", "011100", "000000"],
  "j": ["000110", "000000", "001110", "000110", "000110", "000110", "000110", "011100"],
  "k": ["100000", "100000", "100010", "100100", "111000", "100100", "100010", "000000"],
  "l": ["011100", "001100", "001100", "001100", "001100", "001100", "011100", "000000"],
  "m": ["000000", "000000", "110110", "101101", "101101", "101101", "101101", "000000"],
  "n": ["000000", "000000", "111110", "100001", "100001", "100001", "100001", "000000"],
  "o": ["000000", "000000", "011110", "100001", "100001", "100001", "011110", "000000"],
  "p": ["000000", "000000", "111110", "100001", "100001", "111110", "100000", "100000"],
  "q": ["000000", "000000", "011111", "100001", "100001", "011111", "000001", "000001"],
  "r": ["000000", "000000", "101110", "110001", "100000", "100000", "100000", "000000"],
  "s": ["000000", "000000", "011111", "100000", "011110", "000001", "111110", "000000"],
  "t": ["001100", "001100", "111110", "001100", "001100", "001100", "000110", "000000"],
  "u": ["000000", "000000", "100001", "100001", "100001", "100011", "011101", "000000"],
  "v": ["000000", "000000", "100001", "100001", "100001", "010010", "001100", "000000"],
  "w": ["000000", "000000", "100001", "101101", "101101", "101101", "011011", "000000"],
  "x": ["000000", "000000", "100001", "010010", "001100", "010010", "100001", "000000"],
  "y": ["000000", "000000", "100001", "100001", "011111", "000001", "000001", "011110"],
  "z": ["000000", "000000", "111111", "000010", "001100", "010000", "111111", "000000"],
  "0": ["011110", "100001", "100011", "101001", "110001", "100001", "011110", "000000"],
  "1": ["001100", "011100", "001100", "001100", "001100", "001100", "011110", "000000"],
  "2": ["011110", "100001", "000001", "000110", "001100", "010000", "111111", "000000"],
  "3": ["111110", "000001", "000001", "011110", "000001", "000001", "111110", "000000"],
  "4": ["000110", "001100", "010100", "100100", "111111", "000100", "000100", "000000"],
  "5": ["111111", "100000", "111110", "000001", "000001", "100001", "011110", "000000"],
  "6": ["011110", "100000", "100000", "111110", "100001", "100001", "011110", "000000"],
  "7": ["111111", "000001", "000010", "000100", "001000", "001000", "001000", "000000"],
  "8": ["011110", "100001", "100001", "011110", "100001", "100001", "011110", "000000"],
  "9": ["011110", "100001", "100001", "011111", "000001", "000001", "011110", "000000"],
  " ": ["000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000"],
  ".": ["000000", "000000", "000000", "000000", "000000", "000000", "011000", "000000"],
  ",": ["000000", "000000", "000000", "000000", "000000", "000000", "011000", "010000"],
  ":": ["000000", "000000", "001100", "000000", "000000", "001100", "000000", "000000"],
  ";": ["000000", "000000", "001100", "000000", "000000", "001100", "001100", "010000"],
  "!": ["001100", "001100", "001100", "001100", "001100", "000000", "001100", "000000"],
  "?": ["011110", "100001", "000001", "000110", "001100", "000000", "001100", "000000"],
  "'": ["001100", "001100", "010000", "000000", "000000", "000000", "000000", "000000"],
  '"': ["010010", "010010", "010010", "000000", "000000", "000000", "000000", "000000"],
  "-": ["000000", "000000", "000000", "011110", "000000", "000000", "000000", "000000"],
  "\u2013": ["000000", "000000", "000000", "111111", "000000", "000000", "000000", "000000"],
  "\u2014": ["000000", "000000", "000000", "111111", "000000", "000000", "000000", "000000"],
  "%": ["110001", "110010", "000100", "001000", "010000", "100011", "100011", "000000"],
  "$": ["001100", "011111", "101100", "011110", "001101", "111110", "001100", "000000"],
  "&": ["011100", "100010", "101000", "010000", "101001", "100010", "011101", "000000"],
  "(": ["000110", "001000", "010000", "010000", "010000", "001000", "000110", "000000"],
  ")": ["011000", "000100", "000010", "000010", "000010", "000100", "011000", "000000"],
  "/": ["000001", "000010", "000100", "001000", "010000", "100000", "100000", "000000"],
  "+": ["000000", "000000", "001100", "111111", "001100", "000000", "000000", "000000"],
  "\u00b7": ["000000", "000000", "000000", "011000", "000000", "000000", "000000", "000000"],
  "=": ["000000", "000000", "111111", "000000", "111111", "000000", "000000", "000000"],
  "*": ["000000", "100101", "011110", "100101", "000000", "000000", "000000", "000000"],
};

const CHAR_W = 7; // 6 glyph + 1 spacing, in font units
function textW(s, sc) { return s.length * CHAR_W * sc - sc; }
function drawChar(x, y, ch, sc, c) {
  const g = F[ch] || F["?"];
  for (let r = 0; r < 8; r++) {
    const row = g[r];
    for (let col = 0; col < 6; col++) {
      if (row[col] === "1") rect(x + col * sc, y + r * sc, sc, sc, c);
    }
  }
}
function drawText(x, y, s, sc, c, align) {
  let x0 = Math.floor(x);
  if (align === "c") x0 = Math.floor(x - textW(s, sc) / 2);
  else if (align === "r") x0 = Math.floor(x - textW(s, sc));
  for (let i = 0; i < s.length; i++) drawChar(x0 + i * CHAR_W * sc, y, s[i], sc, c);
  return x0 + textW(s, sc);
}
// Greedy word wrap to a max character count per line.
function wrap(s, maxChars) {
  const words = s.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function para(x, y, s, sc, c, maxChars, leading) {
  const lines = wrap(s, maxChars);
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * leading, lines[i], sc, c);
  return y + lines.length * leading;
}

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    // Uint8Array has no .copy (Buffer only) — use .set with a subarray view.
    raw.set(fb.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- layout
const M = 36;                 // outer margin
const X0 = M, X1 = W - M;     // content left/right (36..988)
const CW = X1 - X0;           // 952

// ---- masthead ----
hline(X0, 30, CW, INK, 2);
drawText(W / 2, 44, "THE WORLD", 10, INK, "c");
hline(X0, 132, CW, RED, 3);
// dateline with red diamond ornaments
const dateLine = "MONDAY 23 NOVEMBER 2026";
const dw = textW(dateLine, 2);
drawText(W / 2, 142, dateLine, 2, INK, "c");
diamond(W / 2 - Math.floor(dw / 2) - 22, 149, 5, RED);
diamond(W / 2 + Math.floor(dw / 2) + 22, 149, 5, RED);
hline(X0, 166, CW, INK, 2);
hline(X0, 171, CW, RED, 3);

// ---- lead story ----
const LEAD_Y = 180, LEAD_H = 268, LEAD_B = LEAD_Y + LEAD_H; // 180..448
const LTX = X0, LTW = 520;                    // lead text column 36..556
const CHX = 572, CHW = X1 - CHX;              // chart panel 572..988
drawText(LTX, LEAD_Y + 4, "TECHNOLOGY \u00b7 MARKETS", 2, NAVY);
drawText(LTX, LEAD_Y + 28, "HUANG IS BACK", 5, INK);
drawText(LTX, LEAD_Y + 76, "Nvidia board reinstates its founder", 2, INK);
let by = LEAD_Y + 104;
by = para(LTX, by, "Nvidia's board reinstated co-founder Jensen Huang as CEO on Monday, under two weeks after he stepped down amid the Megaspeed spy scandal.", 2, INK, 37, 17);
by += 6;
by = para(LTX, by, "Shares soared 31.5% \u2014 the best day since 2003 \u2014 adding $952bn in one session.", 2, INK, 37, 17);
by += 6;
by = para(LTX, by, "US officials said his return posed no security risk. He testifies to Congress on 3 December.", 2, INK, 37, 17);
drawText(LTX, LEAD_B - 14, "Sources: CNN \u00b7 Reuters \u00b7 Le Monde \u00b7 Investopedia", 1, GREY);

// ---- lead chart panel ----
rect(CHX, LEAD_Y, CHW, LEAD_H, [255, 255, 255]);
frame(CHX, LEAD_Y, CHW, LEAD_H, INK, 1);
drawText(CHX + 10, LEAD_Y + 10, "NVIDIA SHARES", 2, NAVY);
drawText(X1 - 10, LEAD_Y + 8, "+31.5%", 3, GREEN, "r");
drawText(CHX + 10, LEAD_Y + 30, "BEST DAY SINCE 2003", 1, RED);
// chart area
const CA = { x: 608, y: 222, w: 364, h: 150, b: 372 }; // bottom y = 372
const p2y = (p) => Math.round(CA.b - ((p - 120) / 50) * CA.h);
for (const g of [120, 140, 160]) {
  hline(CA.x, p2y(g), CA.w, LGREY, 1);
  drawText(CHX + 6, p2y(g) - 3, "$" + g, 1, GREY);
}
const pts = [[612, 126], [682, 132], [752, 141], [822, 149], [892, 157], [958, 165]]
  .map(([x, p]) => [x, p2y(p)]);
polyFill(pts, CA.b, LGREEN);
for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], GREEN, 3);
for (const [x, y] of pts) { rect(x - 3, y - 3, 7, 7, GREEN); }
drawText(612, CA.b + 6, "$126 FRI 20 NOV", 1, GREY);
drawText(872, 214, "MON CLOSE $165", 1, RED);
drawText(958, CA.b + 6, "MON 23 NOV", 1, GREY, "r");
// mini bars: Nasdaq + S&P
const BAR_X = 680, BAR_MAX = 300;
drawText(CHX + 10, 392, "NASDAQ +6.51%", 1, INK);
rect(BAR_X, 390, Math.round((6.51 / 7) * BAR_MAX), 11, GREEN);
drawText(CHX + 10, 420, "S&P 500 +4.73%", 1, INK);
rect(BAR_X, 418, Math.round((4.73 / 7) * BAR_MAX), 11, NAVY);

// ---- BY THE NUMBERS strip ----
const NUM_Y = 456;
hline(X0, NUM_Y, CW, RED, 2);
drawText(W / 2, NUM_Y + 8, "\u2014  BY THE NUMBERS  \u2014", 1, RED, "c");
const NB = { y: NUM_Y + 20, h: 78, gap: 12 };
const NBW = Math.floor((CW - 3 * NB.gap) / 4); // 229
const NUMBERS = [
  ["31.5%", "NVIDIA JUMP", "BEST DAY SINCE 2003", NAVY],
  ["$952bn", "ADDED IN ONE DAY", "IN MARKET VALUE", INK],
  ["$55,100", "BITCOIN LOW", "LOWEST SINCE SEP 2024", RED],
  ["700,000", "WOMEN IN EDITH TRIAL", "AI MAMMOGRAM REVIEW", INK],
];
for (let i = 0; i < 4; i++) {
  const bx = X0 + i * (NBW + NB.gap);
  rect(bx, NB.y, NBW, NB.h, [255, 255, 255]);
  frame(bx, NB.y, NBW, NB.h, LGREY, 1);
  const [num, c1, c2, col] = NUMBERS[i];
  drawText(bx + NBW / 2, NB.y + 10, num, 4, col, "c");
  drawText(bx + NBW / 2, NB.y + 50, c1, 1, GREY, "c");
  drawText(bx + NBW / 2, NB.y + 61, c2, 1, GREY, "c");
}
hline(X0, NUM_Y + 106, CW, INK, 1);

// ---- 2-col x 3-row card grid ----
const CARDS = [
  ["MIDDLE EAST", "Trump: Iran fired its heaviest missile week in a year",
   "All were shot down, the president says. Tehran claims it struck US Patriot radars in Bahrain."],
  ["CLIMATE", "A day after Antalya collapsed, reactions harden",
   "The EU-led bloc of 130+ nations refused a text silent on fossil fuels. Core talks move to COP32 in Addis Ababa, Nov 2027."],
  ["EUROPE", "NATO holds emergency meeting on Poland",
   "The alliance convenes today after three Russian objects came down in Poland last week."],
  ["TECH \u00b7 TRADE", "US blacklists Megaspeed over chip diversion",
   "Singapore firm is barred from most American tech sales over suspected diversion of Nvidia AI chips to China."],
  ["MARKETS", "Bitcoin sinks to $55,100, lowest since Sep 2024",
   "The token later recovered to about $61,000 after the slide rattled crypto markets."],
  ["ARTIFICIAL INTELLIGENCE", "OpenAI proposes shared AI safety limits",
   "Labs would agree capability thresholds they commit not to cross, in a new industry pact."],
];
const GRID_Y = 572, CARD_H = 88, CARD_GAP = 8;
const CARD_W = Math.floor((CW - CARD_GAP) / 2); // 472
for (let i = 0; i < 6; i++) {
  const col = i % 2, row = Math.floor(i / 2);
  const cx = X0 + col * (CARD_W + CARD_GAP);
  const cy = GRID_Y + row * (CARD_H + CARD_GAP);
  rect(cx, cy, CARD_W, CARD_H, [255, 255, 255]);
  frame(cx, cy, CARD_W, CARD_H, LGREY, 1);
  const [kick, head, body] = CARDS[i];
  drawText(cx + 12, cy + 9, kick, 1, NAVY);
  const hl = wrap(head, 32);
  for (let j = 0; j < Math.min(2, hl.length); j++)
    drawText(cx + 12, cy + 23 + j * 17, hl[j], 2, INK);
  const bl = wrap(body, 64);
  for (let j = 0; j < Math.min(2, bl.length); j++)
    drawText(cx + 12, cy + 61 + j * 10, bl[j], 1, [60, 60, 60]);
}

// ---- THE DAY IN BRIEF ----
const BRIEF_Y = 856;
drawText(X0, BRIEF_Y, "THE DAY IN BRIEF", 2, NAVY);
hline(X0, BRIEF_Y + 20, CW, INK, 2);
const BRIEFS = [
  "Anthropic faces junk-rating outlook after record IPO",
  "APEC exposes deepening China-Japan chasm",
  "Albania denies attack drones launched from its soil",
  "Amtrak Sunset Limited derails in Louisiana",
  "Belgium strike halts flights and trains",
  "Armenia unveils draft constitution for Azerbaijan peace deal",
  "Meta executive: artificial superintelligence is imminent",
  "Israeli strike kills Hamas internal security chief in Gaza",
  "Iran flogs singer Ahmadi - 74 lashes - over hijab-free show",
  "Pope's diaries reveal 'visions of the devil'",
];
for (let i = 0; i < 10; i++) {
  const col = i < 5 ? 0 : 1, row = i % 5;
  const bx = X0 + col * (CARD_W + CARD_GAP);
  const byy = BRIEF_Y + 30 + row * 17;
  drawText(bx, byy, "\u00b7 " + BRIEFS[i], 1, INK);
}

// ---- footer ----
hline(X0, 978, CW, INK, 1);
drawText(W / 2, 986, "All stories dated Monday 23 November 2026  \u00b7  THE WORLD  \u00b7  Page 1", 1, GREY, "c");

// ---------------------------------------------------------------- write PNG
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "entry.png");
fs.writeFileSync(outPath, encodePNG());
const st = fs.statSync(outPath);
console.log("wrote", outPath, st.size, "bytes, 1024x1024");
