import { fromArrayBuffer } from 'geotiff';

// A loaded image is normalized to a common shape regardless of source format:
//   { width, height, imageData: ImageData, geo: GeoInfo | null }
// `geo` is only populated for GeoTIFFs that carry a model transform / tiepoint.

function isTiff(file) {
  const name = (file.name || '').toLowerCase();
  return (
    name.endsWith('.tif') ||
    name.endsWith('.tiff') ||
    file.type === 'image/tiff' ||
    file.type === 'image/geotiff'
  );
}

// Decode a standard raster (PNG / JPEG) through an <img> + canvas.
async function loadStandardRaster(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image.'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, imageData, geo: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Build a per-band value->0..255 mapping. 8-bit data passes through untouched;
// anything wider (16-bit, float DEMs, etc.) gets a min/max contrast stretch so
// it is actually visible and so color relationships stay comparable.
function makeStretch(band, isByte) {
  if (isByte) return (v) => v;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min || 1;
  return (v) => ((v - min) / range) * 255;
}

async function loadGeoTiff(file) {
  const buffer = await file.arrayBuffer();
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();

  // Bands come back as one typed array per sample.
  const bands = await image.readRasters();
  const sampleCount = bands.length;
  const isByte =
    bands[0] instanceof Uint8Array || bands[0] instanceof Uint8ClampedArray;

  // Map available bands onto R/G/B. Grayscale replicates a single band.
  let rIdx = 0;
  let gIdx = sampleCount > 1 ? 1 : 0;
  let bIdx = sampleCount > 2 ? 2 : 0;

  const rf = makeStretch(bands[rIdx], isByte);
  const gf = makeStretch(bands[gIdx], isByte);
  const bf = makeStretch(bands[bIdx], isByte);
  const hasAlpha = sampleCount === 4 && isByte;

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = rf(bands[rIdx][i]);
    rgba[i * 4 + 1] = gf(bands[gIdx][i]);
    rgba[i * 4 + 2] = bf(bands[bIdx][i]);
    rgba[i * 4 + 3] = hasAlpha ? bands[3][i] : 255;
  }

  const imageData = new ImageData(rgba, width, height);

  // Pull georeferencing if present so the exported mask can stay aligned.
  let geo = null;
  try {
    const origin = image.getOrigin();
    const resolution = image.getResolution();
    if (origin && resolution) {
      geo = {
        origin, // [x, y, z] of the top-left corner
        resolution, // [xRes, yRes, zRes]; yRes is normally negative
        bbox: image.getBoundingBox(),
      };
    }
  } catch {
    geo = null;
  }

  return { width, height, imageData, geo };
}

export async function loadImageFile(file) {
  if (isTiff(file)) return loadGeoTiff(file);
  return loadStandardRaster(file);
}

// Build an ESRI-style world file body for a PNG (.pgw). Lines are:
// pixel-size-x, rotation-y, rotation-x, pixel-size-y, x-of-center-of-UL-px,
// y-of-center-of-UL-px.
export function buildWorldFile(geo) {
  if (!geo) return null;
  const [xRes, yRes] = geo.resolution;
  const [ox, oy] = geo.origin;
  return [
    xRes,
    0,
    0,
    yRes,
    ox + xRes / 2,
    oy + yRes / 2,
  ].join('\n');
}
