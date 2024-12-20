import React, { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import './Board.css';

const Board = () => {
  const [images, setImages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [resizing, setResizing] = useState(null);
  const initialMousePos = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Backspace' && selectedId) {
        handleDelete(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId]);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const aspectRatio = img.width / img.height;
            const baseSize = 200;
            const width = aspectRatio > 1 ? baseSize * aspectRatio : baseSize;
            const height = aspectRatio > 1 ? baseSize : baseSize / aspectRatio;
            
            setImages(prev => [...prev, {
              id: crypto.randomUUID(),
              url: event.target.result,
              position: {
                x: e.nativeEvent.offsetX - width/2,
                y: e.nativeEvent.offsetY - height/2
              },
              size: { width, height },
              aspectRatio
            }]);
          };
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDelete = (id) => {
    setImages(images.filter(image => image.id !== id));
    setSelectedId(null);
  };

  const handleImageClick = (e, id) => {
    e.stopPropagation();
    setSelectedId(id);
  };

  const handleBoardClick = () => {
    setSelectedId(null);
  };

  const startResize = (e, id, handle) => {
    e.stopPropagation();
    const image = images.find(img => img.id === id);
    initialMousePos.current = { x: e.clientX, y: e.clientY };
    initialSize.current = { ...image.size };
    setResizing({ id, handle });
  };

  const handleMouseMove = (e) => {
    if (!resizing) return;

    const dx = e.clientX - initialMousePos.current.x;
    const dy = e.clientY - initialMousePos.current.y;
    const image = images.find(img => img.id === resizing.id);
    const aspectRatio = initialSize.current.width / initialSize.current.height;

    let newWidth = initialSize.current.width;
    let newHeight = initialSize.current.height;

    switch (resizing.handle) {
      case 'se':
        newWidth = initialSize.current.width + dx;
        newHeight = newWidth / aspectRatio;
        break;
      case 'sw':
        newWidth = initialSize.current.width - dx;
        newHeight = newWidth / aspectRatio;
        break;
      case 'ne':
        newWidth = initialSize.current.width + dx;
        newHeight = newWidth / aspectRatio;
        break;
      case 'nw':
        newWidth = initialSize.current.width - dx;
        newHeight = newWidth / aspectRatio;
        break;
    }

    // Constrain size
    newWidth = Math.max(50, Math.min(500, newWidth));
    newHeight = Math.max(50, Math.min(500, newHeight));

    setImages(images.map(img =>
      img.id === resizing.id
        ? { ...img, size: { width: newWidth, height: newHeight } }
        : img
    ));
  };

  const stopResize = () => {
    setResizing(null);
  };

  return (
    <div 
      className="board"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleBoardClick}
      onMouseMove={handleMouseMove}
      onMouseUp={stopResize}
      onMouseLeave={stopResize}
    >
      {images.length === 0 && (
        <div className="drop-zone">
          <p>Drag and drop images here</p>
        </div>
      )}
      <div className="images-container">
        {images.map((image) => (
          <Draggable 
            key={image.id} 
            defaultPosition={image.position}
            bounds="parent"
            handle=".drag-handle"
          >
            <div 
              className={`image-wrapper ${selectedId === image.id ? 'selected' : ''}`}
              onClick={(e) => handleImageClick(e, image.id)}
            >
              <div 
                className="drag-handle"
                style={{ 
                  width: image.size.width, 
                  height: image.size.height,
                  backgroundSize: `${20 * image.aspectRatio}px 20px`
                }}
              >
                <img 
                  src={image.url} 
                  alt="Uploaded content"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              {selectedId === image.id && (
                <>
                  <div className="resize-handle nw" onMouseDown={(e) => startResize(e, image.id, 'nw')} />
                  <div className="resize-handle ne" onMouseDown={(e) => startResize(e, image.id, 'ne')} />
                  <div className="resize-handle sw" onMouseDown={(e) => startResize(e, image.id, 'sw')} />
                  <div className="resize-handle se" onMouseDown={(e) => startResize(e, image.id, 'se')} />
                </>
              )}
            </div>
          </Draggable>
        ))}
      </div>
    </div>
  );
};

export default Board; 