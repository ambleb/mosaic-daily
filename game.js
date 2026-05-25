// -----------------------------
// DATE HELPERS
// -----------------------------
function isTodayPuzzle(dayIndex = App.puzzle.selectedDay) {
  return dayIndex === getDailyIndex();
}

function isOfficialCompletionAllowed(dayIndex) {
  const isTodayReplayFromCompleted =
    isTodayPuzzle(dayIndex) &&
    App.puzzle.replayWasStartedFromCompleted;

  return !isTodayReplayFromCompleted;
}

// -----------------------------
// STREAK HELPERS
// -----------------------------
function updateStreakDisplay() {
  const el = document.getElementById("streakDisplay");
  if (el) el.textContent = `🔥 ${App.streak.current}`;
}

// -----------------------------
// OVERLAYS / UI
// -----------------------------
function getSelectedPuzzleDateString() {
  return formatPuzzleDate(App.puzzle.selectedDay, "long");
}

// -----------------------------
// PUZZLE LOADING
// -----------------------------
function getFallbackPuzzle() {
  return {
    grid_width: 5,
    grid_height: 5,
    filled_cells: [[0, 0]],
    shapes: [[[0, 0]]]
  };
}

async function fetchPuzzleDataForDay(dayIndex) {
  const puzzleIndex = dayIndex - getCalendarStartIndex();

  if (puzzleIndex < 0 || puzzleIndex >= puzzleFiles.length) {
    console.error("No puzzle assigned for this date:", dayIndex);
    return getFallbackPuzzle();
  }

  const file = puzzleFiles[puzzleIndex];

  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error("Bad JSON");

    const data = await res.json();

    if (!isValidPuzzleData(data)) {
      throw new Error("Puzzle JSON missing required fields");
    }

    return data;
  } catch (err) {
    console.error("Failed to load puzzle:", file, err);
    return getFallbackPuzzle();
  }
}

function resetPuzzleRuntimeState() {
  App.game.moveCount = 0;
  App.game.showWin = false;
  App.pieces.list = [];
  App.game.winAnimationActive = false;
  App.game.winAnimationProgress = 0;
}

function applyCompletedState(dayIndex) {
  if (App.puzzle.replayingSelectedPuzzle && dayIndex === App.puzzle.selectedDay) {
    return;
  }

  const saved = loadCompletedPuzzleState(dayIndex);
  if (!saved) return;

  App.game.showWin = true;
  App.game.moveCount = saved.moves;
  App.pieces.list = [];
  clearCurrentPuzzleProgress(dayIndex);
}

async function redoSelectedPuzzle() {
  const dayIndex = App.puzzle.selectedDay;

  clearCurrentPuzzleProgress(dayIndex);
  App.puzzle.replayingSelectedPuzzle = true;
  App.puzzle.replayWasStartedFromCompleted = isCompleted(dayIndex);

  await loadPuzzle(dayIndex);
}

function preparePuzzleDay(dayIndex) {
  App.puzzle.selectedDay = dayIndex;
  saveViewedDay(dayIndex);
}

function restoreCompletedPuzzleState(dayIndex) {
  applyCompletedState(dayIndex);
}

function restoreInProgressPuzzleState(dayIndex) {
  if (!App.game.showWin) {
    applySavedPuzzleProgress(dayIndex);
  }
}

function refreshPuzzleUI() {
  document.getElementById("winOverlay").classList.remove("active");
  closeBeginOverlay();

  resizeCanvas(true);
  buildCalendar();
}

function maybeShowBeginOverlay() {
  if (getLayoutMode() === "phone") {
    openBeginOverlay();
  }
}

async function loadPuzzle(dayIndex) {
  preparePuzzleDay(dayIndex);
  
  App.game.showWin = false;
  updateRedoPuzzleButton();

  App.puzzle.currentData = await fetchPuzzleDataForDay(dayIndex);
  generateShapeColors();

  resetPuzzleRuntimeState();
  restoreCompletedPuzzleState(dayIndex);

  refreshPuzzleUI();
  restoreInProgressPuzzleState(dayIndex);

  if (App.game.showWin) {
    shrinkCanvasForCompletedPuzzle();
	render();
  }

  if (!App.game.showWin) {
    render();
  }

  maybeShowBeginOverlay();
  updateRedoPuzzleButton();
  App.puzzle.replayingSelectedPuzzle = false;
}

// -----------------------------
// LAYOUT HELPERS
// -----------------------------
function isTouchInput() {
  return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
}

function isPhoneLayout() {
  return getLayoutMode() === "phone";
}

function isTabletLayout() {
  return getLayoutMode() === "tablet";
}

function isMobileLayout() {
  return isPhoneLayout();
}

function pointInTray(screenX, screenY) {
  if (!App.layout.trayViewport) return false;

  return (
    screenX >= App.layout.trayViewport.x &&
    screenX <= App.layout.trayViewport.x + App.layout.trayViewport.width &&
    screenY >= App.layout.trayViewport.y &&
    screenY <= App.layout.trayViewport.y + App.layout.trayViewport.height
  );
}

function getOrientation() {
  return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
}

function shrinkCanvasForCompletedPuzzle() {
  if (!App.puzzle.currentData) return;

  const layout = getLayoutConfig();
  const boardHeight = App.puzzle.currentData.grid_height * App.layout.cellSize;

  App.dom.canvas.height = App.layout.gameOffsetY + boardHeight + 32;
}

window.addEventListener("resize", resizeCanvas);

// -----------------------------
// PUZZLE COLOR / SHAPE HELPERS
// -----------------------------
function generateShapeColors() {
  const palette = PALETTES[App.puzzle.selectedDay % PALETTES.length];
  App.puzzle.shapeColors = App.puzzle.currentData.shapes.map((_, i) => palette[i % palette.length]);
}

function normalize(shape) {
  let minX = Math.min(...shape.map(c => c[0]));
  let minY = Math.min(...shape.map(c => c[1]));
  return shape.map(c => [c[0] - minX, c[1] - minY]);
}

// -----------------------------
// RENDERING
// -----------------------------
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function startWinSequence() {
  App.game.winAnimationActive = true;
  App.game.winAnimationProgress = 0;

  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / App.constants.WIN_ANIMATION_DURATION);

    App.game.winAnimationProgress = easeOutCubic(t);
    render();

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      App.game.winAnimationActive = false;
      App.game.winAnimationProgress = 1;

      App.pieces.list = [];
      App.game.showWin = true;
	  shrinkCanvasForCompletedPuzzle();
	  updateRedoPuzzleButton();
      render();

      setTimeout(() => {
        showWinOverlay();
      }, App.constants.WIN_OVERLAY_DELAY);
    }
  }

  requestAnimationFrame(step);
}

function drawWinFillOverlay() {
  const ctx = App.dom.ctx;
  const data = App.puzzle.currentData;
  const cellSize = App.layout.cellSize;
  const game = App.game;
  
  if (!game.winAnimationActive && !game.showWin) return;

  const alpha = game.winAnimationActive ? game.winAnimationProgress : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#4CAF50";

  data.filled_cells.forEach(([x, y]) => {
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  });

  ctx.restore();
}

function drawGrid() {
  const ctx = App.dom.ctx;
  const data = App.puzzle.currentData;
  const cellSize = App.layout.cellSize;
  
  ctx.fillStyle = getCSS("--cell-fill");
  ctx.strokeStyle = getCSS("--grid-line");

  data.filled_cells.forEach(([x, y]) => {
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
  });
}

function getLabelAnchor(piece) {
  const cellCenters = piece.cells.map(([cx, cy]) => ({
    x: piece.x + cx * App.layout.cellSize + App.layout.cellSize / 2,
    y: piece.y + cy * App.layout.cellSize + App.layout.cellSize / 2
  }));

  const avgX = cellCenters.reduce((sum, c) => sum + c.x, 0) / cellCenters.length;
  const avgY = cellCenters.reduce((sum, c) => sum + c.y, 0) / cellCenters.length;

  let best = cellCenters[0];
  let bestDist = Infinity;

  for (const center of cellCenters) {
    const dx = center.x - avgX;
    const dy = center.y - avgY;
    const dist = dx * dx + dy * dy;

    if (dist < bestDist) {
      bestDist = dist;
      best = center;
    }
  }

  return best;
}

function drawPieceLabel(piece) {
  const layout = getLayoutConfig();
  const anchor = getLabelAnchor(piece);
  const text = String(piece.label);
  const radius = layout.labelRadius;
  const ctx = App.dom.ctx;

  ctx.save();

  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${layout.labelFontSize}px Arial`;
  ctx.fillStyle = "#111";
  ctx.fillText(text, anchor.x, anchor.y);

  ctx.restore();
}

function drawDraggingPiece() {
  const ctx = App.dom.ctx;
  const input = App.input;
  const cellSize = App.layout.cellSize;
  const piece = input.draggingPiece;
  
  if (!piece) return;

  ctx.globalAlpha = 0.4;
  ctx.fillStyle = input.ghostValid ? "green" : "red";

  piece.cells.forEach(cell => {
    ctx.fillRect(
      input.ghostGX * cellSize + cell[0] * cellSize,
      input.ghostGY * cellSize + cell[1] * cellSize,
      cellSize,
      cellSize
    );
  });

  ctx.globalAlpha = 1;
  ctx.fillStyle = piece.color;

  piece.cells.forEach(cell => {
    ctx.fillRect(
      piece.x + cell[0] * cellSize,
      piece.y + cell[1] * cellSize,
      cellSize,
      cellSize
    );
  });

  if (App.game.labelsEnabled) {
    drawPieceLabel(piece);
  }
}

function isTrayPiece(piece) {
  return isPhoneTrayMode() && App.layout.trayViewport && !piece.placed;
}

function getTrayVisualX(piece) {
  return isTrayPiece(piece) ? piece.x - App.layout.trayScrollX : piece.x;
}

function drawPhoneTrayBackground() {
  const ctx = App.dom.ctx;
  const layout = App.layout;
  const tray = layout.trayViewport;
  
  if (!(isPhoneTrayMode() && tray)) return;

  ctx.save();
  ctx.fillStyle = getCSS("--tray-bg");
  ctx.strokeStyle = getCSS("--tray-border");
  ctx.beginPath();
  ctx.roundRect(
    tray.x - layout.gameOffsetX,
    tray.y - layout.gameOffsetY,
    tray.width,
    tray.height,
    12
  );
  ctx.fill();
  ctx.restore();
}

function drawPieceCells(piece, drawX) {
  const ctx = App.dom.ctx;
  const cellSize = App.layout.cellSize;
	
  ctx.fillStyle = piece.color;

  piece.cells.forEach(cell => {
    ctx.fillRect(
      drawX + cell[0] * cellSize,
      piece.y + cell[1] * cellSize,
      cellSize,
      cellSize
    );
  });
}

function drawPieceWithOptionalLabel(piece, drawX) {
  drawPieceCells(piece, drawX);

  if (!App.game.labelsEnabled) return;

  if (isTrayPiece(piece)) {
    const oldX = piece.x;
    piece.x = drawX;
    drawPieceLabel(piece);
    piece.x = oldX;
  } else {
    drawPieceLabel(piece);
  }
}

function drawStaticPiece(piece) {
  const trayPiece = isTrayPiece(piece);
  const drawX = getTrayVisualX(piece);
  const ctx = App.dom.ctx;
  const layout = App.layout;
  const tray = layout.trayViewport;

  if (trayPiece) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      tray.x - layout.gameOffsetX,
      tray.y - layout.gameOffsetY,
      tray.width,
      tray.height
    );
    ctx.clip();
  }

  drawPieceWithOptionalLabel(piece, drawX);

  if (trayPiece) {
    ctx.restore();
  }
}

function drawPieces() {
  if (App.game.showWin) return;

  drawPhoneTrayBackground();

  App.pieces.list.forEach(piece  => {
    if (piece  === App.input.draggingPiece) return;
    drawStaticPiece(piece );
  });

  drawDraggingPiece();
}

function clearCanvas() {
  App.dom.ctx.clearRect(0, 0, App.dom.canvas.width, App.dom.canvas.height);
}

function drawGameLayer(board) {
  App.dom.ctx.save();
  App.dom.ctx.translate(App.layout.gameOffsetX, App.layout.gameOffsetY);

  drawBoardBackground();
  drawGrid();
  drawPieces();
  drawWinFillOverlay();

  App.dom.ctx.restore();
}

function drawBoardBackground() {
  const ctx = App.dom.ctx;
  const bg = App.constants.BOARD_BACKGROUND;
  const visibleBoard = getVisibleBoardRect();

  ctx.save();

  ctx.shadowColor = bg.shadowColor;
  ctx.shadowBlur = bg.shadowBlur;
  ctx.shadowOffsetY = bg.shadowOffsetY;

  ctx.fillStyle = getCSS("--grid-bg");
  ctx.beginPath();
  ctx.roundRect(
    visibleBoard.x - bg.padding,
    visibleBoard.y - bg.padding,
    visibleBoard.width + bg.padding * 2,
    visibleBoard.height + bg.padding * 2,
    bg.radius
  );
  ctx.fill();

  ctx.restore();
}

function drawDesktopPuzzleHeader(layout) {
  if (layout.mode === "phone") return;

  const ctx = App.dom.ctx;
  const canvas = App.dom.canvas;
  const layoutState = App.layout;
  const puzzle = App.puzzle;
  const game = App.game;

  const dateStr = formatPuzzleDate(puzzle.selectedDay, "long");

  ctx.fillStyle = getCSS("--text");
  ctx.textAlign = "center";

  ctx.font = layout.dateFont;
  ctx.fillText(dateStr, canvas.width / 2, layoutState.gameOffsetY + layout.dateY);

  ctx.font = layout.movesFont;
  ctx.fillText(`Moves: ${game.moveCount}`, canvas.width / 2, layoutState.gameOffsetY + layout.movesY);
}

function render() {
  if (!App.puzzle.currentData) return;

  const layout = getLayoutConfig();
  const board = getRenderBoardMetrics(layout);

  updateRenderOffsets(board, layout);
  clearCanvas();

  drawGameLayer(board);
  drawDesktopPuzzleHeader(layout);
}

// -----------------------------
// GAME RULE HELPERS
// -----------------------------
function placePiece(piece, gx, gy) {
  piece.gridX = gx;
  piece.gridY = gy;
  piece.x = gx * App.layout.cellSize;
  piece.y = gy * App.layout.cellSize;
  piece.placed = true;
  App.game.moveCount++;
}

function returnPieceToTray(piece) {
  piece.placed = false;
  piece.gridX = 0;
  piece.gridY = 0;
  piece.x = piece.trayX;
  piece.y = piece.trayY;
}

function isSamePlacement(piece, gx, gy) {
  return App.input.dragStartPlaced && App.input.dragStartGridX === gx && App.input.dragStartGridY === gy;
}

function checkWin() {
  return App.pieces.list.every(p => p.placed);
}

function isFilled(x, y) {
  return App.puzzle.currentData.filled_cells.some(c => c[0] == x && c[1] == y);
}

function canPlace(piece, gx, gy) {
  for (let cell of piece.cells) {
    let x = gx + cell[0];
    let y = gy + cell[1];

    if (!isFilled(x, y)) return false;

    for (let p of App.pieces.list) {
      if (p !== piece && p.placed) {
        for (let c of p.cells) {
          if (p.gridX + c[0] == x && p.gridY + c[1] == y) {
            return false;
          }
        }
      }
    }
  }

  return true;
}

function handlePuzzleCompletion() {
  const dayIndex = App.puzzle.selectedDay;

  const isReplayOfCompletedToday =
    isTodayPuzzle(dayIndex) &&
    App.puzzle.replayWasStartedFromCompleted;

  App.game.lastWinWasPracticeReplay = isReplayOfCompletedToday;

  if (!isReplayOfCompletedToday) {
    saveCompletedPuzzleState(dayIndex, App.game.moveCount);
    applyTodayPuzzleCompletionToStreak();
  }

  clearCurrentPuzzleProgress(dayIndex);
  updateRedoPuzzleButton();
  startWinSequence();

  App.puzzle.replayWasStartedFromCompleted = false;
}

// -----------------------------
// POINTER / INPUT HELPERS
// -----------------------------
function getCanvasPoint(clientX, clientY) {
  const rect = App.dom.canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function toLocal(mx, my) {
  return { x: mx - App.layout.gameOffsetX, y: my - App.layout.gameOffsetY };
}

function startPointer(screenX, screenY) {
  const input = App.input;
  if (App.game.showWin || App.game.showBeginOverlay) return false;

  const point = getCanvasPoint(screenX, screenY);
  const pos = toLocal(point.x, point.y);

  for (let p of App.pieces.list) {
    for (let cell of p.cells) {
      let x = p.x + cell[0] * App.layout.cellSize;
      let y = p.y + cell[1] * App.layout.cellSize;

      if (pos.x > x && pos.x < x + App.layout.cellSize && pos.y > y && pos.y < y + App.layout.cellSize) {
        input.draggingPiece = p;
        input.offsetX = pos.x - p.x;
        input.offsetY = pos.y - p.y;

        input.dragStartPlaced = p.placed;
        input.dragStartX = p.x;
        input.dragStartY = p.y;
        input.dragStartGridX = p.gridX;
        input.dragStartGridY = p.gridY;

        input.ghostValid = false;
        input.ghostGX = 0;
        input.ghostGY = 0;

        p.placed = false;
        return true;
      }
    }
  }

  return false;
}

function movePointer(screenX, screenY) {
  const input = App.input;
  const layout = App.layout;
  const piece = input.draggingPiece;
  
  if (App.game.showWin || !piece) return;

  const point = getCanvasPoint(screenX, screenY);
  const pos = toLocal(point.x, point.y);

  piece.x = pos.x - input.offsetX;
  piece.y = pos.y - input.offsetY;

  const preview = getPreviewGridPosition(piece);

  input.ghostGX = preview.gridX;
  input.ghostGY = preview.gridY;

  input.ghostValid = canPlace(piece, input.ghostGX, input.ghostGY);

  render();
}

function restoreDraggedPiece() {
  const input = App.input;
  const piece = input.draggingPiece;
  
  if (!piece) return;

  if (!input.dragStartPlaced && isPhoneTrayMode()) {
    piece.x = piece.trayX;
    piece.y = piece.trayY;
  } else {
    piece.x = input.dragStartX;
    piece.y = input.dragStartY;
  }

  piece.gridX = input.dragStartGridX;
  piece.gridY = input.dragStartGridY;
  piece.placed = input.dragStartPlaced;
}

function findPieceAtScreenPoint(screenX, screenY) {
  const pieces = App.pieces.list;
  const layout = App.layout;
  const cellSize = layout.cellSize;
  const point = getCanvasPoint(screenX, screenY);
  const pos = toLocal(point.x, point.y);

  for (let p of pieces) {
    const isTrayPiece = isPhoneTrayMode() && !p.placed;
    const visualX = isTrayPiece ? p.x - layout.trayScrollX : p.x;

    if (isTrayPiece && !pointInTray(screenX, screenY)) {
      continue;
    }

    for (let cell of p.cells) {
      const x = visualX + cell[0] * cellSize;
      const y = p.y + cell[1] * cellSize;

      if (pos.x > x && pos.x < x + cellSize && pos.y > y && pos.y < y + cellSize) {
        return {
          piece: p,
          offsetX: pos.x - visualX,
          offsetY: pos.y - p.y
        };
      }
    }
  }

  return null;
}

function beginDraggingPiece(piece, startOffsetX, startOffsetY) {
  App.input.draggingPiece = piece;
  App.input.offsetX = startOffsetX;
  App.input.offsetY = startOffsetY;

  App.input.dragStartPlaced = piece.placed;
  App.input.dragStartX = (isPhoneTrayMode() && !piece.placed) ? piece.x - App.layout.trayScrollX : piece.x;
  App.input.dragStartY = piece.y;
  App.input.dragStartGridX = piece.gridX;
  App.input.dragStartGridY = piece.gridY;

  App.input.ghostValid = false;
  App.input.ghostGX = 0;
  App.input.ghostGY = 0;

  piece.x = App.input.dragStartX;
  piece.placed = false;
}

function getMobilePreviewLift() {
  if (!isPhoneTrayMode()) return 0;

  // Increase this number to move the shadow farther above the dragged piece.
  return App.layout.cellSize * 4;
}

function getPreviewGridPosition(piece) {
  const cellSize = App.layout.cellSize;

  const previewX = piece.x;
  const previewY = piece.y - getMobilePreviewLift();

  return {
    gridX: Math.floor((previewX + cellSize / 2) / cellSize),
    gridY: Math.floor((previewY + cellSize / 2) / cellSize)
  };
}

function getDropTarget(piece) {
  const preview = getPreviewGridPosition(piece);

  return {
    gridX: preview.gridX,
    gridY: preview.gridY,
    isValid: canPlace(piece, preview.gridX, preview.gridY)
  };
}

function handleValidDrop(piece, gx, gy) {
  if (isSamePlacement(piece, gx, gy)) {
    restoreDraggedPiece();
    return;
  }

  placePiece(piece, gx, gy);
  saveCurrentPuzzleProgress();

  if (checkWin() && !App.game.showWin && !App.game.winAnimationActive) {
    handlePuzzleCompletion();
  }
}

function handleInvalidDrop(piece) {
  if (App.input.dragStartPlaced) {
    returnPieceToTray(piece);
    saveCurrentPuzzleProgress();
  } else {
    restoreDraggedPiece();
  }
}

function resetDragVisualState() {
  App.input.ghostValid = false;
  App.input.ghostGX = 0;
  App.input.ghostGY = 0;
}

function finishDrag() {
  resetDragVisualState();
  App.input.draggingPiece = null;
  App.input.pendingTouchPiece = null;
  render();
}

function endPointer() {
  if (App.game.showWin || !App.input.draggingPiece) return;

  const piece = App.input.draggingPiece;
  const drop = getDropTarget(piece);

  if (drop.isValid) {
    handleValidDrop(piece, drop.gridX, drop.gridY);
  } else {
    handleInvalidDrop(piece);
  }

  finishDrag();
}

// -----------------------------
// EVENT LISTENERS
// -----------------------------
App.dom.canvas.addEventListener("mousedown", onMouseDown);
App.dom.canvas.addEventListener("mousemove", onMouseMove);
App.dom.canvas.addEventListener("mouseup", onMouseUp);

App.dom.canvas.addEventListener("touchstart", onTouchStart, { passive: false });
App.dom.canvas.addEventListener("touchmove", onTouchMove, { passive: false });
App.dom.canvas.addEventListener("touchend", onTouchEnd, { passive: false });
App.dom.canvas.addEventListener("touchcancel", onTouchCancel, { passive: false });

function onMouseDown(e) {
  startPointer(e.clientX, e.clientY);
}

function onMouseMove(e) {
  movePointer(e.clientX, e.clientY);
}

function onMouseUp() {
  endPointer();
}

function isTouchInTray(touch) {
  return isPhoneTrayMode() && pointInTray(touch.clientX, touch.clientY);
}

function beginTraySwipe(touch) {
  App.input.traySwipeActive = true;
  App.input.traySwipeStartX = touch.clientX;
  App.input.traySwipeStartY = touch.clientY;
  App.input.traySwipeStartScrollX = App.layout.trayScrollX;
  App.input.traySwipeTouchId = touch.identifier;
}

function stopTraySwipe() {
  App.input.traySwipeActive = false;
  App.input.traySwipeTouchId = null;
}

function shouldStartTraySwipe(dx, dy) {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  return absX > 6 && absX > absY;
}

function shouldStartTrayPieceDrag(dx, dy) {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  return absY > App.constants.TOUCH_DRAG_THRESHOLD && absY >= absX;
}

function updateTraySwipe(touch) {
  const dx = touch.clientX - App.input.traySwipeStartX;
  const dy = touch.clientY - App.input.traySwipeStartY;

  if (!shouldStartTraySwipe(dx, dy)) {
    return false;
  }

  App.layout.trayScrollX = App.input.traySwipeStartScrollX - dx;
  clampTrayScroll();
  render();
  return true;
}

function onTouchStart(e) {
  if (App.game.showWin || App.game.showBeginOverlay || e.touches.length === 0) return;

  const touch = e.touches[0];
  const inTray = isTouchInTray(touch);

  if (inTray) {
    beginTraySwipe(touch);
  }

  const hit = findPieceAtScreenPoint(touch.clientX, touch.clientY);
  if (!hit) return;

  App.input.pendingTouchPiece = hit.piece;
  App.input.pendingTouchOffsetX = hit.offsetX;
  App.input.pendingTouchOffsetY = hit.offsetY;
  App.input.pendingTouchStartClientX = touch.clientX;
  App.input.pendingTouchStartClientY = touch.clientY;

  // Reserve touch interaction whenever a piece is touched,
  // not just for tray touches.
  e.preventDefault();
}

function onTouchMove(e) {
  if (App.game.showWin || App.game.showBeginOverlay || e.touches.length === 0) return;

  const touch = e.touches[0];

  if (isPhoneTrayMode() && App.input.traySwipeActive && !App.input.draggingPiece) {
    if (updateTraySwipe(touch)) {
      e.preventDefault();
      return;
    }
  }

  if (!App.input.draggingPiece && App.input.pendingTouchPiece) {
    const dx = touch.clientX - App.input.pendingTouchStartClientX;
    const dy = touch.clientY - App.input.pendingTouchStartClientY;

    if (isPhoneTrayMode() && App.input.traySwipeActive && !App.input.pendingTouchPiece.placed) {
      if (shouldStartTrayPieceDrag(dx, dy)) {
        beginDraggingPiece(
          App.input.pendingTouchPiece,
          App.input.pendingTouchOffsetX,
          App.input.pendingTouchOffsetY
        );
        stopTraySwipe();
      }
    } else {
      const dist = Math.hypot(dx, dy);
      if (dist >= App.constants.TOUCH_DRAG_THRESHOLD) {
        beginDraggingPiece(
          App.input.pendingTouchPiece,
          App.input.pendingTouchOffsetX,
          App.input.pendingTouchOffsetY
        );
      }
    }
  }

  if (App.input.draggingPiece) {
    movePointer(touch.clientX, touch.clientY);
    e.preventDefault();
  }
}

function onTouchEnd() {
  if (App.input.draggingPiece) {
    endPointer();
  }

  stopTraySwipe();
  App.input.pendingTouchPiece = null;
}

function onTouchCancel() {
  stopTraySwipe();
  App.input.pendingTouchPiece = null;

  if (!App.input.draggingPiece) return;

  restoreDraggedPiece();

  App.input.ghostValid = false;
  App.input.ghostGX = 0;
  App.input.ghostGY = 0;
  App.input.draggingPiece = null;
  render();
}

// -----------------------------
// GENERAL HELPERS
// -----------------------------
function getCSS(v) {
  return getComputedStyle(document.body).getPropertyValue(v);
}

function isValidPuzzleData(data) {
  return (
    data &&
    Number.isInteger(data.grid_width) &&
    Number.isInteger(data.grid_height) &&
    Array.isArray(data.filled_cells) &&
    Array.isArray(data.shapes)
  );
}

// -----------------------------
// BOOT
// -----------------------------
(async () => {
  applySavedTheme();
  applySavedLabels();
  loadStreak();

  const todayIndex = getDailyIndex();
  const savedViewedDay = getSavedViewedDay();

  const minIndex = getCalendarStartIndex();
  const maxIndex = Math.min(todayIndex, getLastAvailablePuzzleIndex());

  App.puzzle.selectedDay = Math.max(minIndex, Math.min(maxIndex, savedViewedDay ?? todayIndex));
  await loadPuzzle(App.puzzle.selectedDay);
})();