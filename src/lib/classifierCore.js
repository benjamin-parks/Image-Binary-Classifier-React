// Pure, dependency-free color lookup-table classifier.
//
// Training quantizes RGB space into a Q x Q x Q grid and, for every cell,
// records whether that color is closer to a "want" sample or a "don't want"
// sample (1-nearest-neighbor). The result is a flat lookup table: given any
// pixel color you index straight into it to get 1 (white) or 0 (black).
// Generating the binary is then one table lookup per pixel.

// Dedupe raw samples down to occupied grid cells (many painted pixels share a
// color) and return them as flat [r,g,b, r,g,b, ...] index triplets.
export function toSeeds(colors, Q, cellSize) {
  const seen = new Set();
  const seeds = [];
  for (let i = 0; i < colors.length; i += 3) {
    const r = Math.min(Q - 1, (colors[i] / cellSize) | 0);
    const g = Math.min(Q - 1, (colors[i + 1] / cellSize) | 0);
    const b = Math.min(Q - 1, (colors[i + 2] / cellSize) | 0);
    const key = (r * Q + g) * Q + b;
    if (!seen.has(key)) {
      seen.add(key);
      seeds.push(r, g, b);
    }
  }
  return seeds;
}

export function nearestSq(r, g, b, seeds) {
  let best = Infinity;
  for (let k = 0; k < seeds.length; k += 3) {
    const dr = r - seeds[k];
    const dg = g - seeds[k + 1];
    const db = b - seeds[k + 2];
    const d = dr * dr + dg * dg + db * db;
    if (d < best) best = d;
  }
  return best;
}

export function buildLut(wantColors, dontColors, strictness, Q) {
  const cellSize = 256 / Q;
  const wantSeeds = toSeeds(wantColors, Q, cellSize);
  const dontSeeds = toSeeds(dontColors, Q, cellSize);

  // strictness 0   -> no distance limit (every pixel picks its nearest class)
  // strictness 100 -> only exact "want" colors survive
  const maxDist = Math.sqrt(3) * (Q - 1);
  const cutoff = strictness <= 0 ? Infinity : (1 - strictness / 100) * maxDist;
  const cutoffSq = cutoff === Infinity ? Infinity : cutoff * cutoff;

  const table = new Uint8Array(Q * Q * Q);
  for (let r = 0; r < Q; r++) {
    for (let g = 0; g < Q; g++) {
      for (let b = 0; b < Q; b++) {
        const dW = nearestSq(r, g, b, wantSeeds);
        const dD = nearestSq(r, g, b, dontSeeds);
        table[(r * Q + g) * Q + b] = dW < dD && dW <= cutoffSq ? 1 : 0;
      }
    }
  }
  return { table, wantCells: wantSeeds.length / 3, dontCells: dontSeeds.length / 3 };
}

export function generate(lut, pixels, width, height, Q) {
  const cellSize = 256 / Q;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const r = Math.min(Q - 1, (pixels[p * 4] / cellSize) | 0);
    const g = Math.min(Q - 1, (pixels[p * 4 + 1] / cellSize) | 0);
    const b = Math.min(Q - 1, (pixels[p * 4 + 2] / cellSize) | 0);
    const v = lut[(r * Q + g) * Q + b] ? 255 : 0;
    out[p * 4] = v;
    out[p * 4 + 1] = v;
    out[p * 4 + 2] = v;
    out[p * 4 + 3] = 255;
  }
  return out;
}
