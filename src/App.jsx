import { useCallback, useEffect, useRef, useState } from 'react';
import PaintCanvas from './components/PaintCanvas';
import { loadImageFile, buildWorldFile } from './lib/imageLoader';
import './index.css';

const DEFAULT_QUANT = 32;

export default function App() {
  const [image, setImage] = useState(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState('want');
  const [brushSize, setBrushSize] = useState(24);
  const [strictness, setStrictness] = useState(35);
  const [status, setStatus] = useState('Import an image to get started.');
  const [busy, setBusy] = useState(false);
  const [trained, setTrained] = useState(false);
  const [stats, setStats] = useState(null);
  const [binary, setBinary] = useState(null); // { url, worldFile }

  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const pendingGenerate = useRef(false);
  // Always points at the latest generate handlers so the worker's message
  // callback (bound once) never runs against a stale `image` closure.
  const handlersRef = useRef({});

  // Spin up the classifier worker once.
  useEffect(() => {
    const worker = new Worker(
      new URL('./lib/classifier.worker.js', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'trained') {
        setTrained(true);
        setStats({ wantCells: msg.wantCells, dontCells: msg.dontCells });
        setStatus(
          `Lookup table built from ${msg.wantCells} "want" and ${msg.dontCells} "don't want" colors.`
        );
        if (pendingGenerate.current) {
          pendingGenerate.current = false;
          handlersRef.current.runGenerate();
        } else {
          setBusy(false);
        }
      } else if (msg.type === 'generated') {
        handlersRef.current.finishGenerate(msg);
      } else if (msg.type === 'error') {
        setStatus(msg.message);
        setBusy(false);
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setBusy(true);
    setStatus(`Loading ${file.name}…`);
    try {
      const loaded = await loadImageFile(file);
      setImage(loaded);
      setFileName(file.name);
      setTrained(false);
      setStats(null);
      setBinary((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return null;
      });
      const geoNote = loaded.geo ? ' Georeferencing detected — a world file will accompany the export.' : '';
      setStatus(`Loaded ${file.name} (${loaded.width}×${loaded.height}).${geoNote}`);
    } catch (err) {
      setStatus(`Failed to load image: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  // Extract painted sample colors from the label map and build the LUT.
  const handleTrain = useCallback(() => {
    if (!image) return;
    const map = canvasRef.current?.getLabelMap();
    if (!map) return;

    const data = image.imageData.data;
    const want = [];
    const dont = [];
    for (let p = 0; p < map.length; p++) {
      if (map[p] === 1) {
        want.push(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
      } else if (map[p] === 2) {
        dont.push(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
      }
    }
    if (want.length === 0 || dont.length === 0) {
      setStatus('Paint some "want" (green) and "don\'t want" (red) areas first.');
      return;
    }

    setBusy(true);
    setStatus('Building lookup table…');
    workerRef.current.postMessage({
      type: 'train',
      wantColors: new Uint8Array(want),
      dontColors: new Uint8Array(dont),
      strictness,
      quant: DEFAULT_QUANT,
    });
  }, [image, strictness]);

  const runGenerate = useCallback(() => {
    setStatus('Generating binary image…');
    const src = image.imageData.data;
    const pixels = new Uint8ClampedArray(src); // copy; transferred to worker
    workerRef.current.postMessage(
      { type: 'generate', pixels, width: image.width, height: image.height },
      [pixels.buffer]
    );
  }, [image]);

  const finishGenerate = useCallback((msg) => {
    const canvas = document.createElement('canvas');
    canvas.width = msg.width;
    canvas.height = msg.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(msg.out, msg.width, msg.height), 0, 0);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      setBinary((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { url, worldFile: image.geo ? buildWorldFile(image.geo) : null };
      });
      setStatus('Binary image ready. Preview it on the right, then download.');
      setBusy(false);
    }, 'image/png');
  }, [image]);

  // Expose the latest closures to the worker callback.
  useEffect(() => {
    handlersRef.current = { runGenerate, finishGenerate };
  }, [runGenerate, finishGenerate]);

  const handleGenerate = useCallback(() => {
    if (!image) return;
    setBusy(true);
    if (!trained) {
      // Build the table first, then generate automatically.
      pendingGenerate.current = true;
      handleTrain();
    } else {
      runGenerate();
    }
  }, [image, trained, handleTrain, runGenerate]);

  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
    setTrained(false);
    setStats(null);
    setStatus('Annotations cleared.');
  }, []);

  const downloadBinary = useCallback(() => {
    if (!binary) return;
    const base = (fileName.replace(/\.[^.]+$/, '') || 'image') + '_binary';
    const a = document.createElement('a');
    a.href = binary.url;
    a.download = `${base}.png`;
    a.click();
    if (binary.worldFile) {
      const wfUrl = URL.createObjectURL(
        new Blob([binary.worldFile], { type: 'text/plain' })
      );
      const wf = document.createElement('a');
      wf.href = wfUrl;
      wf.download = `${base}.pgw`;
      wf.click();
      setTimeout(() => URL.revokeObjectURL(wfUrl), 1000);
    }
  }, [binary, fileName]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case '1': setMode('want'); break;
        case '2': setMode('dont'); break;
        case '3': setMode('erase'); break;
        case '[': setBrushSize((s) => Math.max(1, s - 4)); break;
        case ']': setBrushSize((s) => Math.min(200, s + 4)); break;
        case 'f': case 'F': canvasRef.current?.fit(); break;
        case 't': case 'T': handleTrain(); break;
        case 'g': case 'G': handleGenerate(); break;
        case 'c': case 'C': handleClear(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleTrain, handleGenerate, handleClear]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <h1>Image Binary Classifier</h1>
        </div>
        <label className="btn btn-import">
          Import image
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.tif,.tiff,image/png,image/jpeg,image/tiff"
            onChange={(e) => handleFile(e.target.files[0])}
            hidden
          />
        </label>
      </header>

      <div className="body">
        <aside className="panel">
          <section className="group">
            <h2>Brush</h2>
            <div className="mode-row">
              <button
                className={`mode want ${mode === 'want' ? 'active' : ''}`}
                onClick={() => setMode('want')}
                title="Paint areas you want — becomes 1 (white)"
              >
                Want <span>1 · white</span>
              </button>
              <button
                className={`mode dont ${mode === 'dont' ? 'active' : ''}`}
                onClick={() => setMode('dont')}
                title="Paint areas you don't want — becomes 0 (black)"
              >
                Don&apos;t want <span>0 · black</span>
              </button>
              <button
                className={`mode erase ${mode === 'erase' ? 'active' : ''}`}
                onClick={() => setMode('erase')}
                title="Remove annotations"
              >
                Erase
              </button>
            </div>
            <label className="slider">
              Brush size <b>{brushSize}px</b>
              <input
                type="range" min="1" max="200" value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
              />
            </label>
          </section>

          <section className="group">
            <h2>Lookup table</h2>
            <label className="slider">
              Strictness <b>{strictness}</b>
              <input
                type="range" min="0" max="100" value={strictness}
                onChange={(e) => { setStrictness(Number(e.target.value)); setTrained(false); }}
              />
            </label>
            <p className="hint">
              Higher strictness keeps only colors close to your &quot;want&quot; samples;
              lower assigns every pixel to its nearest class.
            </p>
            <button className="btn" disabled={!image || busy} onClick={handleTrain}>
              Build lookup table
            </button>
            {stats && (
              <p className="stats">
                {stats.wantCells} want · {stats.dontCells} don&apos;t-want colors
              </p>
            )}
          </section>

          <section className="group">
            <h2>Output</h2>
            <button className="btn primary" disabled={!image || busy} onClick={handleGenerate}>
              Generate binary
            </button>
            <button className="btn ghost" disabled={!binary} onClick={downloadBinary}>
              Download{binary?.worldFile ? ' PNG + world file' : ' PNG'}
            </button>
          </section>

          <section className="group">
            <h2>View</h2>
            <div className="mini-row">
              <button className="btn small" disabled={!image} onClick={() => canvasRef.current?.fit()}>Fit</button>
              <button className="btn small" disabled={!image} onClick={handleClear}>Clear</button>
            </div>
            <p className="hint">
              Scroll to zoom · middle-drag or hold Space to pan.<br />
              Keys: 1 want · 2 don&apos;t · 3 erase · [ ] size · F fit · T train · G generate · C clear
            </p>
          </section>
        </aside>

        <main className="stage-wrap">
          <PaintCanvas ref={canvasRef} image={image} mode={mode} brushSize={brushSize} />
          {binary && (
            <div className="preview">
              <div className="preview-head">Binary preview</div>
              <img src={binary.url} alt="Binary output" />
            </div>
          )}
        </main>
      </div>

      <footer className={`statusbar ${busy ? 'busy' : ''}`}>
        {busy && <span className="spinner" />}
        {status}
        {fileName && <span className="filetag">{fileName}</span>}
      </footer>
    </div>
  );
}
