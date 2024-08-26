import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import "./App.css";
import Button from './components/Button';
import Instructions from './components/Instructions';
import FileImport from './components/FileImport';
import AnnotateImage from './components/AnnotateImage';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [drawingMode, setDrawingMode] = useState('plant');
  const [modelTrained, setModelTrained] = useState(false);
  const yesArrayRef = useRef([]);
  const noArrayRef = useRef([]);
  const [canvasRef, setCanvasRef] = useState(null);
  const [model, setModel] = useState(null);
  const [imageDataUrl, setImageDataUrl] = useState(null); // Store image data URL

  // Use refs to keep track of state within event handlers
  const modelRef = useRef(model);
  const imageDataUrlRef = useRef(imageDataUrl);
  const modelTrainedRef = useRef(modelTrained);

  useEffect(() => {
    modelRef.current = model;
    imageDataUrlRef.current = imageDataUrl;
    modelTrainedRef.current = modelTrained;
  }, [model, imageDataUrl, modelTrained]);

  const handleSetCanvasRef = useCallback((node) => {
    setCanvasRef(node);
  }, []);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    handleImageLoad(file); // Load image when file is selected
  };

  const togglePlantMode = () => {
    setDrawingMode('plant');
  };

  const toggleNonPlantMode = () => {
    setDrawingMode('nonPlant');
  };

  const normalizeData = (data) => data.map(([r, g, b]) => [r / 255, g / 255, b / 255]);

  const handleTrainModel = async () => {
    if (yesArrayRef.current.length === 0 || noArrayRef.current.length === 0) {
      alert('Please annotate the image before training.');
      return;
    }

    const normalizedYesData = normalizeData(yesArrayRef.current);
    const normalizedNoData = normalizeData(noArrayRef.current);

    // Create and train the model
    const newModel = tf.sequential();
    newModel.add(tf.layers.dense({ units: 64, inputShape: [3], activation: 'relu' }));
    newModel.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    newModel.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    newModel.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    newModel.add(tf.layers.dense({ units: 2, activation: 'softmax' }));

    newModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    const yesLabels = tf.tensor2d(Array(normalizedYesData.length).fill([1, 0]), [normalizedYesData.length, 2]);
    const noLabels = tf.tensor2d(Array(normalizedNoData.length).fill([0, 1]), [normalizedNoData.length, 2]);
    const inputs = tf.tensor2d([...normalizedYesData, ...normalizedNoData], [normalizedYesData.length + normalizedNoData.length, 3]);
    const labels = tf.concat([yesLabels, noLabels]);

    await newModel.fit(inputs, labels, {
      epochs: 100,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: ${logs.loss}`);
          }
        },
      },
    });

    setModel(newModel);
    setModelTrained(true);
    console.log("Model trained and set.");
    alert('Model training complete.');
  };

  const handleGenerateBinary = async () => {
    console.log("Model trained:", modelTrainedRef.current);
    console.log("Model instance:", modelRef.current);
    console.log("Image data URL:", imageDataUrlRef.current);

    if (!modelTrainedRef.current) {
      alert("Model is not trained yet.");
      return;
    }

    if (!imageDataUrlRef.current) {
      alert("Image data is not available.");
      return;
    }

    // Create an off-screen canvas to process the image data
    const image = new Image();
    image.src = imageDataUrlRef.current;
    await new Promise((resolve) => {
      image.onload = resolve;
    });

    const offCanvas = document.createElement('canvas');
    offCanvas.width = image.width;
    offCanvas.height = image.height;
    const ctx = offCanvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height);
    const data = imageData.data;
    const binaryImageData = new Uint8Array(data.length / 4);

    const BATCH_SIZE = 1000;
    const numPixels = data.length / 4;

    // Create a list of promises to handle asynchronous prediction
    const promises = [];
    for (let i = 0; i < numPixels; i += BATCH_SIZE) {
      const batch = [];
      for (let j = i; j < i + BATCH_SIZE && j < numPixels; j++) {
        const r = data[j * 4] / 255;
        const g = data[j * 4 + 1] / 255;
        const b = data[j * 4 + 2] / 255;
        batch.push([r, g, b]);
      }

      // Handle predictions asynchronously and store results in the promises array
      const promise = tf.tidy(() => {
        const batchTensor = tf.tensor2d(batch, [batch.length, 3]);
        return modelRef.current.predict(batchTensor).array().then(predictionArray => {
          // Manually dispose the batchTensor after use
          batchTensor.dispose();
          return predictionArray;
        });
      }).then(predictionArray => {
        for (let j = 0; j < batch.length; j++) {
          binaryImageData[i + j] = predictionArray[j][0] > 0.5 ? 1 : 0;
        }
      });

      promises.push(promise);
    }

    // Wait for all promises to resolve
    await Promise.all(promises);

    // Save the binary image after all predictions are complete
    saveBinaryImage(binaryImageData, offCanvas.width, offCanvas.height);
    alert('Binary image generated.');
  };

  const handleClearAnnotations = () => {
    yesArrayRef.current = [];
    noArrayRef.current = [];
    alert("Annotations cleared.");
  };

  const saveBinaryImage = (binaryData, width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    for (let i = 0; i < binaryData.length; i++) {
      const value = binaryData[i] * 255;
      imageData.data[i * 4] = value;
      imageData.data[i * 4 + 1] = value;
      imageData.data[i * 4 + 2] = value;
      imageData.data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'binary_image.png';
    link.click();
  };

  const handleImageLoad = (file) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setImageDataUrl(canvas.toDataURL('image/png')); // Save the image data URL
      if (canvasRef && canvasRef instanceof HTMLCanvasElement) {
        const mainCtx = canvasRef.getContext('2d');
        mainCtx.drawImage(img, 0, 0);
      }
    };
    img.src = URL.createObjectURL(file);
  };

  // Handle key press events
  const handleKeyPress = (event) => {
    console.log("Key pressed:", event.key);
    switch (event.key) {
      case '1':
        togglePlantMode();
        break;
      case '2':
        toggleNonPlantMode();
        break;
      case 'n':
      case 'N':
        handleClearAnnotations();
        break;
      case 't':
      case 'T':
        handleTrainModel();
        break;
      case 'g':
      case 'G':
        handleGenerateBinary();
        break;
      default:
        break;
    }
  };

  // Attach key press handler on mount
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <>
      <h1 className="text-center pt-3">Image Annotator</h1>
      <div className="d-flex justify-content-center pt-4" style={{ display: "inline" }}>
        <Button title="Want" size="3" buttonName="want" onClick={togglePlantMode} />
        <Button title="Don't Want" size="3" buttonName="dontWant" onClick={toggleNonPlantMode} />
      </div>
      <br />
      <div className="d-flex justify-content-center pt-2" style={{ display: "inline" }}>
        <Button title="Clear Annotations" size="1" buttonName="clearAnnos" onClick={handleClearAnnotations} />
        <Button title="Train Data" size="1" buttonName="train" onClick={handleTrainModel} />
        <Button title="Generate Binary" size="1" buttonName="genBinary" onClick={handleGenerateBinary} />
        {/* <Button title="Download Binary(s)" size="1" buttonName="download" /> */}
      </div>
      <br />
      <AnnotateImage 
        file={selectedFile} 
        drawingMode={drawingMode} 
        yesArrayRef={yesArrayRef} 
        noArrayRef={noArrayRef} 
        setCanvasRef={handleSetCanvasRef} 
      />
      <br/>
      <Instructions />
      <FileImport file="single" onFileSelect={handleFileSelect} />
    </>
  );
}

export default App;
