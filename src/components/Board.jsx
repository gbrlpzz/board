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
  const [canvasId, setCanvasId] = useState(() => {
    return localStorage.getItem('current-canvas') || 'default';
  });

  const [canvasList, setCanvasList] = useState(() => {
    const list = localStorage.getItem('canvas-list');
    return list ? JSON.parse(list) : [{ id: 'default', name: 'Default Canvas' }];
  });

  const getStorageKey = (key) => `${canvasId}-${key}`;

  const loadCanvasData = (id) => {
    const savedImages = localStorage.getItem(`${id}-board-images`);
    const savedTexts = localStorage.getItem(`${id}-board-texts`);
    const savedStyles = localStorage.getItem(`${id}-board-text-styles`);
    
    return {
      images: savedImages ? JSON.parse(savedImages) : [],
      texts: savedTexts ? JSON.parse(savedTexts) : [],
      textStyles: savedStyles ? JSON.parse(savedStyles) : {},
    };
  };

  const initialData = loadCanvasData(canvasId);
  const [images, setImages] = useState(initialData.images);
  const [texts, setTexts] = useState(initialData.texts);
  const [textStyles, setTextStyles] = useState(initialData.textStyles);

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
        localStorage.setItem(getStorageKey('board-images'), JSON.stringify(newImages));
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

    setImages(prev => {
      const updatedImages = prev.map(img =>
        img.id === resizing.id
          ? { 
              ...img, 
              size: { width: newWidth, height: newHeight }
            }
          : img
      );
      localStorage.setItem(getStorageKey('board-images'), JSON.stringify(updatedImages));
      return updatedImages;
    });
  };

  const stopResize = () => {
    setIsResizing(false);
    setResizing(null);
  };

  // Board click handler for new text
  const handleBoardClick = (e) => {
    // Log the click target for debugging
    console.log('Click target:', e.target);
    console.log('Has board-content class:', e.target.classList.contains('board-content'));
    
    // Simplified condition to check if we're clicking on the empty board area
    if (e.target.classList.contains('board-content') 
        && !e.target.closest('.text-wrapper')
        && !e.target.closest('.board-controls')
        && !e.target.closest('.image-wrapper')
        && !isPanning
        && !isResizing) {
      
      const contentRect = boardRef.current.querySelector('.board-content').getBoundingClientRect();
      
      const x = e.clientX - contentRect.left;
      const y = e.clientY - contentRect.top;
      
      const newText = {
        id: Date.now(),
        content: '',
        position: { x, y }
      };
      
      console.log('Creating new text at:', { x, y });
      
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
    // And make sure we're not clicking on an image, text, or control
    if ((e.altKey || (e.touches && e.touches.length === 2)) && 
        e.target === boardRef.current || 
        e.target.classList.contains('board-content')) {
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
    localStorage.removeItem(getStorageKey('board-images'));
    localStorage.removeItem(getStorageKey('board-texts'));
    localStorage.removeItem(getStorageKey('board-text-styles'));
  };

  const returnToOrigin = () => {
    setViewportOffset({ x: 0, y: 0 });
  };

  // Add useEffect to save positions on reload
  useEffect(() => {
    const savedImages = JSON.parse(localStorage.getItem(getStorageKey('board-images')));
    if (savedImages) {
      setImages(savedImages);
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (!canvasId) return;
    
    localStorage.setItem(`${canvasId}-board-images`, JSON.stringify(images));
    localStorage.setItem(`${canvasId}-board-texts`, JSON.stringify(texts));
    localStorage.setItem(`${canvasId}-board-text-styles`, JSON.stringify(textStyles));
  }, [images, texts, textStyles, canvasId]);

  const handleImageDragStop = (id, newPosition) => {
    setImages(prev => {
      const updatedImages = prev.map(img =>
        img.id === id
          ? { 
              ...img, 
              position: newPosition // Update the position
            }
          : img
      );
      localStorage.setItem(getStorageKey('board-images'), JSON.stringify(updatedImages)); // Save updated image positions
      return updatedImages;
    });
  };

  const handleReset = () => {
    const confirmText = prompt('Type "delete CANVAS" to reset the board:');
    if (confirmText === 'delete CANVAS') {
      localStorage.clear();
      setImages([]);
      setTexts([]);
      setTextStyles({});
      setViewportOffset({ x: 0, y: 0 });
    } else if (confirmText !== null) { // Only show error if user didn't cancel
      alert('Incorrect confirmation text. Board was not reset.');
    }
  };

  const createNewCanvas = () => {
    const name = prompt('Enter canvas name:');
    if (!name) return;
    
    const id = `canvas-${Date.now()}`;
    const newCanvas = { id, name };
    
    setCanvasList(prev => {
      const updated = [...prev, newCanvas];
      localStorage.setItem('canvas-list', JSON.stringify(updated));
      return updated;
    });
    
    switchCanvas(id);
  };

  const switchCanvas = (id) => {
    console.log('switchCanvas called with id:', id); // Debug log
    setCanvasId(id);
    localStorage.setItem('current-canvas', id);
    
    const data = loadCanvasData(id);
    console.log('Loading data for canvas:', id, data); // Debug log
    
    setImages(data.images);
    setTexts(data.texts);
    setTextStyles(data.textStyles);
    setViewportOffset({ x: 0, y: 0 });
  };

  const deleteCanvas = (id) => {
    if (canvasList.length <= 1) {
      alert('Cannot delete the last canvas');
      return;
    }

    const canvas = canvasList.find(c => c.id === id);
    const confirmText = prompt(`Type "${canvas.name}" to delete this canvas:`);
    if (confirmText !== canvas.name) {
      if (confirmText !== null) { // Only show error if user didn't cancel
        alert('Incorrect canvas name. Canvas was not deleted.');
      }
      return;
    }

    // Remove canvas-specific data
    localStorage.removeItem(getStorageKey('board-images'));
    localStorage.removeItem(getStorageKey('board-texts'));
    localStorage.removeItem(getStorageKey('board-text-styles'));
    
    setCanvasList(prev => {
      const updated = prev.filter(c => c.id !== id);
      localStorage.setItem('canvas-list', JSON.stringify(updated));
      return updated;
    });
    
    // Switch to first available canvas if deleting current
    if (id === canvasId) {
      const firstCanvas = canvasList.find(c => c.id !== id);
      switchCanvas(firstCanvas.id);
    }
  };

  // Add an effect to handle canvas switching
  useEffect(() => {
    const data = loadCanvasData(canvasId);
    setImages(data.images);
    setTexts(data.texts);
    setTextStyles(data.textStyles);
  }, [canvasId]); // This effect runs when canvasId changes

  // Add the rename function
  const renameCanvas = (id) => {
    const canvas = canvasList.find(c => c.id === id);
    const newName = prompt('Enter new name:', canvas.name);
    
    if (!newName || newName === canvas.name) return; // Cancel if empty or unchanged
    
    setCanvasList(prev => {
      const updated = prev.map(c => 
        c.id === id ? { ...c, name: newName } : c
      );
      localStorage.setItem('canvas-list', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div 
      ref={boardRef}
      className={`board ${isPanning ? 'panning' : ''} ${isResizing ? 'resizing' : ''}`}
      onMouseDown={handlePanStart}
      onMouseMove={(e) => {
        handlePan(e);
        handleMouseMove(e);
      }}
      onMouseUp={() => {
        handlePanEnd();
        stopResize();
      }}
      onMouseLeave={() => {
        handlePanEnd();
        stopResize();
      }}
      onTouchStart={handlePanStart}
      onTouchMove={handlePan}
      onTouchEnd={handlePanEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div 
        className="board-content"
        style={{
          transform: `translate3d(${viewportOffset.x}px, ${viewportOffset.y}px, 0)`,
          minHeight: '100%', // Ensure the div takes up space
          minWidth: '100%',  // Ensure the div takes up space
          position: 'relative' // Make sure position calculations work
        }}
        onClick={handleBoardClick}
      >
        {images.map((image) => (
          <Draggable 
            key={image.id}
            defaultPosition={image.position}
            cancel=".resize-handle"
            onStop={(e, data) => handleImageDragStop(image.id, { x: data.x, y: data.y })}
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
            cancel="textarea,.style-toggle,.resize-handle"
            onMouseDown={(e) => e.stopPropagation()} // Prevent pan when interacting with text
          >
            <div 
              className={`text-wrapper ${editingText === text.id ? 'editing' : ''} ${selectedText === text.id ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleTextClick(e, text.id);
              }}
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
                onMouseDown={(e) => e.stopPropagation()} // Prevent pan when typing
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
            <p>
              Learn more on <a href="https://github.com/gbrlpzz/board" target="_blank" rel="noopener noreferrer">GitHub</a>
            </p>
          </div>
        )}

        {/* Add a transparent overlay to catch clicks when empty */}
        {images.length === 0 && texts.length === 0 && (
          <div 
            className="board-content-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: -1
            }}
          />
        )}
      </div>
      
      <div className="board-controls">
        <div className="canvas-selector-wrapper">
          <select 
            value={canvasId} 
            onChange={(e) => switchCanvas(e.target.value)}
            className="canvas-selector"
            title="Select Canvas"
            aria-label="Select Canvas"
          >
            {canvasList.map(canvas => (
              <option 
                key={canvas.id} 
                value={canvas.id}
                title={canvas.name}
              >
                {canvas.name}
              </option>
            ))}
          </select>
        </div>
        <button 
          className="canvas-button" 
          onClick={createNewCanvas}
          title="Create new canvas"
        >
          +
        </button>
        <button 
          className="canvas-button" 
          onClick={() => renameCanvas(canvasId)}
          title="Rename current canvas"
        >
          ✎
        </button>
        <button 
          className="canvas-button" 
          onClick={() => deleteCanvas(canvasId)}
          title="Delete current canvas"
        >
          ×
        </button>
        <button 
          className="canvas-button" 
          onClick={returnToOrigin}
          title="Return to center of canvas"
        >
          ⌂
        </button>
        <button 
          className="canvas-button" 
          onClick={handleReset}
          title='Type "delete CANVAS" to reset'
        >
          ↺
        </button>
      </div>
    </div>
  );
};

export default Board; 