/**
 * QR encoder + ZIP + print-PDF — ported verbatim from
 * plan/bella-admin-console.html (Phase H #4, plan/START-HERE.md's explicit
 * instruction: "Port the prototype's own QR encoder, zipStore() and
 * qrPdf(); add no libraries"). Byte-mode, ECC level M, versions 1–10 — no
 * DOM/browser APIs here, so this runs the same on the server or client;
 * `saveBlob` (the actual download trigger) stays in the component since
 * `URL.createObjectURL` is browser-only.
 */

/* ---- GF(256) ---- */
function buildGF() {
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  return { EXP, LOG };
}
const { EXP, LOG } = buildGF();
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function genPoly(n: number): number[] {
  let p = [1];
  for (let i = 0; i < n; i++) {
    const q = new Array(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++) {
      q[j] ^= mul(p[j], 1);
      q[j + 1] ^= mul(p[j], EXP[i]);
    }
    p = q;
  }
  return p;
}
function ecc(data: number[], n: number): number[] {
  const g = genPoly(n);
  const res = new Array(data.length + n).fill(0);
  data.forEach((d, i) => (res[i] = d));
  for (let i = 0; i < data.length; i++) {
    const f = res[i];
    if (!f) continue;
    for (let j = 0; j < g.length; j++) res[i + j] ^= mul(g[j], f);
  }
  return res.slice(data.length);
}

/* ---- version tables, ECC level M ---- */
// [ecPerBlock, blocks1, data1, blocks2, data2]
const T: Record<number, number[]> = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
};
const ALIGN: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

/** Returns a 2D array of 0/1 (1 = dark). Throws if `text` is too long for version 10. */
export function qrMatrix(text: string): number[][] {
  const bytes = [...new TextEncoder().encode(text)];
  let ver = 0;
  let spec: number[] | null = null;
  for (let v = 1; v <= 10; v++) {
    const s = T[v];
    const total = s[1] * s[2] + s[3] * s[4];
    const bits = 4 + (v < 10 ? 8 : 16) + 8 * bytes.length;
    if (bits <= total * 8) {
      ver = v;
      spec = s;
      break;
    }
  }
  if (!ver || !spec) throw new Error("payload too long for v10");

  const size = 17 + 4 * ver;
  const totalData = spec[1] * spec[2] + spec[3] * spec[4];

  /* ---- bitstream ---- */
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  for (let i = 0; i < 4 && bits.length < totalData * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    codewords.push(b);
  }
  const PAD = [0xec, 0x11];
  for (let i = 0; codewords.length < totalData; i++) codewords.push(PAD[i % 2]);

  /* ---- blocks + interleave ---- */
  const blocks: number[][] = [];
  const eccs: number[][] = [];
  let pos = 0;
  for (let g = 0; g < 2; g++) {
    const nb = spec[1 + g * 2];
    const nd = spec[2 + g * 2];
    for (let b = 0; b < nb; b++) {
      const chunk = codewords.slice(pos, pos + nd);
      pos += nd;
      blocks.push(chunk);
      eccs.push(ecc(chunk, spec[0]));
    }
  }
  const final: number[] = [];
  const maxD = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxD; i++) blocks.forEach((b) => { if (i < b.length) final.push(b[i]); });
  for (let i = 0; i < spec[0]; i++) eccs.forEach((e) => final.push(e[i]));

  /* ---- matrix scaffold ---- */
  const m: (number | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));
  const set = (r: number, c: number, v: number) => {
    if (r >= 0 && c >= 0 && r < size && c < size) m[r][c] = v;
  };

  const finder = (r: number, c: number) => {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const rr = r + i;
        const cc = c + j;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const inb = i >= 0 && i <= 6 && j >= 0 && j <= 6;
        const dark = inb && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
        set(rr, cc, dark ? 1 : 0);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  ALIGN[ver].forEach((r) =>
    ALIGN[ver].forEach((c) => {
      if ((r < 9 && c < 9) || (r < 9 && c > size - 10) || (r > size - 10 && c < 9)) return;
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          set(r + i, c + j, Math.abs(i) === 2 || Math.abs(j) === 2 || (i === 0 && j === 0) ? 1 : 0);
        }
      }
    })
  );

  for (let i = 8; i < size - 8; i++) {
    const v = i % 2 === 0 ? 1 : 0;
    set(6, i, v);
    set(i, 6, v);
  }
  set(size - 8, 8, 1); // dark module

  // reserve format areas
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) set(8, i, 0);
    if (m[i][8] === null) set(i, 8, 0);
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) set(8, size - 1 - i, 0);
    if (m[size - 1 - i][8] === null) set(size - 1 - i, 8, 0);
  }
  const reserved = m.map((row) => row.map((v) => v !== null));

  // version info (v>=7) — unreachable at our string lengths, kept for fidelity
  if (ver >= 7) {
    let d = ver;
    for (let i = 0; i < 12; i++) d = (d << 1) ^ (((d >>> 11) & 1) * 0x1f25);
    const vi = ((ver << 12) | d) >>> 0;
    for (let i = 0; i < 18; i++) {
      const bit = (vi >> i) & 1;
      const r = Math.floor(i / 3);
      const c = i % 3;
      set(size - 11 + c, r, bit);
      set(r, size - 11 + c, bit);
      reserved[size - 11 + c][r] = true;
      reserved[r][size - 11 + c] = true;
    }
  }

  /* ---- place data ---- */
  let bi = 0;
  const dataBits: number[] = [];
  final.forEach((b) => {
    for (let i = 7; i >= 0; i--) dataBits.push((b >> i) & 1);
  });
  let up = true;
  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let k = 0; k < size; k++) {
      const r = up ? size - 1 - k : k;
      for (let x = 0; x < 2; x++) {
        const cc = c - x;
        if (reserved[r][cc]) continue;
        m[r][cc] = bi < dataBits.length ? dataBits[bi++] : 0;
      }
    }
    up = !up;
  }

  /* ---- masking ---- */
  const MASKS: ((r: number, c: number) => boolean)[] = [
    (r, c) => (r + c) % 2 === 0,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- QR mask pattern 1 depends only on the row, per spec
    (r, c) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  function formatBits(mask: number): number {
    const data = (0b00 << 3) | mask; // ECC level M = 00
    let d = data;
    for (let i = 0; i < 10; i++) d = (d << 1) ^ (((d >>> 9) & 1) * 0x537);
    return (((data << 10) | d) ^ 0x5412) >>> 0;
  }
  function applyFormat(g: number[][], mask: number) {
    const f = formatBits(mask);
    for (let i = 0; i < 15; i++) {
      const bit = (f >> i) & 1;
      if (i < 6) g[8][i] = bit;
      else if (i === 6) g[8][7] = bit;
      else if (i === 7) g[8][8] = bit;
      else if (i === 8) g[7][8] = bit;
      else g[14 - i][8] = bit;

      if (i < 8) g[size - 1 - i][8] = bit;
      else g[8][size - 15 + i] = bit;
    }
    g[size - 8][8] = 1;
  }
  function penalty(g: number[][]): number {
    let p = 0;
    // rule 1: runs of 5+
    for (let i = 0; i < size; i++) {
      for (const line of [g[i], g.map((r) => r[i])]) {
        let run = 1;
        for (let j = 1; j < size; j++) {
          if (line[j] === line[j - 1]) run++;
          else {
            if (run >= 5) p += 3 + (run - 5);
            run = 1;
          }
        }
        if (run >= 5) p += 3 + (run - 5);
      }
    }
    // rule 2: 2x2 blocks
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) p += 3;
      }
    }
    // rule 3: finder-like patterns
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const rpat = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c <= size - 11; c++) {
        const hs = g[r].slice(c, c + 11);
        const vs: number[] = [];
        for (let k = 0; k < 11; k++) vs.push(g[c + k][r]);
        if (hs.every((v, i) => v === pat[i]) || hs.every((v, i) => v === rpat[i])) p += 40;
        if (vs.every((v, i) => v === pat[i]) || vs.every((v, i) => v === rpat[i])) p += 40;
      }
    }
    // rule 4: dark ratio
    const dark = g.flat().filter((v) => v).length;
    p += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return p;
  }

  let best: number[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g = m.map((row, r) => row.map((v, c) => (reserved[r][c] ? v! : MASKS[mask](r, c) ? v! ^ 1 : v!)));
    applyFormat(g, mask);
    const s = penalty(g);
    if (s < bestScore) {
      bestScore = s;
      best = g;
    }
  }
  return best!;
}

/**
 * Renders a matrix to an inline SVG string (path fill, crisp edges).
 *
 * `dark`/`light` are explicit because a QR is not decoration — a scanner
 * needs dark modules on a light field, and that has to hold whatever palette
 * the tenant picked. The module colour used to be the literal `#1d2520`
 * (Bëlla's page background) with no background rect at all, so the code
 * inherited whatever was behind it: on a light-themed cafe the sheet went
 * dark and the codes turned into an unreadable black square. The quiet zone
 * is painted here too, for the same reason — it is part of the code, not of
 * the card it happens to sit on.
 */
export function qrSvg(text: string, px = 168, dark = "#1d2520", light = "#ffffff"): string {
  const m = qrMatrix(text);
  const n = m.length;
  const q = 3;
  const dim = n + q * 2;
  let d = "";
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!m[r][c]) {
        c++;
        continue;
      }
      let w = 1;
      while (c + w < n && m[r][c + w]) w++;
      d += `M${c + q} ${r + q}h${w}v1h-${w}z`;
      c += w;
    }
  }
  return `<svg viewBox="0 0 ${dim} ${dim}" width="${px}" height="${px}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="${dim}" height="${dim}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}

/* --- ZIP (stored, no compression) --- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const dir: { name: Uint8Array; crc: number; len: number; local: number }[] = [];
  let offset = 0;
  const enc = new TextEncoder();
  const put = (arr: Uint8Array) => {
    chunks.push(arr);
    offset += arr.length;
  };
  const u16 = (v: number) => [v & 255, (v >>> 8) & 255];
  const u32 = (v: number) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];

  files.forEach((f) => {
    const name = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const local = offset;
    put(
      new Uint8Array([
        ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
      ])
    );
    put(name);
    put(data);
    dir.push({ name, crc, len: data.length, local });
  });

  const dirStart = offset;
  dir.forEach((e) => {
    put(
      new Uint8Array([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(e.crc), ...u32(e.len), ...u32(e.len), ...u16(e.name.length),
        ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(e.local),
      ])
    );
    put(e.name);
  });
  const dirSize = offset - dirStart;
  put(new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(dir.length), ...u16(dir.length), ...u32(dirSize), ...u32(dirStart), ...u16(0)]));

  const out = new Uint8Array(offset);
  let p = 0;
  chunks.forEach((c) => {
    out.set(c, p);
    p += c.length;
  });
  return out;
}

/* --- printable PDF, 6 tents per A4 page --- */
export function qrPdf(list: { label: string; url: string }[], brandName: string): Uint8Array {
  const enc = new TextEncoder();
  const objs: string[] = [];
  const add = (str: string) => {
    objs.push(str);
    return objs.length; // 1-indexed
  };

  const PW = 595.28;
  const PH = 841.89; // A4 points
  const cols = 2;
  const rows = 3;
  const per = cols * rows;
  const cw = PW / cols;
  const ch = PH / rows;
  const pages: string[] = [];
  const pdfEscape = (s: string) => s.replace(/[\\()]/g, (c) => "\\" + c);

  for (let i = 0; i < list.length; i += per) {
    const slice = list.slice(i, i + per);
    let cs = "";
    slice.forEach((q, k) => {
      const cx = (k % cols) * cw;
      const cy = PH - (Math.floor(k / cols) + 1) * ch; // PDF origin bottom-left
      // cut guides
      cs += `0.85 g 0.5 w [3 3] 0 d ${cx + 8} ${cy + 8} ${cw - 16} ${ch - 16} re S [] 0 d\n`;
      // wordmark + tagline
      cs += `BT /F2 22 Tf 0.13 0.16 0.12 rg 1 0 0 1 ${cx + cw / 2 - 26} ${cy + ch - 52} Tm (${pdfEscape(brandName)}) Tj ET\n`;
      cs += `BT /F1 7 Tf 0.35 0.39 0.33 rg 1 0 0 1 ${cx + cw / 2 - 42} ${cy + ch - 70} Tm (SCAN  .  ORDER  .  RELAX) Tj ET\n`;
      // QR modules
      const m = qrMatrix(q.url);
      const n = m.length;
      const size = Math.min(cw, ch) * 0.52;
      const cell = size / n;
      const ox = cx + (cw - size) / 2;
      const oy = cy + ch - 92 - size;
      cs += `0.11 0.14 0.12 rg\n`;
      for (let r = 0; r < n; r++) {
        let c = 0;
        while (c < n) {
          if (!m[r][c]) {
            c++;
            continue;
          }
          let w = 1;
          while (c + w < n && m[r][c + w]) w++;
          cs += `${(ox + c * cell).toFixed(2)} ${(oy + (n - 1 - r) * cell).toFixed(2)} ${(w * cell).toFixed(2)} ${cell.toFixed(2)} re f\n`;
          c += w;
        }
      }
      cs += `BT /F1 8 Tf 0.35 0.39 0.33 rg 1 0 0 1 ${cx + cw / 2 - 14} ${oy - 24} Tm (TABLE) Tj ET\n`;
      cs += `BT /F2 20 Tf 0.13 0.16 0.12 rg 1 0 0 1 ${cx + cw / 2 - 11} ${oy - 48} Tm (${pdfEscape(q.label)}) Tj ET\n`;
    });
    pages.push(cs);
  }

  // object graph
  const kidsIds: number[] = [];
  const contentIds: number[] = [];
  pages.forEach((cs) => {
    const cid = add(`<< /Length ${enc.encode(cs).length} >>\nstream\n${cs}endstream`);
    contentIds.push(cid);
  });
  const fontR = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontB = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pagesId = objs.length + pages.length + 1;
  contentIds.forEach((cid) => {
    kidsIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PW} ${PH}] ` +
          `/Resources << /Font << /F1 ${fontR} 0 R /F2 ${fontB} 0 R >> >> /Contents ${cid} 0 R >>`
      )
    );
  });
  const realPagesId = add(`<< /Type /Pages /Kids [${kidsIds.map((i) => i + " 0 R").join(" ")}] /Count ${kidsIds.length} >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${realPagesId} 0 R >>`);
  const fixed = objs.map((o) => o.replace(/\/Parent \d+ 0 R/, `/Parent ${realPagesId} 0 R`));

  let out = "%PDF-1.4\n";
  const offsets = [0];
  fixed.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${fixed.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= fixed.length; i++) out += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  out += `trailer\n<< /Size ${fixed.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return enc.encode(out);
}
