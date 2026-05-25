// -----------------------------
// LAYOUT HELPERS
// -----------------------------
function getLayoutMode() {
  const width = window.innerWidth;

  if (width <= 768) return "phone";
  if (width <= 1024) return "tablet";
  return "desktop";
}

function getLayoutConfig() {
  const mode = getLayoutMode();

  if (mode === "phone") return getPhoneLayoutConfig();
  if (mode === "tablet") return getTabletLayoutConfig();
  return getDesktopLayoutConfig();
}

function getPhoneLayoutConfig() {
  return {
    mode: "phone",
    bottomTrayOnly: true,

    cellSize: getPhoneCellSize(),
    sideMargin: 16,
    topMargin: 75,

    ...App.constants.DEFAULT_TRAY_SETTINGS,
    trayGap: 5,

    extraBottomPadding: 80,
    bottomTrayExtraWidth: 80,

    ...App.constants.DEFAULT_LAYOUT_TEXT,
    dateY: -58,
    movesY: -26,

    labelRadius: 10,
    labelFontSize: 13
  };
}

function getTabletLayoutConfig() {
  return {
    mode: "tablet",
    bottomTrayOnly: false,

    cellSize: getTabletCellSize(),
    sideMargin: 24,
    topMargin: 130,

    ...App.constants.DEFAULT_TRAY_SETTINGS,

    extraBottomPadding: 70,
    bottomTrayExtraWidth: 160,

    dateFont: '700 28px Georgia, "Times New Roman", serif',
    movesFont: '22px Georgia, "Times New Roman", serif',
    dateY: -64,
    movesY: -30,

    labelRadius: 9,
    labelFontSize: 12
  };
}

function getDesktopLayoutConfig() {
  const text = App.constants.DEFAULT_LAYOUT_TEXT;
  const tray = App.constants.DEFAULT_TRAY_SETTINGS;

  return {
    mode: "desktop",
    bottomTrayOnly: false,

    cellSize: getDesktopCellSize(),
    sideMargin: 48,
    topMargin: 120,

    ...tray,
    pieceSpacing: 10,

    extraBottomPadding: 80,
    bottomTrayExtraWidth: 300,

    ...text,
    dateY: -56,
    movesY: -24,

    labelRadius: 8,
    labelFontSize: 12
  };
}

function getPhoneCellSize() {
  if (!App.puzzle.currentData) return 38;

  const layoutSideMargin = 16;
  const availableWidth = window.innerWidth - layoutSideMargin * 2 - 20;
  const maxBoardWidthCells = App.puzzle.currentData.grid_width;

  const fitted = Math.floor(availableWidth / maxBoardWidthCells);

  return Math.max(24, Math.min(38, fitted));
}

function getDesktopCellSize() {
  const data = App.puzzle.currentData;

  if (!data) return 30;

  const maxCellSize = 30;
  const minCellSize = 22;

  const reservedTop = 120;
  const reservedBottom = 220;

  const availableHeight = window.innerHeight - reservedTop - reservedBottom;
  const heightBasedCellSize = Math.floor(availableHeight / data.grid_height);

  return Math.max(
    minCellSize,
    Math.min(maxCellSize, heightBasedCellSize)
  );
}

function getTabletCellSize() {
  const data = App.puzzle.currentData;

  if (!data) return 34;

  const maxCellSize = 34;
  const minCellSize = 24;

  const reservedTop = 120;
  const reservedBottom = 240;

  const availableHeight = window.innerHeight - reservedTop - reservedBottom;
  const heightBasedCellSize = Math.floor(availableHeight / data.grid_height);

  return Math.max(
    minCellSize,
    Math.min(maxCellSize, heightBasedCellSize)
  );
}

function resizeCanvas(forceRebuild = false) {
  const layout = getLayoutConfig();
  const nextMode = layout.mode;
  const nextOrientation = getOrientation();
  const nextWidth = window.innerWidth;
  const nextHeight = window.innerHeight;

  const modeChanged = nextMode !== App.layout.lastLayoutMode;
  const orientationChanged = nextOrientation !== App.layout.lastOrientation;

  App.layout.cellSize = layout.cellSize;

  App.dom.canvas.width = nextWidth;
  App.dom.canvas.height = Math.max(nextHeight, App.dom.canvas.height || 0);

  if (
    App.puzzle.currentData &&
    !App.game.showWin &&
    (forceRebuild || modeChanged || orientationChanged || App.pieces.list.length === 0)
  ) {
    createPieces();
  }

  render();

  App.layout.lastLayoutMode = nextMode;
  App.layout.lastOrientation = nextOrientation;
}

function getBoardMetrics(layout) {
  const data = App.puzzle.currentData;
  const canvas = App.dom.canvas;
  const cellSize = App.layout.cellSize;
  const boardWidth = data.grid_width * cellSize;
  const boardHeight = data.grid_height * cellSize;

  App.layout.gameOffsetX = Math.floor((canvas.width - boardWidth) / 2);
  App.layout.gameOffsetY = layout.topMargin;

  return { boardWidth, boardHeight };
}

function getRenderBoardMetrics(layout) {
  return {
    width: App.puzzle.currentData.grid_width * App.layout.cellSize,
    height: App.puzzle.currentData.grid_height * App.layout.cellSize
  };
}

function updateRenderOffsets(board, layout) {
  App.layout.gameOffsetX = Math.floor((App.dom.canvas.width - board.width) / 2);
  App.layout.gameOffsetY = layout.topMargin;
}

function getFilledCellBounds() {
  const xs = App.puzzle.currentData.filled_cells.map(([x]) => x);
  const ys = App.puzzle.currentData.filled_cells.map(([, y]) => y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function getVisibleBoardRect() {
  const cellSize = App.layout.cellSize;
  const bounds = getFilledCellBounds();

  return {
    x: bounds.minX * cellSize,
    y: bounds.minY * cellSize,
    width: bounds.width * cellSize,
    height: bounds.height * cellSize,
    right: (bounds.maxX + 1) * cellSize,
    bottom: (bounds.maxY + 1) * cellSize
  };
}

function getTrayAnchorRect(boardWidth, boardHeight, layout) {
  const visibleBoard = getVisibleBoardRect();
  const maxHiddenGap = layout.maxHiddenBoardGap ?? 18;

  return {
    x: Math.max(0, visibleBoard.x - maxHiddenGap),
    right: Math.min(boardWidth, visibleBoard.right + maxHiddenGap),
    bottom: Math.min(boardHeight, visibleBoard.bottom + maxHiddenGap)
  };
}

function getPhoneTrayMetrics(boardWidth, boardHeight) {
  const layout = getLayoutConfig();
  const trayAnchor = getTrayAnchorRect(boardWidth, boardHeight, layout);
  const largestPiece = getLargestPieceSize();

  const trayMargin = layout.sideMargin;
  const trayGapAbove = layout.trayGap;
  const trayPadding = layout.trayPadding ?? 8;

  const minTrayHeight = App.layout.cellSize * 4 + trayPadding * 4;
  const pieceAwareHeight = largestPiece.maxHeight + trayPadding * 2;
  const trayHeight = Math.max(minTrayHeight, pieceAwareHeight);

  return {
    x: trayMargin,
    y: App.layout.gameOffsetY + trayAnchor.bottom + trayGapAbove,
    width: App.dom.canvas.width - trayMargin * 2,
    height: trayHeight
  };
}

function getDesktopTrayMetrics(boardWidth, layout) {
  const canvas = App.dom.canvas;
  const layoutState = App.layout;
  const data = App.puzzle.currentData;
  const cellSize = layoutState.cellSize;
  const sideMargin = layout.sideMargin;
  const trayGap = layout.trayGap;
  const boardHeight = data.grid_height * cellSize;
  const trayAnchor = getTrayAnchorRect(boardWidth, boardHeight, layout);
  const largestPiece = getLargestPieceSize();

  const bottomAvailableLeft = -layoutState.gameOffsetX + sideMargin;
  const bottomAvailableRight = canvas.width - layoutState.gameOffsetX - sideMargin;
  const bottomAvailableWidth = Math.max(0, bottomAvailableRight - bottomAvailableLeft);

  const boardCenterX = boardWidth / 2;
  const bottomTrayWidth = Math.min(
    bottomAvailableWidth,
    boardWidth + layout.bottomTrayExtraWidth
  );

  let bottomTrayLeft = boardCenterX - bottomTrayWidth / 2;
  bottomTrayLeft = Math.max(bottomAvailableLeft, bottomTrayLeft);

  const maxBottomTrayLeft = bottomAvailableRight - bottomTrayWidth;
  bottomTrayLeft = Math.min(bottomTrayLeft, maxBottomTrayLeft);

  const leftTrayLeft = -layoutState.gameOffsetX + sideMargin;
  const leftTrayRight = trayAnchor.x - trayGap;
  const leftTrayWidth = Math.max(0, leftTrayRight - leftTrayLeft);

  const rightTrayLeft = trayAnchor.right + trayGap;
  const rightTrayRight = canvas.width - layoutState.gameOffsetX - sideMargin;
  const rightTrayWidth = Math.max(0, rightTrayRight - rightTrayLeft);

  const minSideTrayWidth = largestPiece.maxWidth + layout.pieceSpacing;

  return {
    bottomTrayLeft,
    bottomTrayWidth,
    bottomTrayY: trayAnchor.bottom + trayGap,

    leftTrayRight,
    leftTrayWidth: leftTrayWidth >= minSideTrayWidth ? leftTrayWidth : 0,

    rightTrayLeft,
    rightTrayWidth: rightTrayWidth >= minSideTrayWidth ? rightTrayWidth : 0
  };
}

function isPhoneTrayMode() {
  return getLayoutMode() === "phone";
}

function clampTrayScroll() {
  App.layout.trayScrollX = Math.max(0, Math.min(App.layout.trayScrollX, App.layout.trayMaxScrollX));
}