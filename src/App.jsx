import { useState } from 'react'
import './App.css'
import Button from './components/Button'
import Instructions from './components/Instructions'
import FileImport from './components/FileImport'
import AnnotateImage from './components/AnnotateImage'

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [drawingMode, setDrawingMode] = useState('plant');

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const togglePlantMode = () => {
    setDrawingMode('plant');
  };

  const toggleNonPlantMode = () => {
    setDrawingMode('nonPlant');
  };

  return (
    <>
      <h1 className="text-center pt-3">Image Annotator</h1>
      <div className="d-flex justify-content-center pt-4" style={{ display: "inline" }}>
        <Button title="Want" size="3" buttonName="want" onClick={togglePlantMode} />
        <Button title="Don't Want" size="3" buttonName="dontWant" onClick={toggleNonPlantMode} />
      </div>
      <br />
      <div className="d-flex justify-content-center pt-2" style={{ display: "inline" }}>
        <Button title="Clear Annotations" size="1" buttonName="clearAnnos"/>
        <Button title="Save Annotations" size="1" buttonName="saveAnnos"/>
        <Button title="Train Data" size="1" buttonName="train"/>
        <Button title="Generate Binary" size="1" buttonName="genBinary"/>
        <Button title="Batch Inference" size="1" buttonName="batchInference"/>
        <Button title="Download Binary(s)" size="1" buttonName="download"/>
      </div>
      <br />
      <AnnotateImage file={selectedFile} drawingMode={drawingMode} />
      <br/>
      <Instructions/>
      <FileImport file="single" onFileSelect={handleFileSelect} />
      <FileImport />
    </>
  )
}

export default App;
