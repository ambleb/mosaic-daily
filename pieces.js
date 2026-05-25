// -----------------------------
// PIECE LAYOUT
// -----------------------------
function getPuzzleShuffleSeed(dayIndex) {
  // This keeps the order stable per puzzle day.
  return (dayIndex + 1) * 1000003;
}

function seededRandom(seed) {
  let value = seed >>> 0;

  return function () {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getShuffledShapesForCurrentPuzzle() {
  const shapes = App.puzzle.currentData.shapes.map((shape, originalIndex) => ({
    shape,
    originalIndex
  }));

  const random = seededRandom(getPuzzleShuffleSeed(App.puzzle.selectedDay));

  for (let i = shapes.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shapes[i], shapes[j]] = [shapes[j], shapes[i]];
  }

  return shapes;
}

function getShapeSize(shape) {
  const cells = normalize(shape);
  const maxX = Math.max(...cells.map(c => c[0]));
  const maxY = Math.max(...cells.map(c => c[1]));

  return {
    cells,
    width: (maxX + 1) * App.layout.cellSize,
    height: (maxY + 1) * App.layout.cellSize
  };
}

function getLargestPieceSize() {
  let maxWidth = 0;
  let maxHeight = 0;

  App.puzzle.currentData.shapes.forEach(shape => {
    const { width, height } = getShapeSize(shape);
    maxWidth = Math.max(maxWidth, width);
    maxHeight = Math.max(maxHeight, height);
  });

  return { maxWidth, maxHeight };
}

function createPreviousPieceStateMap() {
  return new Map(
    App.pieces.list.map(p => [
      p.label,
      {
        placed: p.placed,
        x: p.x,
        y: p.y,
        gridX: p.gridX,
        gridY: p.gridY
      }
    ])
  );
}

function restorePieceState(piece, prev) {
  if (!prev) return;

  piece.placed = prev.placed;
  piece.gridX = prev.gridX;
  piece.gridY = prev.gridY;

  if (prev.placed) {
    piece.x = prev.gridX * App.layout.cellSize;
    piece.y = prev.gridY * App.layout.cellSize;
  } else {
    piece.x = piece.trayX;
    piece.y = piece.trayY;
  }
}

function prepareTrayLayout(board, layout) {
  if (isPhoneTrayMode()) {
    App.layout.trayViewport = getPhoneTrayMetrics(board.boardWidth, board.boardHeight);
  } else {
    resetPhoneTrayState();
  }

  return getDesktopTrayMetrics(board.boardWidth, layout);
}

function resetPhoneTrayState() {
  App.layout.trayViewport = null;
  App.layout.trayScrollX = 0;
  App.layout.trayMaxScrollX = 0;
}

function getInitialLayoutState(boardHeight, trayMetrics) {
  return {
    leftCursorY: 0,
    rightCursorY: 0,
    bottomCursorX: trayMetrics.bottomTrayLeft,
    bottomCursorY: trayMetrics.bottomTrayY,
    bottomRowHeight: 0,
    phoneTrayCursorX: 0,
    lowestBottomEdge: boardHeight
  };
}

function createPieces() {
  const previousPieces = createPreviousPieceStateMap();
  const layout = getLayoutConfig();
  const board = getBoardMetrics(layout);
  const trayMetrics = prepareTrayLayout(board, layout);
  const state = getInitialLayoutState(board.boardHeight, trayMetrics);

  const shuffledShapes = getShuffledShapesForCurrentPuzzle();

  if (!Array.isArray(shuffledShapes)) {
    console.error("getShuffledShapesForCurrentPuzzle() did not return an array:", shuffledShapes);
    return;
  }

  App.pieces.list = shuffledShapes.map((entry, index) =>
    createPiece(entry.shape, index, board, trayMetrics, state, layout, previousPieces)
  );

  finalizePieceLayout(state, layout);
}

function createPiece(shape, index, board, trayMetrics, state, layout, previousPieces) {
  const { cells, width, height } = getShapeSize(shape);
  const position = getPieceTrayPosition(width, height, board, trayMetrics, state, layout);
  const label = index + 1;

  const piece = buildPieceObject(cells, position, label, index);

  restorePieceState(piece, previousPieces.get(label));
  updateLowestPieceEdge(state, position, height);

  return piece;
}

function getPieceTrayPosition(width, height, board, trayMetrics, state, layout) {
  if (layout.bottomTrayOnly) {
    return layoutPhoneTrayPiece(width, height, state);
  }

  return layoutDesktopTrayPiece(
    width,
    height,
    board.boardHeight,
    trayMetrics,
    state,
    layout
  );
}

function buildPieceObject(cells, position, label, colorIndex) {
  return {
    cells,
    x: position.x,
    y: position.y,
    trayX: position.x,
    trayY: position.y,
    placed: false,
    gridX: 0,
    gridY: 0,
    color: App.puzzle.shapeColors[colorIndex],
    label
  };
}

function layoutPhoneTrayPiece(width, height, state) {
  const layoutState = App.layout;
  const tray = layoutState.trayViewport;
  const layout = getLayoutConfig();
  const trayPadding = layout.trayPadding ?? 8;

  const trayInnerY =
    (tray.y - layoutState.gameOffsetY) + (tray.height - height) / 2;

  const trayStartX =
    (tray.x - layoutState.gameOffsetX) + trayPadding;

  const x = trayStartX + state.phoneTrayCursorX;
  const y = trayInnerY;

  state.phoneTrayCursorX += width + layout.pieceSpacing;

  state.lowestBottomEdge = Math.max(
    state.lowestBottomEdge,
    (tray.y - layoutState.gameOffsetY) + tray.height
  );

  return { x, y };
}

function layoutDesktopTrayPiece(width, height, boardHeight, trayMetrics, state, layout) {
  const sideTrayBottomLimit = trayMetrics.bottomTrayY - layout.pieceSpacing;

  const fitsLeft =
    width <= trayMetrics.leftTrayWidth &&
    state.leftCursorY + height <= sideTrayBottomLimit;

  const fitsRight =
    width <= trayMetrics.rightTrayWidth &&
    state.rightCursorY + height <= sideTrayBottomLimit;

  let x, y;

  if (fitsLeft && (!fitsRight || state.leftCursorY <= state.rightCursorY)) {
    x = trayMetrics.leftTrayRight - width;
    y = state.leftCursorY;
    state.leftCursorY += height + layout.pieceSpacing;
  } else if (fitsRight) {
    x = trayMetrics.rightTrayLeft;
    y = state.rightCursorY;
    state.rightCursorY += height + layout.pieceSpacing;
  } else {
    const rowRightEdge = trayMetrics.bottomTrayLeft + trayMetrics.bottomTrayWidth;

    if (
      state.bottomCursorX > trayMetrics.bottomTrayLeft &&
      state.bottomCursorX + width > rowRightEdge
    ) {
      state.bottomCursorX = trayMetrics.bottomTrayLeft;
      state.bottomCursorY += state.bottomRowHeight + layout.pieceSpacing;
      state.bottomRowHeight = 0;
    }

    x = state.bottomCursorX;
    y = state.bottomCursorY;

    state.bottomCursorX += width + layout.pieceSpacing;
    state.bottomRowHeight = Math.max(state.bottomRowHeight, height);
    state.lowestBottomEdge = Math.max(state.lowestBottomEdge, y + height);
  }

  return { x, y };
}

function updateLowestPieceEdge(state, position, height) {
  state.lowestBottomEdge = Math.max(
    state.lowestBottomEdge,
    position.y + height
  );
}

function finalizePieceLayout(state, layout) {
  finalizeTrayBounds(state);
  finalizeCanvasHeight(state.lowestBottomEdge, layout.extraBottomPadding);
}

function finalizeTrayBounds(state) {
  if (isPhoneTrayMode() && App.layout.trayViewport) {
    const layout = getLayoutConfig();
    const trayPadding = layout.trayPadding ?? 8;
    const trayContentWidth = state.phoneTrayCursorX + trayPadding;

    App.layout.trayMaxScrollX = Math.max(0, trayContentWidth - App.layout.trayViewport.width);
    clampTrayScroll();
  } else {
    App.layout.trayMaxScrollX = 0;
  }
}

function finalizeCanvasHeight(lowestBottomEdge, extraBottomPadding) {
  const neededHeight = App.layout.gameOffsetY + lowestBottomEdge + extraBottomPadding;
  App.dom.canvas.height = Math.max(window.innerHeight, neededHeight);
}