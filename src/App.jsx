import { useState } from 'react'
import './App.css'
import Button from './components/Button'
import Instructions from './components/Instructions'

function App() {

  return (
    <>
    <h1 className="text-center pt-3">Image Annotator</h1>
      <div className="d-flex justify-content-center pt-4" style={{display:"inline"}}>
        <Button title="Want" size="3" buttonName="want"/>
        <Button title="Don't Want" size="3" buttonName="dontWant"/>
      </div>
      <br />
      <div className="d-flex justify-content-center pt-2" style={{display:"inline"}}>
        <Button title="Clear Annotations" size="1" buttonName="clearAnnos"/>
        <Button title="Save Annotations" size="1" buttonName="saveAnnos"/>
        <Button title="Train Data" size="1" buttonName="train"/>
        <Button title="Generate Binary" size="1" buttonName="genBinary"/>
        <Button title="Batch Inference" size="1" buttonName="batchInference"/>
        <Button title="Download Binary(s)" size="1" buttonName="download"/>
      </div>
      <br/>
      <Instructions/>
    </>
  )
}

export default App
