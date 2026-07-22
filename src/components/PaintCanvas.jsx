import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

// Label map values.
const WANT = 1;
const DONT = 2;

// Overlay colors for each label (semi-transparent so the image shows through).
const OVERLAY = {
  [WANT]: [0, 210, 90, 150],
  [DONT]: [235, 40, 40, 150],
};

const PaintCanvas = forwardRef(function PaintCanvas(
  { image, mode, brushSize },
  ref
) {
  const containerRef = useRef(null);
  const imageCanvasRef = useRef(null);
  const paintCanvasRef = useRef(null);
  const labelMapRef = useRef(null); // Uint8Array, one entry per pixel

  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const drawingRef = useRef(false);
  const lastPtRef = useRef(null);
  const panRef = useRef(null);
  const spaceRef = useRef(false);

  // Keep the latest tool settings available inside pointer handlers.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const brushRef = useRef(brushSize);
  brushRef.current = brushSize;

  const fitView = useCallback(() => {
    const container = containerRef.current;
    if (!container || !image) return;
    const pad = 24;
    const scale = Math.min(
      (container.clientWidth - pad) / image.width,
      (container.clientHeight - pad) / image.height,
      1
    );
    const s = scale > 0 ? scale : 1;
    setView({
      scale: s,
      x: (container.clientWidth - image.width * s) / 2,
      y: (container.clientHeight - image.height * s) / 2,
    });
  }, [image]);

  // Load a new image: paint it onto the base canvas and reset the label map.
  useEffect(() => {
    if (!image) return;
    labelMapRef.current = new Uint8Array(image.width * image.height);

    const imgCanvas = imageCanvasRef.current;
    imgCanvas.width = image.width;
    imgCanvas.height = image.height;
    imgCanvas.getContext('2d').putImageData(image.imageData, 0, 0);

    const paint = paintCanvasRef.current;
    paint.width = image.width;
    paint.height = image.height;
    paint.getContext('2d').clearRect(0, 0, paint.width, paint.height);

    fitView();
  }, [image, fitView]);

  // Convert a pointer event to image-pixel coordinates.
  const toPixel = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: (e.clientX - rect.left - v.x) / v.scale,
      y: (e.clientY - rect.top - v.y) / v.scale,
    };
  }, []);

  // Stamp a filled circle into the label map; returns the touched bounding box.
  const stamp = useCallback((cx, cy) => {
    const map = labelMapRef.current;
    const w = image.width;
    const h = image.height;
    const value = modeRef.current === 'erase' ? 0 : modeRef.current === 'want' ? WANT : DONT;
    const radius = Math.max(0.5, brushRef.current / 2);
    const r2 = radius * radius;

    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(w - 1, Math.ceil(cx + radius));
    const y1 = Math.min(h - 1, Math.ceil(cy + radius));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) map[y * w + x] = value;
      }
    }
    return { x0, y0, x1, y1 };
  }, [image]);

  // Repaint a rectangle of the overlay canvas straight from the label map so
  // it always matches the underlying labels (erasing included).
  const refreshRegion = useCallback((box) => {
    if (box.x1 < box.x0 || box.y1 < box.y0) return;
    const ctx = paintCanvasRef.current.getContext('2d');
    const w = image.width;
    const map = labelMapRef.current;
    const rw = box.x1 - box.x0 + 1;
    const rh = box.y1 - box.y0 + 1;
    const region = ctx.createImageData(rw, rh);
    for (let yy = 0; yy < rh; yy++) {
      for (let xx = 0; xx < rw; xx++) {
        const label = map[(box.y0 + yy) * w + (box.x0 + xx)];
        const o = (yy * rw + xx) * 4;
        const color = OVERLAY[label];
        if (color) {
          region.data[o] = color[0];
          region.data[o + 1] = color[1];
          region.data[o + 2] = color[2];
          region.data[o + 3] = color[3];
        }
      }
    }
    ctx.putImageData(region, box.x0, box.y0);
  }, [image]);

  // Paint along a segment so fast strokes stay continuous.
  const paintSegment = useCallback((from, to) => {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const step = Math.max(1, brushRef.current / 4);
    const steps = Math.max(1, Math.ceil(dist / step));
    let box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const b = stamp(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      box.x0 = Math.min(box.x0, b.x0);
      box.y0 = Math.min(box.y0, b.y0);
      box.x1 = Math.max(box.x1, b.x1);
      box.y1 = Math.max(box.y1, b.y1);
    }
    refreshRegion(box);
  }, [stamp, refreshRegion]);

  const onPointerDown = useCallback((e) => {
    if (!image) return;
    containerRef.current.setPointerCapture(e.pointerId);
    // Middle mouse or space-held = pan.
    if (e.button === 1 || spaceRef.current) {
      panRef.current = { x: e.clientX, y: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y };
      return;
    }
    if (e.button !== 0) return;
    drawingRef.current = true;
    const pt = toPixel(e);
    lastPtRef.current = pt;
    paintSegment(pt, pt);
  }, [image, toPixel, paintSegment]);

  const onPointerMove = useCallback((e) => {
    if (panRef.current) {
      setView((v) => ({
        ...v,
        x: panRef.current.ox + (e.clientX - panRef.current.x),
        y: panRef.current.oy + (e.clientY - panRef.current.y),
      }));
      return;
    }
    if (!drawingRef.current) return;
    const pt = toPixel(e);
    paintSegment(lastPtRef.current, pt);
    lastPtRef.current = pt;
  }, [toPixel, paintSegment]);

  const endStroke = useCallback((e) => {
    drawingRef.current = false;
    panRef.current = null;
    lastPtRef.current = null;
    if (e && containerRef.current.hasPointerCapture?.(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  }, []);

  // Zoom toward the cursor.
  const onWheel = useCallback((e) => {
    if (!image) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const scale = Math.min(40, Math.max(0.05, v.scale * factor));
      const ratio = scale / v.scale;
      return { scale, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio };
    });
  }, [image]);

  // Track spacebar for panning.
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space') spaceRef.current = true;
    };
    const up = (e) => {
      if (e.code === 'Space') spaceRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getLabelMap: () => labelMapRef.current,
    fit: fitView,
    clear: () => {
      if (!image || !labelMapRef.current) return;
      labelMapRef.current.fill(0);
      const paint = paintCanvasRef.current;
      paint.getContext('2d').clearRect(0, 0, paint.width, paint.height);
    },
  }), [image, fitView]);

  return (
    <div
      ref={containerRef}
      className="canvas-stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      onWheel={onWheel}
    >
      {!image && <div className="canvas-empty">Import a PNG, JPEG, or GeoTIFF to begin.</div>}
      <div
        className="canvas-layers"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          visibility: image ? 'visible' : 'hidden',
        }}
      >
        <canvas ref={imageCanvasRef} className="layer" />
        <canvas ref={paintCanvasRef} className="layer" />
      </div>
    </div>
  );
});

export default PaintCanvas;
