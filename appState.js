const App = {
  constants: {
	GAME_NAME: "Mosaic Daily",
	GAME_URL: "https://ambleb.github.io/mosaic-daily/",

    PUZZLE_EPOCH_DATE: new Date(2024, 0, 1),
    CALENDAR_START_DATE: new Date(2026, 2, 20),

    TOUCH_DRAG_THRESHOLD: 12,
    WIN_ANIMATION_DURATION: 550,
    WIN_OVERLAY_DELAY: 180,

    BOARD_BACKGROUND: {
      padding: 5,
      radius: 8,
      shadowColor: "rgba(0,0,0,0.18)",
      shadowBlur: 14,
      shadowOffsetY: 2
    },

    DEFAULT_LAYOUT_TEXT: {
      dateFont: '700 24px Georgia, "Times New Roman", serif',
      movesFont: '20px Georgia, "Times New Roman", serif'
    },

    DEFAULT_TRAY_SETTINGS: {
      trayGap: 8,
      pieceSpacing: 10,
      trayPadding: 8,
      maxHiddenBoardGap: 15
    }
  },

  dom: {
    canvas: document.getElementById("canvas"),
    ctx: null
  },

  puzzle: {
    currentData: null,
    shapeColors: [],
    selectedDay: 0,
    replayingSelectedPuzzle: false,
	replayWasStartedFromCompleted: false,
  },

  pieces: {
    list: []
  },

  layout: {
    cellSize: 30,

    gameOffsetX: 0,
    gameOffsetY: 0,

    trayScrollX: 0,
    trayMaxScrollX: 0,
    trayViewport: null,

    lastLayoutMode: null,
    lastOrientation: null
  },

  input: {
    draggingPiece: null,
    offsetX: 0,
    offsetY: 0,

    dragStartPlaced: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartGridX: 0,
    dragStartGridY: 0,

    pendingTouchPiece: null,
    pendingTouchOffsetX: 0,
    pendingTouchOffsetY: 0,
    pendingTouchStartClientX: 0,
    pendingTouchStartClientY: 0,

    traySwipeActive: false,
    traySwipeStartX: 0,
    traySwipeStartY: 0,
    traySwipeStartScrollX: 0,
    traySwipeTouchId: null,

    ghostValid: false,
    ghostGX: 0,
    ghostGY: 0
  },

  game: {
    moveCount: 0,
    showWin: false,
    labelsEnabled: false,
    showBeginOverlay: false,

    winAnimationActive: false,
    winAnimationProgress: 0,
	
	lastCompletionWasPractice: false,
  },

  calendar: {
    calendarOffset: 0
  },

  streak: {
    current: 0,
    best: 0,
    lastCompletedDate: null
  }
};

App.dom.ctx = App.dom.canvas.getContext("2d");