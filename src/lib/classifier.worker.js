// Web Worker wrapper around the pure lookup-table classifier. Keeps the LUT
// build and per-pixel binary generation off the main thread.
import { buildLut, generate } from './classifierCore.js';

let lut = null;
let quant = 32;

self.onmessage = (event) => {
  const msg = event.data;

  if (msg.type === 'train') {
    quant = msg.quant;
    const { table, wantCells, dontCells } = buildLut(
      msg.wantColors,
      msg.dontColors,
      msg.strictness,
      quant
    );
    lut = table;
    self.postMessage({ type: 'trained', wantCells, dontCells });
    return;
  }

  if (msg.type === 'generate') {
    if (!lut) {
      self.postMessage({ type: 'error', message: 'Build the lookup table first.' });
      return;
    }
    const out = generate(lut, msg.pixels, msg.width, msg.height, quant);
    self.postMessage(
      { type: 'generated', width: msg.width, height: msg.height, out },
      [out.buffer]
    );
  }
};
