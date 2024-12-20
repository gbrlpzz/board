import React, { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import './Board.css';

const Board = () => {
  const [images, setImages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [texts, setTexts] = useState([]);
  const [editingText, setEditingText] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState(null);
  
  const boardRef = useRef(null);
  const initialMousePos = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (selectedId) {
          setImages(prev => prev.filter(img => img.id !== selectedId));
          setSelectedId(null);
        }
        if (selectedText && !editingText) {
          setTexts(prev => prev.filter(text => text.id !== selectedText));
          setSelectedText(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedText, editingText]);

  const handleDrop = (e) => {
    e.preventDefault();
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length === 0) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const dropX = e.clientX - boardRect.left - position.x;
    const dropY = e.clientY - boardRect.top - position.y;

    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        const baseSize = 200;
        const width = aspectRatio >= 1 ? baseSize : baseSize * aspectRatio;
        const height = aspectRatio >= 1 ? baseSize / aspectRatio : baseSize;
        
        setImages(prev => [...prev, {
          id: Date.now(),
          url: event.target.result,
          position: { 
            x: dropX - width/2,  // Center the image at drop point
            y: dropY - height/2
          },
          size: { width, height },
          aspectRatio
        }]);
      };
      
      img.src = event.target.result;
    };
    
    reader.readAsDataURL(file);
  };

  const handleImageClick = (e, id) => {
    e.stopPropagation();
    setSelectedId(id);
    setSelectedText(null);
    setEditingText(null);
  };

  // Image resize handlers
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
    const aspectRatio = image.aspectRatio;

    let newWidth = initialSize.current.width;
    let newHeight = initialSize.current.height;

    switch (resizing.handle) {
      case 'se':
      case 'ne':
        newWidth = initialSize.current.width + dx;
        newHeight = newWidth / aspectRatio;
        break;
      case 'sw':
      case 'nw':
        newWidth = initialSize.current.width - dx;
        newHeight = newWidth / aspectRatio;
        break;
    }

    // Constrain size
    newWidth = Math.max(50, Math.min(500, newWidth));
    newHeight = newWidth / aspectRatio;

    setImages(prev => prev.map(img =>
      img.id === resizing.id
        ? { ...img, size: { width: newWidth, height: newHeight } }
        : img
    ));
  };

  const stopResize = () => {
    setResizing(null);
  };

  const handleBoardClick = (e) => {
    if (e.target === boardRef.current || e.target.classList.contains('board-content')) {
      const newText = {
        id: Date.now(),
        content: '',
        position: { x: e.clientX - position.x, y: e.clientY - position.y }
      };
      
      setTexts(prev => [...prev, newText]);
      setEditingText(newText.id);
      setSelectedId(null);
      setSelectedText(null);
    }
  };

  const handleTextChange = (id, value) => {
    setTexts(prev => prev.map(text => 
      text.id === id ? { ...text, content: value } : text
    ));
  };

  const handleTextBlur = (id) => {
    setTexts(prev => prev.filter(text => 
      text.id !== id || text.content.trim() !== ''
    ));
    setEditingText(null);
  };

  const handleTextClick = (e, id) => {
    e.stopPropagation();
    setSelectedText(id);
    setSelectedId(null);
  };

  return (
    <div 
      ref={boardRef}
      className="board"
      onMouseMove={handleMouseMove}
      onMouseUp={stopResize}
      onMouseLeave={stopResize}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={handleBoardClick}
    >
      <div className="board-content">
        {images.map((image) => (
          <Draggable 
            key={image.id}
            defaultPosition={image.position}
            cancel=".resize-handle"
          >
            <div 
              className={`image-wrapper ${selectedId === image.id ? 'selected' : ''}`}
              onClick={(e) => handleImageClick(e, image.id)}
            >
              <img 
                src={image.url} 
                alt="Uploaded content"
                style={{ 
                  width: image.size.width, 
                  height: image.size.height 
                }}
              />
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
            defaultPosition={text.position}
            cancel="input"
          >
            <div 
              className={`text-wrapper ${editingText === text.id ? 'editing' : ''} ${selectedText === text.id ? 'selected' : ''}`}
              onClick={(e) => handleTextClick(e, text.id)}
            >
              <div className="text-drag-handle">⋮⋮</div>
              <input
                type="text"
                value={text.content}
                onChange={(e) => handleTextChange(text.id, e.target.value)}
                onBlur={() => handleTextBlur(text.id)}
                onFocus={() => setEditingText(text.id)}
                autoFocus={editingText === text.id}
                placeholder="Type here..."
              />
            </div>
          </Draggable>
        ))}

        {images.length === 0 && texts.length === 0 && (
          <div className="drop-zone">
            <p>Click anywhere to add text</p>
            <p>Drag and drop images here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Board; 