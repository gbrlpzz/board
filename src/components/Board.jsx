import React, { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import './Board.css';

const Board = () => {
  const [images, setImages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [texts, setTexts] = useState([]);
  const [editingText, setEditingText] = useState(null);
  
  const textInputRef = useRef(null);
  const initialMousePos = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ width: 0, height: 0 });
  const boardRef = useRef(null);

  // Handle image deletion with backspace
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Backspace' && selectedId && !editingText) {
        e.preventDefault();
        handleDelete(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingText]);

  // Image drag and drop handlers
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
    setEditingText(null);
  };

  // Board panning handlers
  const handleMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      initialMousePos.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPosition({
        x: e.clientX - initialMousePos.current.x,
        y: e.clientY - initialMousePos.current.y
      });
    } else if (resizing) {
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

      newWidth = Math.max(50, Math.min(500, newWidth));
      newHeight = Math.max(50, Math.min(500, newHeight));

      setImages(images.map(img =>
        img.id === resizing.id
          ? { ...img, size: { width: newWidth, height: newHeight } }
          : img
      ));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    stopResize();
  };

  // Image resize handlers
  const startResize = (e, id, handle) => {
    e.stopPropagation();
    const image = images.find(img => img.id === id);
    initialMousePos.current = { x: e.clientX, y: e.clientY };
    initialSize.current = { ...image.size };
    setResizing({ id, handle });
  };

  const stopResize = () => {
    setResizing(null);
  };

  // Text handlers
  const handleBoardClick = (e) => {
    if (e.target.closest('.image-wrapper') || e.target.closest('.text-wrapper')) {
      return;
    }

    if (e.target.className === 'board-content' || e.target.className === 'images-container') {
      const rect = boardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - position.x;
      const y = e.clientY - rect.top - position.y;
      
      const newText = {
        id: crypto.randomUUID(),
        content: '',
        position: { x, y }
      };
      
      setTexts(prev => [...prev, newText]);
      setEditingText(newText.id);
      setSelectedId(null);
    }
  };

  const handleTextChange = (e, id) => {
    setTexts(texts.map(text =>
      text.id === id ? { ...text, content: e.target.value } : text
    ));
  };

  return (
    <div 
      ref={boardRef}
      className="board"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div 
        className="board-content"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
        onClick={handleBoardClick}
      >
        <div className="images-container">
          {images.length === 0 && texts.length === 0 && (
            <div className="drop-zone">
              <p>Drag and drop images here</p>
            </div>
          )}
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
          
          {texts.map((text) => (
            <Draggable 
              key={text.id}
              position={text.position}
              bounds="parent"
              disabled={editingText === text.id}
              onStart={(e) => {
                if (e.target.tagName === 'INPUT') {
                  return false;
                }
              }}
            >
              <div 
                className="text-wrapper" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {editingText === text.id ? (
                  <input
                    ref={textInputRef}
                    autoFocus
                    type="text"
                    value={text.content}
                    onChange={(e) => handleTextChange(e, text.id)}
                    onBlur={() => {
                      if (!text.content.trim()) {
                        setTexts(prev => prev.filter(t => t.id !== text.id));
                      }
                      setEditingText(null);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.target.blur();
                      }
                    }}
                    style={{
                      width: '100%',
                      minWidth: '120px'
                    }}
                  />
                ) : (
                  <div 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingText(text.id);
                    }}
                    style={{ cursor: 'text' }}
                  >
                    {text.content || 'Click to edit'}
                  </div>
                )}
              </div>
            </Draggable>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Board; 