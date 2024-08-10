import React, { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 800;  // Fixed canvas width
const CANVAS_HEIGHT = 600; // Fixed canvas height

export default function AnnotateImage({ file, drawingMode }) {
    const canvasRef = useRef(null);
    const [imageData, setImageData] = useState(null);
    const [annotations, setAnnotations] = useState([]);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    setImageData(img);
                    redrawCanvas();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }, [file]);

    useEffect(() => {
        redrawCanvas();
    }, [scale, offset, annotations, imageData]);

    useEffect(() => {
        const handleWheel = (event) => {
            if (event.ctrlKey) {
                event.preventDefault();
                const delta = event.deltaY < 0 ? 1.1 : 0.9;
                setScale(prevScale => Math.max(0.1, Math.min(10, prevScale * delta)));
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'r' || event.key === 'R') {
                resetZoom();
            }
        };

        const canvas = canvasRef.current;
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            canvas.removeEventListener('wheel', handleWheel);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const redrawCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (imageData) {
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

    const resetZoom = () => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
        redrawCanvas();
    };

    const addPointToAnnotation = (event, annotation) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (event.clientX - rect.left - offset.x) / scale;
        const y = (event.clientY - rect.top - offset.y) / scale;
        annotation.points.push({ x, y });
        redrawCanvas();
    };

    return (
        <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseOut={handleMouseUp}
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, border: '1px solid black' }}
        />
    );
}
