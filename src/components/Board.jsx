import React, { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import './Board.css';

// Add font style constants
const TEXT_STYLES = {
  small: {
    fontSize: '12px',
    opacity: 0.8
  },
  body: {
    fontSize: '14px'
  },
  large: {
    fontSize: '18px',
    fontWeight: '500'
  }
};

const Board = () => {
  const [images, setImages] = useState(() => {
    const saved = localStorage.getItem('board-images');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [texts, setTexts] = useState(() => {
    const saved = localStorage.getItem('board-texts');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [textStyles, setTextStyles] = useState(() => {
    const saved = localStorage.getItem('board-text-styles');
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedId, setSelectedId] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState(null);
  const [textResizing, setTextResizing] = useState(null);
  const initialTextWidth = useRef(0);
  const initialTextHeight = useRef(24);
  
  const boardRef = useRef(null);
  const initialMousePos = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ width: 0, height: 0 });
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const initialPosition = useRef({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);

  // Helper function to save state to history
  const saveToHistory = (newImages, newTexts, newTextStyles) => {
    const newState = {
      images: newImages,
      texts: newTexts,
      textStyles: newTextStyles
    };

    // Remove any future states if we're in the middle of the history
    const newHistory = history.slice(0, currentIndex + 1);
    
    setHistory([...newHistory, newState]);
    setCurrentIndex(newHistory.length);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Backspace' && !editingText) {
        e.preventDefault();
        
        // Save current state before deletion
        let newImages = [...images];
        let newTexts = [...texts];
        
        if (selectedId) {
          newImages = images.filter(img => img.id !== selectedId);
          setImages(newImages);
          setSelectedId(null);
          saveToHistory(newImages, texts, textStyles);
        }
        if (selectedText) {
          newTexts = texts.filter(text => text.id !== selectedText);
          setTexts(newTexts);
          setSelectedText(null);
          saveToHistory(images, newTexts, textStyles);
        }
      }
      
      if (editingText && (e.metaKey || e.ctrlKey)) {
        switch (e.key) {
          case 'b':
            e.preventDefault();
            toggleTextStyle(editingText, 'bold');
            break;
          case 'i':
            e.preventDefault();
            toggleTextStyle(editingText, 'italic');
            break;
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (currentIndex > 0) {
          const previousState = history[currentIndex - 1];
          setImages(previousState.images);
          setTexts(previousState.texts);
          setTextStyles(previousState.textStyles);
          setCurrentIndex(currentIndex - 1);
          
          // Clear selections when undoing
          setSelectedId(null);
          setSelectedText(null);
          setEditingText(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedText, editingText, currentIndex, history, images, texts, textStyles]);

  const handleDrop = (e) => {
    e.preventDefault();
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length === 0) return;

    const contentRect = boardRef.current.querySelector('.board-content').getBoundingClientRect();
    const x = e.clientX - contentRect.left;
    const y = e.clientY - contentRect.top;

    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        const baseSize = 200;
        const width = aspectRatio >= 1 ? baseSize : baseSize * aspectRatio;
        const height = aspectRatio >= 1 ? baseSize / aspectRatio : baseSize;
        
        const newImage = {
          id: Date.now(),
          url: event.target.result,
          position: { 
            x: x - width/2,
            y: y - height/2
          },
          size: { width, height },
          aspectRatio
        };
        
        const newImages = [...images, newImage];
        setImages(newImages);
        saveToHistory(newImages, texts, textStyles);
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
    setIsResizing(true);
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

    // Only calculate new width and maintain aspect ratio
    let newWidth = initialSize.current.width + dx;
    newWidth = Math.max(50, Math.min(1000, newWidth));
    let newHeight = newWidth / aspectRatio;

    setImages(prev => prev.map(img =>
      img.id === resizing.id
        ? { 
            ...img, 
            size: { width: newWidth, height: newHeight }
          }
        : img
    ));
  };

  const stopResize = () => {
    setIsResizing(false);
    setResizing(null);
  };

  const handleBoardClick = (e) => {
    if ((e.target === boardRef.current || e.target.classList.contains('board-content')) 
        && !e.target.closest('.text-wrapper')) {
      const boardRect = boardRef.current.getBoundingClientRect();
      const contentRect = boardRef.current.querySelector('.board-content').getBoundingClientRect();
      
      // Calculate position relative to the content area
      const x = e.clientX - contentRect.left;
      const y = e.clientY - contentRect.top;
      
      const newText = {
        id: Date.now(),
        content: '',
        position: { x, y }
      };
      
      const newTexts = [...texts, newText];
      setTexts(newTexts);
      saveToHistory(images, newTexts, textStyles);
      setEditingText(newText.id);
      setSelectedId(null);
      setSelectedText(null);
    }
  };

  const handleTextChange = (id, value) => {
    const newTexts = texts.map(text => 
      text.id === id ? { ...text, content: value } : text
    );
    setTexts(newTexts);
    saveToHistory(images, newTexts, textStyles);
  };

  const handleTextBlur = (id) => {
    const newTexts = texts.filter(text => 
      text.id !== id || text.content.trim() !== ''
    );
    setTexts(newTexts);
    if (newTexts.length !== texts.length) {
      saveToHistory(images, newTexts, textStyles);
    }
    setEditingText(null);
  };

  const handleTextClick = (e, id) => {
    e.stopPropagation();
    setSelectedText(id);
    setSelectedId(null);
  };

  const toggleTextStyle = (id, style) => {
    const newTextStyles = {
      ...textStyles,
      [id]: {
        ...textStyles[id],
        [style]: !textStyles[id]?.[style]
      }
    };
    setTextStyles(newTextStyles);
    saveToHistory(images, texts, newTextStyles);
  };

  const setTextSize = (id, size) => {
    const newTextStyles = {
      ...textStyles,
      [id]: {
        ...textStyles[id],
        size
      }
    };
    setTextStyles(newTextStyles);
    saveToHistory(images, texts, newTextStyles);
  };

  const startTextResize = (e, id) => {
    e.stopPropagation();
    setTextResizing({ id });
    initialMousePos.current = { x: e.clientX, y: e.clientY };
    initialTextWidth.current = textStyles[id]?.width || 200;
    initialTextHeight.current = textStyles[id]?.height || 32;
  };

  const handleTextResize = (e) => {
    if (!textResizing) return;
    const { id } = textResizing;

    const dx = e.clientX - initialMousePos.current.x;
    const dy = e.clientY - initialMousePos.current.y;
    
    // Calculate new dimensions with minimums
    const newWidth = Math.max(100, initialTextWidth.current + dx);
    const newHeight = Math.max(32, initialTextHeight.current + dy);
    
    requestAnimationFrame(() => {
      setTextStyles(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          width: newWidth,
          height: newHeight
        }
      }));
    });
  };

  const stopTextResize = () => {
    if (textResizing) {
      saveToHistory(images, texts, textStyles);
    }
    setTextResizing(null);
  };

  // Add font style toggle
  const setTextStyle = (id, style) => {
    const newTextStyles = {
      ...textStyles,
      [id]: {
        ...textStyles[id],
        ...TEXT_STYLES[style],
        style // Store the style name
      }
    };
    setTextStyles(newTextStyles);
    saveToHistory(images, texts, newTextStyles);
  };

  // Add pan handler
  const handlePan = (e) => {
    if (!isPanning) return;
    
    const dx = e.clientX - lastMousePosition.current.x;
    const dy = e.clientY - lastMousePosition.current.y;
    
    setViewportOffset(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
    
    lastMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  // Add pan start handler
  const handlePanStart = (e) => {
    // Only start panning on alt+click or two-finger touchpad gesture
    if (e.altKey || (e.touches && e.touches.length === 2)) {
      e.preventDefault();
      setIsPanning(true);
      lastMousePosition.current = { 
        x: e.clientX || e.touches[0].clientX,
        y: e.clientY || e.touches[0].clientY 
      };
    }
  };

  // Add pan end handler
  const handlePanEnd = () => {
    setIsPanning(false);
  };

  // Add reset function
  const resetBoard = () => {
    setImages([]);
    setTexts([]);
    setTextStyles({});
    setSelectedId(null);
    setSelectedText(null);
    setEditingText(null);
    localStorage.removeItem('board-images');
    localStorage.removeItem('board-texts');
    localStorage.removeItem('board-text-styles');
  };

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('board-images', JSON.stringify(images));
    localStorage.setItem('board-texts', JSON.stringify(texts));
    localStorage.setItem('board-text-styles', JSON.stringify(textStyles));
  }, [images, texts, textStyles]);

  return (
    <div 
      ref={boardRef}
      className={`board ${isPanning ? 'panning' : ''} ${isResizing ? 'resizing' : ''}`}
      onMouseMove={(e) => {
        handleMouseMove(e);
        handleTextResize(e);
        handlePan(e);
      }}
      onMouseUp={() => {
        stopResize();
        stopTextResize();
        handlePanEnd();
      }}
      onMouseDown={handlePanStart}
      onMouseLeave={() => {
        stopResize();
        stopTextResize();
        handlePanEnd();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={handleBoardClick}
    >
      <div 
        className="board-content"
        style={{
          transform: `translate3d(${viewportOffset.x}px, ${viewportOffset.y}px, 0)`,
          width: '200%',
          height: '200%',
          left: '-50%',
          top: '-50%',
          position: 'absolute',
          transformOrigin: '50% 50%'
        }}
      >
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
                <div 
                  className="resize-handle se" 
                  onMouseDown={(e) => startResize(e, image.id, 'se')} 
                />
              )}
            </div>
          </Draggable>
        ))}
        
        {texts.map((text) => (
          <Draggable
            key={text.id}
            defaultPosition={text.position}
            cancel="textarea,.style-toggle"
          >
            <div 
              className={`text-wrapper ${editingText === text.id ? 'editing' : ''} ${selectedText === text.id ? 'selected' : ''}`}
              onClick={(e) => handleTextClick(e, text.id)}
            >
              <div className="text-drag-handle">⋮⋮</div>
              {selectedText === text.id && (
                <div className="text-style-toggles">
                  <span 
                    className={`style-toggle ${textStyles[text.id]?.style === 'small' ? 'active' : ''}`}
                    onClick={() => setTextStyle(text.id, 'small')}
                  >
                    Small
                  </span>
                  <span 
                    className={`style-toggle ${!textStyles[text.id]?.style || textStyles[text.id]?.style === 'body' ? 'active' : ''}`}
                    onClick={() => setTextStyle(text.id, 'body')}
                  >
                    Body
                  </span>
                  <span 
                    className={`style-toggle ${textStyles[text.id]?.style === 'large' ? 'active' : ''}`}
                    onClick={() => setTextStyle(text.id, 'large')}
                  >
                    Large
                  </span>
                </div>
              )}
              <textarea
                value={text.content}
                onChange={(e) => handleTextChange(text.id, e.target.value)}
                onBlur={() => handleTextBlur(text.id)}
                onFocus={() => setEditingText(text.id)}
                autoFocus={editingText === text.id}
                placeholder="Type here..."
                style={{
                  width: `${textStyles[text.id]?.width || 200}px`,
                  height: `${textStyles[text.id]?.height || 32}px`,
                  fontSize: textStyles[text.id]?.fontSize || '14px',
                  fontWeight: textStyles[text.id]?.fontWeight || '400',
                  opacity: textStyles[text.id]?.opacity,
                }}
              />
              {selectedText === text.id && (
                <div 
                  className="resize-handle" 
                  onMouseDown={(e) => startTextResize(e, text.id)}
                />
              )}
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
      <div className="board-controls">
        <button className="reset-button" onClick={resetBoard}>
          Reset Board
        </button>
      </div>
    </div>
  );
};

export default Board; 