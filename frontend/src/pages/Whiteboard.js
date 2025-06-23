import React, { useRef, useState, useEffect, useCallback } from "react";
import jsPDF from "jspdf";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPen,
  faEraser,
  faShapes,
  faPaintBrush,
  faSave,
  faUndo,
  faRedo,
  faTrashAlt,
  faTimes,
  faCheck,
  faFont,
} from '@fortawesome/free-solid-svg-icons';
import "./Whiteboard.css";

// Constants for colors and shapes
const COLORS = [
  "#000000", "#d32f2f", "#1976d2", "#388e3c", "#fbc02d",
  "#fff", "#6d4c41", "#7e57c2", "#0288d1", "#c2185b"
];
const SHAPES = [
  { name: "Rectangle", value: "rect" },
  { name: "Circle", value: "circle" },
  { name: "Triangle", value: "triangle" },
  { name: "Pentagon", value: "pentagon" },
  { name: "Hexagon", "value": "hexagon" },
  { name: "Heptagon", value: "heptagon" },
  { name: "Octagon", value: "octagon" },
  { name: "Nonagon", value: "nonagon" },
  { name: "Decagon", value: "decagon" }
];

function Whiteboard({
  strokes,
  onChange,
  canEdit = true,
  color,
  setColor,
  size,
  setSize,
  tool,
  setTool,
  shape,
  setShape,
  emitDrawingPoint,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState([]);
  const [shapePreview, setShapePreview] = useState(null);

  // State for Text Tool
  const [isTyping, setIsTyping] = useState(false);
  const [currentTextInput, setCurrentTextInput] = useState('');
  const [currentTextPosition, setCurrentTextPosition] = useState({ x: 0, y: 0 });
  const textInputRef = useRef(null);

  const [history, setHistory] = useState([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showShapeDropdown, setShowShapeDropdown] = useState(false);
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);

  // Function to draw a single stroke on the canvas
  const drawStroke = useCallback((ctx, stroke, dpi, isPreview = false) => {
    if (!stroke || stroke.length === 0 || !stroke[0]) {
      console.warn("drawStroke: Invalid stroke data - returning.", stroke);
      return;
    }

    ctx.save();
    const strokeColor = stroke[0].color || "#000";
    const strokeSize = (stroke[0].size || 2);
    const strokeTool = stroke[0].tool;

    ctx.globalAlpha = isPreview ? 0.5 : 1;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (strokeTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    } else if (strokeTool === "text") {
      const text = stroke[0].text_content;
      const x = stroke[0].x;
      const y = stroke[0].y;
      const fontSize = strokeSize * 2;
      ctx.fillStyle = strokeColor;
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(text, x, y);
      console.log(`[DRAW] Text: "${text}" at (${x}, ${y}) | Font Size: ${fontSize}px | Color: ${strokeColor}`);
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  // --- Canvas Resizing Effect ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animationFrameId;

    const setCanvasDimensions = () => {
      const dpi = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpi;
      canvas.height = container.clientHeight * dpi;

      const ctx = canvas.getContext("2d");
      ctx.scale(dpi, dpi);
      console.log(`[CANVAS] Resized to: ${container.clientWidth}x${container.clientHeight} (DPI: ${dpi})`);
    };

    setCanvasDimensions();

    const observer = new ResizeObserver(() => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = window.requestAnimationFrame(() => {
        setCanvasDimensions();
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  // --- Main Drawing Effect (Redraws canvas when strokes, live strokes, or previews change) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpi = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.strokeStyle = "#adb5bd";
    ctx.lineWidth = 2 / dpi;
    ctx.strokeRect(0, 0, canvas.width / dpi, canvas.height / dpi);
    ctx.restore();

    strokes.forEach(stroke => drawStroke(ctx, stroke, dpi));
    console.log(`[RENDER] Drawing ${strokes.length} completed strokes.`);
    if (strokes.some(s => s[0]?.tool === "text")) {
        console.log("[RENDER] Detected text strokes in current render cycle.");
    }


    if (drawing && currentStroke.length && tool !== "text") {
      drawStroke(ctx, currentStroke, dpi);
    }
    if (shapePreview) {
      drawStroke(ctx, shapePreview, dpi, true);
    }

  }, [strokes, currentStroke, drawing, shapePreview, drawStroke, tool]);

  const getCursorPosition = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const isTouch = e.touches && e.touches.length > 0;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    const x = ((clientX - rect.left) / rect.width) * canvas.offsetWidth;
    const y = ((clientY - rect.top) / rect.height) * canvas.offsetHeight;
    return { x, y };
  }, []);

  // --- Drawing Logic for Pen/Eraser ---
  const startDrawing = useCallback((e) => {
    if (!canEdit || shape || tool === "text") return;
    setDrawing(true);
    const { x, y } = getCursorPosition(e);
    const style = { color: tool === "pen" ? color : "#fff", size, tool };
    const point = { x, y, ...style };
    setCurrentStroke([point]);
    if (emitDrawingPoint) emitDrawingPoint([point], false);
  }, [canEdit, shape, tool, getCursorPosition, color, size, emitDrawingPoint]);

  const draw = useCallback((e) => {
    if (!drawing || !canEdit || shape || tool === "text") return;
    const { x, y } = getCursorPosition(e);
    const style = { color: tool === "pen" ? color : "#fff", size, tool };
    const point = { x, y, ...style };
    setCurrentStroke((prev) => {
      const newStroke = [...prev, point];
      if (emitDrawingPoint) emitDrawingPoint([point], false);
      return newStroke;
    });
  }, [drawing, canEdit, shape, tool, getCursorPosition, color, size, emitDrawingPoint]);

  const endDrawing = useCallback(() => {
    if (!drawing || !canEdit || shape || tool === "text") return;
    setDrawing(false);
    if (currentStroke.length > 0) {
      const newStrokes = [...strokes, currentStroke];
      setHistory(prev => [...prev.slice(0, historyStep + 1), newStrokes]);
      setHistoryStep(prev => prev + 1);
      onChange(newStrokes);
      if (emitDrawingPoint) emitDrawingPoint(currentStroke, true);
    }
    setCurrentStroke([]);
  }, [drawing, canEdit, shape, tool, currentStroke, strokes, historyStep, onChange, emitDrawingPoint]);

  // --- Shape Drawing Logic ---
  const startShape = useCallback((e) => {
    if (!canEdit || !shape) return;
    setDrawing(true);
    const { x, y } = getCursorPosition(e);
    setCurrentStroke([{ x, y, color, size, tool: "shape", shape }]);
    setShapePreview(null);
  }, [canEdit, shape, getCursorPosition, color, size]);

  const moveShape = useCallback((e) => {
    if (!drawing || !canEdit || !shape) return;
    const start = currentStroke[0];
    const { x, y } = getCursorPosition(e);
    let previewPoints = [];

    if (!start) return;

    if (shape === "rect") {
      previewPoints = [
        { ...start },
        { x: x, y: start.y, color, size, tool: "shape", shape },
        { x: x, y: y, color, size, tool: "shape", shape },
        { x: start.x, y: y, color, size, tool: "shape", shape },
        { ...start },
      ];
    } else if (shape === "circle") {
      const cx = (start.x + x) / 2;
      const cy = (start.y + y) / 2;
      const rx = Math.abs(x - start.x) / 2;
      const ry = Math.abs(y - start.y) / 2;
      for (let t = 0; t <= 360; t += 10) {
        const rad = (t * Math.PI) / 180;
        previewPoints.push({
          x: cx + rx * Math.cos(rad),
          y: cy + ry * Math.sin(rad),
          color, size, tool: "shape", shape
        });
      }
    } else {
      const sides = {
        triangle: 3, pentagon: 5, hexagon: 6, heptagon: 7,
        octagon: 8, nonagon: 9, decagon: 10,
      }[shape];

      if (sides) {
        const cx = (start.x + x) / 2;
        const cy = (start.y + y) / 2;
        const r = Math.max(
          Math.abs(x - start.x) / 2,
          Math.abs(y - start.y) / 2
        );

        for (let i = 0; i <= sides; i++) {
          const theta = ((2 * Math.PI) / sides) * i - Math.PI / 2;
          previewPoints.push({
            x: cx + r * Math.cos(theta),
            y: cy + r * Math.sin(theta),
            color, size, tool: "shape", shape
          });
        }
      }
    }
    setShapePreview(previewPoints);
  }, [drawing, canEdit, shape, currentStroke, color, size, getCursorPosition]);

  const endShape = useCallback(() => {
    if (!drawing || !canEdit || !shape) return;
    setDrawing(false);
    if (shapePreview && shapePreview.length > 0) {
      const newStrokes = [...strokes, shapePreview];
      setHistory(prev => [...prev.slice(0, historyStep + 1), newStrokes]);
      setHistoryStep(prev => prev + 1);
      onChange(newStrokes);
      if (emitDrawingPoint) emitDrawingPoint(shapePreview, true);
    }
    setCurrentStroke([]);
    setShapePreview(null);
  }, [drawing, canEdit, shape, shapePreview, strokes, historyStep, onChange, emitDrawingPoint]);

  // --- Text Tool Logic ---
  const handleTextToolClick = useCallback((e) => {
    console.log("[TEXT] handleTextToolClick called. canEdit:", canEdit);
    if (!canEdit) {
        console.log("[TEXT] handleTextToolClick: Not editable, returning.");
        return;
    }

    setTool("text");
    setShape(null); // Deselect any active shape
    // Close any open dropdowns to avoid visual clutter
    setShowColorDropdown(false);
    setShowShapeDropdown(false);
    setShowSaveDropdown(false);

    setIsTyping(true); // Activate typing mode
    const { x, y } = getCursorPosition(e); // Get click coordinates for text input position
    setCurrentTextPosition({ x, y }); // Set position for text input overlay
    setCurrentTextInput(''); // Clear any previous text
    console.log(`[TEXT] Setting isTyping=true, text position (${x}, ${y})`);

    // Ensure focus after state update and rendering cycle
    // A small delay ensures the textarea element is fully rendered before trying to focus.
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
        console.log("[TEXT] textInputRef.current focused.");
      } else {
        console.log("[TEXT] textInputRef.current is null, cannot focus.");
      }
    }, 0);
  }, [canEdit, getCursorPosition]);

  const finalizeText = useCallback(() => {
    console.log("[TEXT] finalizeText called. currentTextInput:", currentTextInput.trim().length, "chars. canEdit:", canEdit);
    if (currentTextInput.trim() && canEdit) { // Only finalize if text exists and user can edit
      const newTextStroke = [{
        x: currentTextPosition.x,
        y: currentTextPosition.y,
        color: color,
        size: size,
        tool: "text",
        text_content: currentTextInput.trim() // Store the text content
      }];

      const newStrokes = [...strokes, newTextStroke];
      setHistory(prev => [...prev.slice(0, historyStep + 1), newStrokes]);
      setHistoryStep(prev => prev + 1);
      onChange(newStrokes);
      if (emitDrawingPoint) emitDrawingPoint(newTextStroke, true); // Emit as a completed stroke for sync
      console.log("[TEXT] Text stroke finalized and emitted.", newTextStroke);
    } else {
      console.log("[TEXT] No text to finalize or not editable. Not creating stroke.");
    }
    setIsTyping(false); // Exit typing mode
    setCurrentTextInput(''); // Clear text
    setCurrentTextPosition({ x: 0, y: 0 }); // Reset position
    console.log("[TEXT] isTyping, currentTextInput, currentTextPosition reset.");
  }, [currentTextInput, canEdit, currentTextPosition, color, size, strokes, historyStep, onChange, emitDrawingPoint]);

    // --- Pointer/Touch Event Handlers ---
  const handlePointerDown = useCallback((e) => {
    // Only proceed if editable and not in text tool mode
    if (!canEdit || tool === "text") return;
    if (shape) startShape(e); // If a shape is selected, start drawing shape
    else startDrawing(e); // Otherwise, start freehand drawing
  }, [canEdit, tool, shape, startShape, startDrawing]);

  // This handler is attached to the CANVAS element's onMouseDown/onTouchStart.
  const handleCanvasClick = useCallback((e) => {
    console.log("[CANVAS_CLICK] handleCanvasClick called. canEdit:", canEdit, "tool:", tool, "isTyping:", isTyping);
    if (!canEdit) {
        console.log("[CANVAS_CLICK] Not editable, returning.");
        return;
    }

    if (tool === "text") {
      // If text tool is active:
      // If already typing, finalize current text before starting a new one at the new click location
      if (isTyping) {
        console.log("[CANVAS_CLICK] Already typing, finalizing current text due to new canvas click.");
        finalizeText();
      }
      handleTextToolClick(e); // Trigger text input creation at the new click location
    } else {
      // If not text tool, this is a normal pointer down for drawing shapes/lines
      console.log("[CANVAS_CLICK] Not text tool, dispatching to handlePointerDown.");
      handlePointerDown(e);
    }
  }, [canEdit, tool, isTyping, finalizeText, handleTextToolClick, handlePointerDown]);

  const handlePointerMove = useCallback((e) => {
    // Only move if actively drawing, editable, and not in text tool mode
    if (!drawing || !canEdit || tool === "text") return;
    if (shape) moveShape(e); // If shape selected, update shape preview
    else draw(e); // Otherwise, draw freehand
  }, [drawing, canEdit, tool, shape, moveShape, draw]);

  const handlePointerUp = useCallback((e) => {
    // Only end drawing if actively drawing, editable, and not in text tool mode
    if (!drawing || !canEdit || tool === "text") return;
    if (shape) endShape(); // If shape selected, finalize shape
    else endDrawing(); // Otherwise, finalize freehand drawing
  }, [drawing, canEdit, tool, shape, endShape, endDrawing]);

  const handleMouseLeave = useCallback(() => {
    // If mouse leaves canvas while drawing (and not text tool), finalize the stroke
    if (drawing && canEdit && tool !== "text") {
      if (shape) endShape();
      else endDrawing();
    }
  }, [drawing, canEdit, tool, shape, endShape, endDrawing]);

  const handleTouchStart = useCallback((e) => {
    e.preventDefault(); // Prevent default browser touch behaviors (like scrolling/zooming)
    console.log("[TOUCH] handleTouchStart called. Tool:", tool);
    if (tool === "text") {
      // For touch, dispatch to handleCanvasClick which will then call handleTextToolClick
      handleCanvasClick(e);
    } else {
      handlePointerDown(e); // For drawing/shapes
    }
  }, [handlePointerDown, tool, handleCanvasClick]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault(); // Prevent default browser touch behaviors
    handlePointerMove(e);
  }, [handlePointerMove]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    console.log("[TOUCH] handleTouchEnd called. Tool:", tool, "isTyping:", isTyping);
    handlePointerUp(e);
    // Explicitly re-focus for touch devices if typing mode is active
    // This is important because 'blur' might fire on touch devices when finger lifts.
    if (tool === "text" && isTyping) {
        setTimeout(() => {
            if (textInputRef.current) {
                textInputRef.current.focus();
                console.log("[TOUCH] textInputRef.current focused for typing after touchEnd.");
            } else {
                console.log("[TOUCH] textInputRef.current is null, cannot focus for typing after touchEnd.");
            }
        }, 0);
    }
  }, [handlePointerUp, tool, isTyping]);


  // --- Save Functionality (PNG & PDF) ---
  const handleSaveImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "syncboard.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("[SAVE] Image saved as PNG.");
  }, []);

  const handleSavePDF = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imgData = canvas.toDataURL("image/png");

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const pdf = new jsPDF("landscape", "pt", [imgWidth, imgHeight]);
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    pdf.save("syncboard.pdf");
    console.log("[SAVE] Canvas saved as PDF.");
  }, []);

  // --- Undo/Redo Functions ---
  const handleUndo = useCallback(() => {
    if (historyStep > 0) {
      const newHistoryStep = historyStep - 1;
      setHistoryStep(newHistoryStep);
      onChange(history[newHistoryStep]);
      console.log(`[HISTORY] Undo. Current step: ${newHistoryStep}`);
    } else {
        console.log("[HISTORY] Undo disabled: Already at first step.");
    }
  }, [history, historyStep, onChange]);

  const handleRedo = useCallback(() => {
    if (historyStep < history.length - 1) {
      const newHistoryStep = historyStep + 1;
      setHistoryStep(newHistoryStep);
      onChange(history[newHistoryStep]);
      console.log(`[HISTORY] Redo. Current step: ${newHistoryStep}`);
    } else {
        console.log("[HISTORY] Redo disabled: Already at last step.");
    }
  }, [history, historyStep, onChange]);

  // --- Clear Canvas Functions (with confirmation modal) ---
  const confirmClear = useCallback(() => {
    console.log("[CLEAR] Confirmed: Clearing whiteboard.");
    setShowClearConfirm(false);
    onChange([]);
    setHistory([[]]);
    setHistoryStep(0);
    setCurrentStroke([]);
    setShapePreview(null);
    setIsTyping(false);
    setCurrentTextInput('');
  }, [onChange]);

  const cancelClear = useCallback(() => {
    console.log("[CLEAR] Cancelled: Whiteboard clear cancelled.");
    setShowClearConfirm(false);
  }, []);

  // --- Dropdown & Text Input Click Outside Listener ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close tool dropdowns if click is outside their area
      if (showColorDropdown && !event.target.closest(".color-dropdown") && !event.target.closest(".color-btn")) {
        setShowColorDropdown(false);
        console.log("[DROPDOWN] Color dropdown closed.");
      }
      if (showShapeDropdown && !event.target.closest(".shape-dropdown") && !event.target.closest(".shape-btn")) {
        setShowShapeDropdown(false);
        console.log("[DROPDOWN] Shape dropdown closed.");
      }
      if (showSaveDropdown && !event.target.closest(".save-dropdown") && !event.target.closest(".save-btn")) {
        setShowSaveDropdown(false);
        console.log("[DROPDOWN] Save dropdown closed.");
      }
      // Handle click outside of text input to finalize it
      if (isTyping && textInputRef.current && !textInputRef.current.contains(event.target) && !canvasRef.current.contains(event.target)) {
        console.log("[TEXT] handleClickOutside: Clicked outside text input AND canvas, finalizing text.");
        finalizeText();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showColorDropdown, showShapeDropdown, showSaveDropdown, isTyping, finalizeText]);

  return (
    <div className="whiteboard-container">
      <div className="whiteboard-toolbar">
        {/* Pen Tool Button */}
        <button
          className={`toolbar-btn ${tool === "pen" && !shape ? "active" : ""}`}
          onClick={() => {
            setTool("pen");
            setShape(null);
            setIsTyping(false); // Disable typing mode
            finalizeText(); // Finalize any pending text
            setShowColorDropdown(false);
            setShowShapeDropdown(false);
            setShowSaveDropdown(false);
            console.log("[TOOLBAR] Pen tool selected.");
          }}
          title="Pen Tool"
          disabled={!canEdit}
        >
          <FontAwesomeIcon icon={faPen} />
        </button>

        {/* Eraser Tool Button */}
        <button
          className={`toolbar-btn ${tool === "eraser" ? "active" : ""}`}
          onClick={() => {
            setTool("eraser");
            setShape(null);
            setIsTyping(false);
            finalizeText();
            setShowColorDropdown(false);
            setShowShapeDropdown(false);
            setShowSaveDropdown(false);
            console.log("[TOOLBAR] Eraser tool selected.");
          }}
          title="Eraser Tool"
          disabled={!canEdit}
        >
          <FontAwesomeIcon icon={faEraser} />
        </button>

        {/* Text Tool Button */}
        <button
          className={`toolbar-btn ${tool === "text" ? "active" : ""}`}
          onClick={() => {
            finalizeText(); // Ensures existing text is saved before switching or starting new
            setTool("text");
            setShape(null);
            setShowColorDropdown(false);
            setShowShapeDropdown(false);
            setShowSaveDropdown(false);
            console.log("[TOOLBAR] Text tool selected. Ready for canvas click.");
          }}
          title="Text Tool"
          disabled={!canEdit}
        >
          <FontAwesomeIcon icon={faFont} />
        </button>

        {/* Color Picker Dropdown */}
        <div className="dropdown">
          <button
            className="toolbar-btn color-btn"
            style={{ backgroundColor: color }}
            onClick={() => {
              setShowColorDropdown((val) => !val);
              setShowShapeDropdown(false);
              setShowSaveDropdown(false);
              setIsTyping(false);
              finalizeText();
              console.log("[TOOLBAR] Color picker clicked.");
            }}
            title="Choose Color"
            disabled={!canEdit}
          >
            <FontAwesomeIcon icon={faPaintBrush} />
          </button>
          {showColorDropdown && (
            <div className="dropdown-menu color-dropdown">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-option ${c === color && (tool === "pen" || tool === "shape" || tool === "text") ? "active" : ""}`}
                  style={{
                    backgroundColor: c,
                    border: c === "#fff" ? "1px solid #ccc" : undefined,
                  }}
                  onClick={() => {
                    setColor(c);
                    if (tool !== "text" && tool !== "shape") setTool("pen");
                    setShape(null);
                    setShowColorDropdown(false);
                    console.log(`[TOOLBAR] Color set to: ${c}`);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Brush Size Slider (or Font Size for Text) */}
        <div className="slider-container" title={tool === "text" ? "Font Size" : "Brush Size"}>
          <input
            type="range"
            min={tool === "text" ? 10 : 2}
            max={tool === "text" ? 72 : 24}
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              console.log(`[TOOLBAR] Size set to: ${Number(e.target.value)}px`);
            }}
            className="size-slider"
            disabled={!canEdit}
          />
          <span className="size-label">{size}px</span>
        </div>

        {/* Shapes Dropdown */}
        <div className="dropdown">
          <button
            className={`toolbar-btn shape-btn ${shape ? "active" : ""}`}
            onClick={() => {
              setShowShapeDropdown((val) => !val);
              setShowColorDropdown(false);
              setShowSaveDropdown(false);
              setIsTyping(false);
              finalizeText();
              console.log("[TOOLBAR] Shapes dropdown clicked.");
            }}
            title="Choose Shape"
            disabled={!canEdit}
          >
            <FontAwesomeIcon icon={faShapes} />
          </button>
          {showShapeDropdown && (
            <div className="dropdown-menu shape-dropdown">
              {SHAPES.map((s) => (
                <button
                  key={s.value}
                  className={`shape-option ${shape === s.value ? "active" : ""}`}
                  onClick={() => {
                    setShape(s.value);
                    setTool("pen"); // Shapes are drawn with the pen tool's logic
                    setShowShapeDropdown(false);
                    console.log(`[TOOLBAR] Shape selected: ${s.name}`);
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Undo Button */}
        <button
          className="toolbar-btn"
          onClick={handleUndo}
          disabled={historyStep === 0 || isTyping || !canEdit}
          title="Undo"
        >
          <FontAwesomeIcon icon={faUndo} />
        </button>

        {/* Redo Button */}
        <button
          className="toolbar-btn"
          onClick={handleRedo}
          disabled={historyStep === history.length - 1 || isTyping || !canEdit}
          title="Redo"
        >
          <FontAwesomeIcon icon={faRedo} />
        </button>

        {/* Save Dropdown */}
        <div className="dropdown">
          <button
            className="toolbar-btn save-btn"
            onClick={() => {
              setShowSaveDropdown((v) => !v);
              setShowColorDropdown(false);
              setShowShapeDropdown(false);
              setIsTyping(false);
              finalizeText();
              console.log("[TOOLBAR] Save dropdown clicked.");
            }}
            title="Save"
          >
            <FontAwesomeIcon icon={faSave} />
          </button>
          {showSaveDropdown && (
            <div className="dropdown-menu save-dropdown">
              <button
                onClick={() => {
                  setShowSaveDropdown(false);
                  handleSaveImage();
                }}
              >
                Save as Image (PNG)
              </button>
              <button
                onClick={() => {
                  setShowSaveDropdown(false);
                  handleSavePDF();
                }}
              >
                Save as PDF
              </button>
            </div>
          )}
        </div>

        {/* Clear Canvas Button */}
        <button
          className="toolbar-btn"
          onClick={() => {
            setShowClearConfirm(true);
            setIsTyping(false);
            finalizeText();
            console.log("[TOOLBAR] Clear canvas clicked.");
          }}
          title="Clear Canvas"
          disabled={!canEdit}
        >
          <FontAwesomeIcon icon={faTrashAlt} />
        </button>
      </div>

      {/* Canvas Wrapper */}
      <div ref={containerRef} className="whiteboard-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className={`whiteboard-canvas ${!canEdit ? 'disabled-canvas' : ''}`}
          onMouseDown={canEdit ? handleCanvasClick : null}
          onMouseMove={canEdit ? handlePointerMove : null}
          onMouseUp={canEdit ? handlePointerUp : null}
          onMouseLeave={canEdit ? handleMouseLeave : null}
          onTouchStart={canEdit ? handleTouchStart : null}
          onTouchMove={canEdit ? handleTouchMove : null}
          onTouchEnd={canEdit ? handleTouchEnd : null}
        />
        {/* Text input overlay */}
        {isTyping && canEdit && tool === "text" && (
          <textarea
            ref={textInputRef}
            className="whiteboard-text-input"
            style={{
              left: currentTextPosition.x,
              top: currentTextPosition.y,
              color: color,
              fontSize: `${size * 2}px`,
              fontFamily: 'Inter, sans-serif',
            }}
            value={currentTextInput}
            onChange={(e) => setCurrentTextInput(e.target.value)}
            onBlur={finalizeText}
            onKeyDown={(e) => {
              console.log("[TEXT_INPUT] KeyDown:", e.key);
              if (e.key === 'Enter') {
                e.preventDefault();
                console.log("[TEXT_INPUT] Enter key pressed. Finalizing text.");
                finalizeText();
              } else if (e.key === 'Escape') {
                console.log("[TEXT_INPUT] Escape key pressed: Cancelling typing.");
                setIsTyping(false);
                setCurrentTextInput('');
                setCurrentTextPosition({ x: 0, y: 0 });
              }
            }}
          />
        )}
        {/* Overlay to indicate drawing is disabled */}
        {!canEdit && (
          <div className="drawing-disabled-overlay">
            Drawing is disabled
          </div>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="clear-confirm-modal-overlay">
          <div className="clear-confirm-modal-content">
            <h3>Clear Whiteboard?</h3>
            <p>Are you sure you want to clear the entire whiteboard? This action cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={confirmClear} className="confirm-btn">
                <FontAwesomeIcon icon={faCheck} className="mr-2" /> Yes, Clear
              </button>
              <button onClick={cancelClear} className="cancel-btn">
                <FontAwesomeIcon icon={faTimes} className="mr-2" /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Whiteboard;
