import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

function AnnotateImage({ file, drawingMode, yesArrayRef, noArrayRef, setCanvasRef }) {
  const canvasRef = useRef(null);
  const [imageData, setImageData] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [annotationMask, setAnnotationMask] = useState(null);

  const setCanvasRefCallback = useCallback(node => {
    if (node !== null) {
      canvasRef.current = node;
      setCanvasRef(node);
    }
  }, [setCanvasRef]);

  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setImageData(img);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }, [file]);

  useEffect(() => {
    if (imageData && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      redrawCanvas();
      createMask(); // Create mask after image and annotations are set
    }
  }, [imageData, scale, offset, annotations]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx && imageData) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imageData, offset.x, offset.y, imageData.width * scale, imageData.height * scale);
      drawAnnotations(ctx);
    }
  };

  const drawAnnotations = (ctx) => {
    annotations.forEach(annotation => {
      ctx.beginPath();
      ctx.strokeStyle = annotation.color;
      annotation.points.forEach((point, index) => {
        const x = point.x * scale + offset.x;
        const y = point.y * scale + offset.y;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });
  };

  const createMask = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskCtx = maskCanvas.getContext('2d');
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

      // Draw annotations on the mask canvas
      annotations.forEach(annotation => {
        maskCtx.beginPath();
        maskCtx.strokeStyle = 'black'; // Color for annotation lines
        annotation.points.forEach((point, index) => {
          const x = point.x * scale + offset.x;
          const y = point.y * scale + offset.y;
          if (index === 0) {
            maskCtx.moveTo(x, y);
          } else {
            maskCtx.lineTo(x, y);
          }
        });
        maskCtx.stroke();
      });

      setAnnotationMask(maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height));
    }
  };

  const handleMouseDown = (event) => {
    if (event.button === 1) { // Middle mouse button for panning
      event.preventDefault();
      setIsPanning(true);
      setStartPan({ x: event.clientX, y: event.clientY });
    } else if (event.button === 0) { // Left mouse button for drawing
      const color = drawingMode === 'plant' ? '#FFFFFF' : '#FF0000';
      const newAnnotation = {
        color,
        points: [],
      };
      setAnnotations(prevAnnotations => [...prevAnnotations, newAnnotation]);
      addPointToAnnotation(event, newAnnotation);
    }
  };

  const handleMouseMove = (event) => {
    if (isPanning) {
      const dx = event.clientX - startPan.x;
      const dy = event.clientY - startPan.y;
      setOffset(prevOffset => ({
        x: prevOffset.x + dx,
        y: prevOffset.y + dy
      }));
      setStartPan({ x: event.clientX, y: event.clientY });
    } else if (event.buttons === 1 && annotations.length > 0) { // Drawing
      addPointToAnnotation(event, annotations[annotations.length - 1]);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const addPointToAnnotation = (event, annotation) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left - offset.x) / scale;
    const y = (event.clientY - rect.top - offset.y) / scale;
    annotation.points.push({ x, y });

    const ctx = canvasRef.current.getContext('2d');
    const imageData = ctx.getImageData(x * scale + offset.x, y * scale + offset.y, 1, 1).data;
    const rgbValue = [imageData[0], imageData[1], imageData[2]];

    if (drawingMode === 'plant') {
      yesArrayRef.current.push(rgbValue);
    } else {
      noArrayRef.current.push(rgbValue);
    }

    redrawCanvas();
  };

  return (
    <>
      {imageData && (
        <canvas
          ref={setCanvasRefCallback}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseOut={handleMouseUp}
          style={{ border: '1px solid black', display: 'block' }}
        />
      )}
    </>
  );
}

AnnotateImage.propTypes = {
  file: PropTypes.object,
  drawingMode: PropTypes.string.isRequired,
  yesArrayRef: PropTypes.shape({
    current: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number))
  }).isRequired,
  noArrayRef: PropTypes.shape({
    current: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number))
  }).isRequired,
  setCanvasRef: PropTypes.func.isRequired,
};

export default AnnotateImage;
