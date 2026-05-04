// -----------------------------
// CONSTANTS / DOM
// -----------------------------
const PUZZLE_EPOCH_DATE = new Date(2024, 0, 1);
const CALENDAR_START_DATE = new Date(2026, 2, 20); // March 20, 2026

const TOUCH_DRAG_THRESHOLD = 12;
const WIN_ANIMATION_DURATION = 550;
const WIN_OVERLAY_DELAY = 180;

let cellSize = 30;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// -----------------------------
// APP STATE
// -----------------------------
let currentData = null;
let shapeColors = [];
let showBeginOverlay = false;

let pieces = [];
let draggingPiece = null;
let offsetX = 0;
let offsetY = 0;

let dragStartPlaced = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartGridX = 0;
let dragStartGridY = 0;

let pendingTouchPiece = null;
let pendingTouchOffsetX = 0;
let pendingTouchOffsetY = 0;
let pendingTouchStartClientX = 0;
let pendingTouchStartClientY = 0;

let trayScrollX = 0;
let trayMaxScrollX = 0;
let trayViewport = null;

let traySwipeActive = false;
let traySwipeStartX = 0;
let traySwipeStartY = 0;
let traySwipeStartScrollX = 0;
let traySwipeTouchId = null;

let ghostValid = false;
let ghostGX = 0;
let ghostGY = 0;

let gameOffsetX = 0;
let gameOffsetY = 0;

let moveCount = 0;
let showWin = false;
let labelsEnabled = false;

let winAnimationActive = false;
let winAnimationProgress = 0;

let replayingSelectedPuzzle = false;

let selectedDay = 0;
let calendarOffset = 0;

let lastLayoutMode = null;
let lastOrientation = null;

// -----------------------------
// STREAK STATE
// -----------------------------
let streakCurrent = 0;
let streakBest = 0;
let lastCompletedDate = null;

// -----------------------------
// DATE HELPERS
// -----------------------------
function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatLocalDateKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPuzzleDateLocal(dayIndex) {
  const d = new Date(PUZZLE_EPOCH_DATE);
  d.setDate(PUZZLE_EPOCH_DATE.getDate() + dayIndex);
  return d;
}

function getPuzzleDate(dayIndex) {
  return new Date(Date.UTC(2024, 0, 1 + dayIndex));
}

function getDayIndexFromDate(date) {
  const d = new Date(date);

  const targetUTC = Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );

  const baseUTC = Date.UTC(2024, 0, 1);

  return Math.floor((targetUTC - baseUTC) / 86400000);
}

function getDateKey(dayIndex) {
  return formatLocalDateKey(getPuzzleDate(dayIndex));
}

function formatPuzzleDate(dayIndex, format = "long") {
  const puzzleDate = getPuzzleDateLocal(dayIndex);
  
  const options =
    format === "short"
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "long", day: "numeric", year: "numeric" };

  return puzzleDate.toLocaleDateString(undefined, options);
}

function getTodayKey() {
  return formatLocalDateKey(new Date());
}

function getYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalDateKey(d);
}

function getDailyIndex() {
  return getDayIndexFromDate(new Date());
}

function getCalendarStartIndex() {
  return getDayIndexFromDate(CALENDAR_START_DATE);
}

function getLastAvailablePuzzleIndex() {
  return getCalendarStartIndex() + puzzleFiles.length - 1;
}

// -----------------------------
// STORAGE HELPERS
// -----------------------------
function getCompletedKey(dayIndex) {
  return "puzzle_" + getDateKey(dayIndex);
}

function getProgressKey(dayIndex) {
  return "puzzle_state_" + getDateKey(dayIndex);
}

function getViewedDayStorageKey() {
  return "viewed_day";
}

function getThemeStorageKey() {
  return "theme";
}

function getLabelsStorageKey() {
  return "piece_labels";
}

function getStreakCurrentStorageKey() {
  return "streak_current";
}

function getStreakBestStorageKey() {
  return "streak_best";
}

function getLastCompletedDateStorageKey() {
  return "last_completed_date";
}

function isCompleted(dayIndex) {
  return localStorage.getItem(getCompletedKey(dayIndex)) !== null;
}

function saveCompletedPuzzleState(dayIndex, moves) {
  localStorage.setItem(
    getCompletedKey(dayIndex),
    JSON.stringify({
      completed: true,
      moves
    })
  );
}

function loadCompletedPuzzleState(dayIndex) {
  const raw = localStorage.getItem(getCompletedKey(dayIndex));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse completed puzzle state:", err);
    localStorage.removeItem(getCompletedKey(dayIndex));
    return null;
  }
}

function saveCurrentPuzzleProgress() {
  if (!currentData || showWin) return;

  const key = getProgressKey(selectedDay);

  const placedPieces = pieces
    .filter(p => p.placed)
    .map(p => ({
      label: p.label,
      gridX: p.gridX,
      gridY: p.gridY
    }));

  localStorage.setItem(
    key,
    JSON.stringify({
      moves: moveCount,
      placedPieces
    })
  );
}

function clearCurrentPuzzleProgress(dayIndex = selectedDay) {
  localStorage.removeItem(getProgressKey(dayIndex));
}

function applySavedPuzzleProgress(dayIndex) {
  const raw = localStorage.getItem(getProgressKey(dayIndex));
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);
    const placedMap = new Map((data.placedPieces || []).map(p => [p.label, p]));

    moveCount = Number.isInteger(data.moves) ? data.moves : 0;

    pieces.forEach(piece => {
      const saved = placedMap.get(piece.label);

      if (saved) {
        piece.placed = true;
        piece.gridX = saved.gridX;
        piece.gridY = saved.gridY;
        piece.x = saved.gridX * cellSize;
        piece.y = saved.gridY * cellSize;
      } else {
        piece.placed = false;
        piece.gridX = 0;
        piece.gridY = 0;
        piece.x = piece.trayX;
        piece.y = piece.trayY;
      }
    });

    return true;
  } catch (err) {
    console.error("Failed to restore puzzle progress:", err);
    localStorage.removeItem(getProgressKey(dayIndex));
    return false;
  }
}

function saveViewedDay(dayIndex) {
  sessionStorage.setItem(getViewedDayStorageKey(), String(dayIndex));
}

function getSavedViewedDay() {
  const saved = sessionStorage.getItem(getViewedDayStorageKey());
  if (saved === null) return null;

  const parsed = parseInt(saved, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

// -----------------------------
// STREAK HELPERS
// -----------------------------
function loadStreak() {
  streakCurrent = parseInt(localStorage.getItem(getStreakCurrentStorageKey())) || 0;
  streakBest = parseInt(localStorage.getItem(getStreakBestStorageKey())) || 0;
  lastCompletedDate = localStorage.getItem(getLastCompletedDateStorageKey());

  updateStreakDisplay();
}

function updateStreakDisplay() {
  const el = document.getElementById("streakDisplay");
  if (el) el.textContent = `🔥 ${streakCurrent}`;
}

function applyTodayPuzzleCompletionToStreak() {
  const realTodayKey = getTodayKey();
  const realYesterdayKey = getYesterdayKey();
  const todayPuzzleIndex = getDailyIndex();

  if (selectedDay !== todayPuzzleIndex) return;

  if (lastCompletedDate === realTodayKey) {
    return;
  } else if (lastCompletedDate === realYesterdayKey) {
    streakCurrent++;
  } else {
    streakCurrent = 1;
  }

  if (streakCurrent > streakBest) {
    streakBest = streakCurrent;
  }

  lastCompletedDate = realTodayKey;

  localStorage.setItem(getStreakCurrentStorageKey(), streakCurrent);
  localStorage.setItem(getStreakBestStorageKey(), streakBest);
  localStorage.setItem(getLastCompletedDateStorageKey(), lastCompletedDate);

  updateStreakDisplay();
}

// -----------------------------
// SHARE / WIN TEXT
// -----------------------------
function buildShareGridText(cells, separator = "\n") {
  let minX = Math.min(...cells.map(c => c[0]));
  let maxX = Math.max(...cells.map(c => c[0]));
  let minY = Math.min(...cells.map(c => c[1]));
  let maxY = Math.max(...cells.map(c => c[1]));

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  const grid = Array.from({ length: height }, () => Array(width).fill("⬜"));

  cells.forEach(([x, y]) => {
    const gx = x - minX;
    const gy = y - minY;

    if (grid[gy] && grid[gy][gx] !== undefined) {
      grid[gy][gx] = "🟩";
    }
  });

  return grid.map(row => row.join("")).join(separator);
}

function getShareText() {
  try {
    if (!currentData || !currentData.filled_cells?.length) {
      return `Puzzle ${selectedDay}\nMoves: ${moveCount}`;
    }

    const gridLines = buildShareGridText(currentData.filled_cells, "\n");
    const dateStr = formatPuzzleDate(selectedDay, "short");

    return `${dateStr}
Moves: ${moveCount}

${gridLines}

${streakCurrent} Day Streak!`;
  } catch (err) {
    console.error("Share text error:", err);

    return `Puzzle ${selectedDay}
Moves: ${moveCount}
${streakCurrent} Day Streak!`;
  }
}

function copyResult() {
  const text = getShareText();
  navigator.clipboard.writeText(text);

  const msg = document.getElementById("copyMsg");
  if (!msg) return;

  msg.textContent = "Copied!";
  msg.style.opacity = 1;

  setTimeout(() => {
    msg.style.opacity = 0;
  }, 1500);
}

function getWinPreviewHTML() {
  const isTodayPuzzle = selectedDay === getDailyIndex();

  if (!currentData || !currentData.filled_cells?.length) {
    return `
      <div class="winDate">Puzzle ${selectedDay}</div>
      <div class="winMovesPreview">Moves: ${moveCount}</div>
      ${isTodayPuzzle ? `<div class="winStreakPreview">${streakCurrent} Day Streak!</div>` : ""}
    `;
  }

  const gridLines = buildShareGridText(currentData.filled_cells, "<br>");
  const dateStr = formatPuzzleDate(selectedDay, "short");

  return `
    <div class="winDate">${dateStr}</div>
    <div class="winMovesPreview">Moves: ${moveCount}</div>
    ${isTodayPuzzle ? `<div class="winStreakPreview">${streakCurrent} Day Streak!</div>` : ""}
    <div class="winGridPreview">${gridLines}</div>
  `;
}

// -----------------------------
// OVERLAYS / UI
// -----------------------------
function showWinOverlay() {
  const winSharePreview = document.getElementById("winSharePreview");

  if (winSharePreview) {
    winSharePreview.innerHTML = getWinPreviewHTML();
  }

  const todayIndex = getDailyIndex();
  const nextEl = document.getElementById("winNext");

  if (selectedDay === todayIndex) {
    nextEl.textContent = "Come back tomorrow for a new puzzle.";
  } else {
    nextEl.textContent = "Try another day from the calendar.";
  }

  document.getElementById("winOverlay").classList.add("active");
}

function closeWinOverlay() {
  document.getElementById("winOverlay").classList.remove("active");
}

function getSelectedPuzzleDateString() {
  return formatPuzzleDate(selectedDay, "long");
}

function openBeginOverlay() {
  if (getLayoutMode() !== "phone") return;

  const overlay = document.getElementById("beginOverlay");
  const dateEl = document.getElementById("beginDate");
  if (!overlay || !dateEl) return;

  dateEl.textContent = getSelectedPuzzleDateString();
  overlay.classList.add("active");
  showBeginOverlay = true;
}

function closeBeginOverlay() {
  const overlay = document.getElementById("beginOverlay");
  if (overlay) overlay.classList.remove("active");
  showBeginOverlay = false;
}

function updateRedoPuzzleButton() {
  const btn = document.getElementById("redoPuzzleBtn");
  if (!btn) return;

  btn.classList.toggle("hidden", !showWin);
}

function openSupportOverlay() {
  document.getElementById("supportOverlay").classList.add("active");
}

function closeSupportOverlay() {
  document.getElementById("supportOverlay").classList.remove("active");
}

// -----------------------------
// THEME / LABELS
// -----------------------------
function toggleLabels() {
  labelsEnabled = !labelsEnabled;
  localStorage.setItem(getLabelsStorageKey(), labelsEnabled ? "on" : "off");
  updateLabelsButton();
  render();
}

function applySavedLabels() {
  labelsEnabled = localStorage.getItem(getLabelsStorageKey()) === "on";
  updateLabelsButton();
}

function updateLabelsButton() {
  const btn = document.getElementById("labelsBtn");
  if (!btn) return;

  btn.textContent = "#";
  btn.style.opacity = labelsEnabled ? "1" : "0.6";
}

function toggleTheme() {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  localStorage.setItem(getThemeStorageKey(), isDark ? "dark" : "light");

  const btn = document.getElementById("themeBtn");
  btn.textContent = isDark ? "☀️" : "🌙";

  render();
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem(getThemeStorageKey());

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }

  const btn = document.getElementById("themeBtn");
  if (btn) {
    btn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
  }
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
  moveCount = 0;
  showWin = false;
  pieces = [];
  winAnimationActive = false;
  winAnimationProgress = 0;
}

function applyCompletedState(dayIndex) {
  if (replayingSelectedPuzzle && dayIndex === selectedDay) {
    return;
  }

  const saved = loadCompletedPuzzleState(dayIndex);
  if (!saved) return;

  showWin = true;
  moveCount = saved.moves;
  pieces = [];
  clearCurrentPuzzleProgress(dayIndex);
}

async function redoSelectedPuzzle() {
  clearCurrentPuzzleProgress(selectedDay);
  replayingSelectedPuzzle = true;
  await loadPuzzle(selectedDay);
}

function preparePuzzleDay(dayIndex) {
  selectedDay = dayIndex;
  saveViewedDay(dayIndex);
}

function restoreCompletedPuzzleState(dayIndex) {
  applyCompletedState(dayIndex);
}

function restoreInProgressPuzzleState(dayIndex) {
  if (!showWin) {
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

  currentData = await fetchPuzzleDataForDay(dayIndex);
  generateShapeColors();

  resetPuzzleRuntimeState();
  restoreCompletedPuzzleState(dayIndex);

  refreshPuzzleUI();
  restoreInProgressPuzzleState(dayIndex);

  if (showWin) {
    shrinkCanvasForCompletedPuzzle();
	render();
  }

  if (!showWin) {
    render();
  }

  maybeShowBeginOverlay();
  updateRedoPuzzleButton();
  replayingSelectedPuzzle = false;
}

// -----------------------------
// CALENDAR
// -----------------------------
function changeMonth(delta) {
  const todayIndex = getDailyIndex();
  const todayDate = getPuzzleDateLocal(todayIndex);

  const currentView = new Date(todayDate);
  currentView.setMonth(currentView.getMonth() + calendarOffset);

  const nextView = new Date(currentView);
  nextView.setMonth(nextView.getMonth() + delta);

  const minMonth = new Date(
    CALENDAR_START_DATE.getFullYear(),
    CALENDAR_START_DATE.getMonth(),
    1
  );

  const lastPuzzleIndex = Math.min(getDailyIndex(), getLastAvailablePuzzleIndex());

  const maxMonthDate = getPuzzleDateLocal(lastPuzzleIndex);

  const maxMonth = new Date(maxMonthDate.getFullYear(), maxMonthDate.getMonth(), 1);
  const nextMonthOnly = new Date(nextView.getFullYear(), nextView.getMonth(), 1);

  if (nextMonthOnly < minMonth) return;
  if (nextMonthOnly > maxMonth) return;

  calendarOffset += delta;
  buildCalendar();
}

function buildCalendar() {
  const title = document.getElementById("calendar-title");
  const grid = document.getElementById("calendar-grid");

  grid.innerHTML = "";

  const todayIndex = getDailyIndex();
  const minIndex = getCalendarStartIndex();
  const maxPuzzleIndex = getLastAvailablePuzzleIndex();

  const baseDate = getPuzzleDateLocal(todayIndex);
  baseDate.setMonth(baseDate.getMonth() + calendarOffset);

  title.textContent = baseDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  weekdays.forEach(d => {
    const el = document.createElement("div");
    el.textContent = d;
    el.className = "calendar-weekday";
    grid.appendChild(el);
  });

  const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const startWeekday = firstDay.getDay();

  const daysInMonth = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + 1,
    0
  ).getDate();

  for (let i = 0; i < startWeekday; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), d);
    const dayIndex = getDayIndexFromDate(date);

    const btn = document.createElement("div");
    btn.className = "calendar-day";
    btn.textContent = d;

    if (dayIndex >= minIndex && isCompleted(dayIndex)) {
      btn.classList.add("completed");
    }
    if (dayIndex === todayIndex) btn.classList.add("today");
    if (dayIndex === selectedDay) btn.classList.add("selected");

    if (dayIndex >= minIndex && dayIndex <= todayIndex && dayIndex <= maxPuzzleIndex) {
      btn.onclick = () => {
        loadPuzzle(dayIndex);
        toggleCalendar();
      };
    } else {
      btn.classList.add("disabled");
    }

    grid.appendChild(btn);
  }
}

async function goToToday() {
  const todayIndex = getDailyIndex();
  const playableIndex = Math.min(todayIndex, getLastAvailablePuzzleIndex());

  calendarOffset = 0;
  await loadPuzzle(playableIndex);
  buildCalendar();
  toggleCalendar();
}

function toggleCalendar() {
  document.getElementById("calendar").classList.toggle("hidden");
}

// -----------------------------
// LAYOUT HELPERS
// -----------------------------
function isTouchInput() {
  return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
}

function getLayoutMode() {
  const width = window.innerWidth;

  if (width <= 768) return "phone";
  if (width <= 1024) return "tablet";
  return "desktop";
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

function getPhoneCellSize() {
  if (!currentData) return 38;

  const layoutSideMargin = 16;
  const availableWidth = window.innerWidth - layoutSideMargin * 2 - 20;
  const maxBoardWidthCells = currentData.grid_width;

  const fitted = Math.floor(availableWidth / maxBoardWidthCells);

  return Math.max(24, Math.min(38, fitted));
}

function getLayoutConfig() {
  const mode = getLayoutMode();

  if (mode === "phone") {
    return {
      mode: "phone",
      bottomTrayOnly: true,

      cellSize: getPhoneCellSize(),
      sideMargin: 16,
      topMargin: 75,

      trayGap: 20,
      pieceSpacing: 12,
      extraBottomPadding: 80,
      bottomTrayExtraWidth: 80,

      dateFont: '700 24px Georgia, "Times New Roman", serif',
      movesFont: '20px Georgia, "Times New Roman", serif',
      dateY: -58,
      movesY: -26,

      labelRadius: 10,
      labelFontSize: 13
    };
  }

  if (mode === "tablet") {
    return {
      mode: "tablet",
      bottomTrayOnly: false,

      cellSize: 34,
      sideMargin: 24,
      topMargin: 130,

      trayGap: 24,
      pieceSpacing: 12,
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

  return {
    mode: "desktop",
    bottomTrayOnly: false,

    cellSize: 30,
    sideMargin: 48,
    topMargin: 150,

    trayGap: 30,
    pieceSpacing: 10,
    extraBottomPadding: 60,
    bottomTrayExtraWidth: 240,

    dateFont: '700 24px Georgia, "Times New Roman", serif',
    movesFont: '20px Georgia, "Times New Roman", serif',
    dateY: -56,
    movesY: -24,

    labelRadius: 8,
    labelFontSize: 12
  };
}

function isPhoneTrayMode() {
  return getLayoutMode() === "phone";
}

function getPhoneTrayMetrics(boardWidth, boardHeight) {
  const layout = getLayoutConfig();

  const trayMargin = layout.sideMargin;
  const trayGapAbove = 16;
  const trayHeight = cellSize * 4 + 72;

  return {
    x: trayMargin,
    y: gameOffsetY + boardHeight + trayGapAbove,
    width: canvas.width - trayMargin * 2,
    height: trayHeight
  };
}

function clampTrayScroll() {
  trayScrollX = Math.max(0, Math.min(trayScrollX, trayMaxScrollX));
}

function pointInTray(screenX, screenY) {
  if (!trayViewport) return false;

  return (
    screenX >= trayViewport.x &&
    screenX <= trayViewport.x + trayViewport.width &&
    screenY >= trayViewport.y &&
    screenY <= trayViewport.y + trayViewport.height
  );
}

function getOrientation() {
  return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
}

function shrinkCanvasForCompletedPuzzle() {
  if (!currentData) return;

  const layout = getLayoutConfig();
  const boardHeight = currentData.grid_height * cellSize;

  const completedHeight = gameOffsetY + boardHeight + 32;
  canvas.height = Math.max(window.innerHeight, completedHeight);
}

function resizeCanvas(forceRebuild = false) {
  const layout = getLayoutConfig();
  const nextMode = layout.mode;
  const nextOrientation = getOrientation();
  const nextWidth = window.innerWidth;
  const nextHeight = window.innerHeight;

  const modeChanged = nextMode !== lastLayoutMode;
  const orientationChanged = nextOrientation !== lastOrientation;

  cellSize = layout.cellSize;

  canvas.width = nextWidth;
  canvas.height = Math.max(nextHeight, canvas.height || 0);

  if (
    currentData &&
    !showWin &&
    (forceRebuild || modeChanged || orientationChanged || pieces.length === 0)
  ) {
    createPieces();
  }

  render();

  lastLayoutMode = nextMode;
  lastOrientation = nextOrientation;
}

window.addEventListener("resize", resizeCanvas);

// -----------------------------
// PUZZLE COLOR / SHAPE HELPERS
// -----------------------------
function generateShapeColors() {
  const palettes = [
    ["#FF6B6B", "#E6B800", "#43AA5C", "#3A7DDB", "#843B62", "#E97A5F", "#009E88", "#6D4CC2"],
    ["#00A896", "#7B4CC2", "#2C73D2", "#007F8C", "#3D7E78", "#4F6D7A", "#1F6F8B", "#2D9C76"],
    ["#E63946", "#E56B1F", "#D98E04", "#E07A5F", "#D9A404", "#E07A5F", "#E76F51", "#A63D2F"],
    ["#E88AB0", "#D96C9D", "#7FB7E6", "#5FA8E8", "#A07CCF", "#AAB7B7", "#E6B89C", "#E58AAE"],
    ["#606C38", "#283618", "#C68A46", "#A85A1F", "#8D6E63", "#5C6452", "#B07D62", "#9C9C88"],
    ["#E63946", "#E0A800", "#6FAF1F", "#156FB8", "#5A3E8C", "#0096D6", "#7B3FC6", "#D948A8"],
    ["#023E8A", "#0077B6", "#0096C7", "#00A8CC", "#2FA7C9", "#4FA3C4", "#6FA8C4", "#7DA7C7"],
    ["#2D6A4F", "#40916C", "#52B788", "#5FAF85", "#6FB08E", "#7FB89A", "#8DB7A0", "#1B4332"],
    ["#D96BA0", "#D9C97A", "#8FC7B5", "#5FAFD6", "#B084D6", "#D98CCF", "#9C8CF0", "#6FA8E8"],
    ["#3D5A80", "#6E9FC2", "#9FC4D6", "#D96C4D", "#293241", "#55657A", "#8E9BB0", "#C9B8A6"],
    ["#D81B78", "#A61E8C", "#6A0DAD", "#4B0A99", "#3F0A8A", "#3128A8", "#3148C9", "#3A66D9"],
    ["#B8CFC7", "#D62839", "#7FB8C9", "#3F7FA8", "#1D3557", "#C89B2B", "#D98C4A", "#D96C4A"],
    ["#1B5E20", "#2E7D32", "#43A047", "#66BB6A", "#8BC34A", "#C0CA33", "#D4AF37", "#0B3D0B"],
    ["#5A189A", "#7B2CBF", "#9D4EDD", "#2D6A4F", "#40916C", "#D4AF37", "#E6C200", "#6A994E"],
    ["#6A0DAD", "#D81B60", "#F72585", "#FF7F11", "#F4A261", "#2A9D8F", "#277DA1", "#F1C40F"],
    ["#8B0000", "#B22222", "#C62828", "#D32F2F", "#E63946", "#D4AF37", "#E6C200", "#7A1C1C"],
    ["#0B132B", "#1C2541", "#274C77", "#3A506B", "#5BC0BE", "#8DA9C4", "#B8C0D6", "#D4AF37"],
    ["#2F855A", "#48BB78", "#68D391", "#9AE6B4", "#D69E2E", "#ED8936", "#D53F8C", "#81C784"],
    ["#E76F51", "#F4A261", "#E9C46A", "#2A9D8F", "#00A8CC", "#277DA1", "#FFB703", "#FB8500"],
    ["#7F5539", "#9C6644", "#B08968", "#BC6C25", "#D4A373", "#A63D40", "#6B705C", "#CB997E"],
    ["#FF595E", "#FFCA3A", "#8AC926", "#1982C4", "#6A4C93", "#F15BB5", "#00BBF9", "#FF8FAB"],
    ["#1565C0", "#1E88E5", "#00A8CC", "#48CAE4", "#90E0EF", "#E9C46A", "#F4A261", "#2A9D8F"],
    ["#D62828", "#F77F00", "#FCBF49", "#2A9D8F", "#277DA1", "#6A4C93", "#E6399B", "#1D3557"],
    ["#D4AF37", "#C0C0C0", "#CD7F32", "#B76E79", "#A97142", "#8C8C8C", "#E5C76B", "#6E6E6E"],
    ["#C9B037", "#BFC1C2", "#B87333", "#C08081", "#A67C52", "#7A7A7A", "#D6B85A", "#9A7B4F"],
    ["#2D6A4F", "#40916C", "#52B788", "#74C69D", "#5C8D89", "#8C6A43", "#6B8E23", "#1B4332"],
    ["#1D3557", "#457B9D", "#A8DADC", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51", "#6A4C93"],
    ["#0B132B", "#1C2541", "#3A506B", "#5BC0BE", "#F4D35E", "#E63946", "#6A994E", "#BFC0C0"],
    ["#B22234", "#D62839", "#F7F7F7", "#3C6EBA", "#1D3557", "#8D99AE", "#E63946", "#457B9D"],
    ["#FF006E", "#FB5607", "#FFBE0B", "#8338EC", "#3A86FF", "#06D6A0", "#EF476F", "#118AB2"],
    ["#023E8A", "#0077B6", "#0096C7", "#00A8CC", "#2FA7C9", "#48CAE4", "#2A9D8F", "#1D3557"],
    ["#0B132B", "#1C2541", "#3A506B", "#5BC0BE", "#6A4C93", "#8338EC", "#D4AF37", "#B8C0D6"],
    ["#6B705C", "#A98467", "#CB997E", "#B56576", "#6D597A", "#457B9D", "#8D6E63", "#A44A3F"],
    ["#355070", "#6D597A", "#B56576", "#E56B6F", "#EAAC8B", "#6C9A8B", "#D4A373", "#457B9D"],
    ["#1D3557", "#D62828", "#F77F00", "#FCBF49", "#2A9D8F", "#277DA1", "#6A4C93", "#2B2D42"],
    ["#1B1B3A", "#693668", "#A74482", "#F84AA7", "#FF3562", "#F0C808", "#5BC0EB", "#2D3142"],
    ["#4E342E", "#6F4E37", "#8D6E63", "#A1887F", "#C4A484", "#7B5E57", "#5D4037", "#D7B899"],
    ["#E76F51", "#F4A261", "#E9C46A", "#8AB17D", "#7FB7E6", "#D291BC", "#F28482", "#84A59D"],
    ["#B56576", "#E56B6F", "#EAAC8B", "#6D597A", "#F4A261", "#D4A373", "#FF8FAB", "#8D99AE"],
    ["#D62828", "#F77F00", "#FCBF49", "#6A994E", "#386641", "#E9C46A", "#BC6C25", "#A7C957"],
    ["#C62828", "#E63946", "#F77F00", "#F4A261", "#E9C46A", "#6A994E", "#386641", "#8D6E63"],
    ["#6A994E", "#A7C957", "#BC6C25", "#D4A373", "#A44A3F", "#8D6E63", "#457B9D", "#E9C46A"],
    ["#1D3557", "#2B2D42", "#4A4E69", "#BC6C25", "#D62828", "#F77F00", "#FCBF49", "#8D6E63"],
    ["#2F855A", "#48BB78", "#68D391", "#9AE6B4", "#D69E2E", "#ED8936", "#D53F8C", "#81C784"],
    ["#D96C9D", "#E88AB0", "#F4A7C1", "#C77D9C", "#A3B18A", "#D4A373", "#B56576", "#7F5539"],
    ["#E63946", "#F77F00", "#FFB703", "#F4D35E", "#2A9D8F", "#43AA8B", "#6A994E", "#FB8500"],
    ["#E76F51", "#F4A261", "#E9C46A", "#D62828", "#B56576", "#6A4C93", "#355070", "#F77F00"],
    ["#0077B6", "#00A8CC", "#48CAE4", "#90E0EF", "#2A9D8F", "#F4D35E", "#FF8FAB", "#3A86FF"],
    ["#7F5539", "#9C6644", "#B08968", "#BC6C25", "#D4A373", "#A63D40", "#CB997E", "#6B705C"],
    ["#4E342E", "#6F4E37", "#8D6E63", "#A1887F", "#BC6C25", "#D4A373", "#6B705C", "#7F5539"],
    ["#274C77", "#3A506B", "#5BC0BE", "#7DA7C7", "#8DA9C4", "#B8C0D6", "#D4AF37", "#4F6D7A"],
    ["#0B132B", "#1C2541", "#3A506B", "#274C77", "#5BC0BE", "#6A4C93", "#8DA9C4", "#D4AF37"],
    ["#4F6D7A", "#577590", "#5C677D", "#7B8FA1", "#8D99AE", "#98C1D9", "#3D5A80", "#6C757D"],
    ["#2B2D42", "#4A4E69", "#5C677D", "#6C757D", "#8D99AE", "#3A506B", "#274C77", "#D4AF37"],
    ["#A44A3F", "#BC6C25", "#D4A373", "#E76F51", "#F4A261", "#E9C46A", "#C68A46", "#7F5539"],
    ["#283618", "#3A5A40", "#588157", "#6A994E", "#7FB069", "#A3B18A", "#606C38", "#344E41"],
    ["#023E8A", "#0077B6", "#0096C7", "#00A8CC", "#2A9D8F", "#43AA8B", "#4D908E", "#277DA1"],
    ["#355070", "#6D597A", "#B56576", "#E56B6F", "#EAAC8B", "#A3B18A", "#6B705C", "#457B9D"],
    ["#6D597A", "#7B5EA7", "#9D4EDD", "#B084D6", "#C77D9C", "#A06CD5", "#8E7DBE", "#5E548E"],
    ["#A44A3F", "#B56576", "#D96C9D", "#E56B8A", "#C77D9C", "#6A994E", "#386641", "#7F5539"],
    ["#BC6C25", "#D97706", "#E9A03B", "#F4A261", "#E9C46A", "#D4A373", "#B56576", "#6D597A"],
    ["#1B4332", "#2D6A4F", "#2A9D8F", "#00A8CC", "#48CAE4", "#7B2CBF", "#9D4EDD", "#355070"],
    ["#D81B78", "#A61E8C", "#6A0DAD", "#3A0CA3", "#3F37C9", "#4361EE", "#00BBF9", "#F15BB5"],
    ["#FF006E", "#FB5607", "#FFBE0B", "#8338EC", "#3A86FF", "#06D6A0", "#F72585", "#00A8CC"],
    ["#D96BA0", "#FF8FAB", "#F4A261", "#E9C46A", "#8AC926", "#5FAFD6", "#B084D6", "#E56B6F"],
    ["#5C677D", "#8E9AAF", "#C9ADA7", "#D4A373", "#B56576", "#7F5539", "#6B705C", "#355070"],
    ["#B22234", "#D62839", "#FFFFFF", "#3C3B6E", "#457B9D", "#8D99AE", "#E63946", "#1D3557"],
    ["#0055A4", "#2A6FBA", "#FFFFFF", "#D7263D", "#A8DADC", "#457B9D", "#E63946", "#1D3557"],
    ["#009246", "#2E8B57", "#FFFFFF", "#CE2B37", "#A7C957", "#D4A373", "#BC4749", "#386641"],
    ["#169B62", "#2A9D8F", "#FFFFFF", "#FF883E", "#E9C46A", "#D97706", "#6A994E", "#386641"],
    ["#000000", "#2B2D42", "#DD0000", "#D62828", "#FFCE00", "#E6B800", "#6C757D", "#F77F00"],
    ["#006847", "#2D6A4F", "#FFFFFF", "#CE1126", "#D62828", "#A7C957", "#D4A373", "#386641"],
    ["#009B3A", "#2E8B57", "#FFDF00", "#E6C200", "#002776", "#1D3557", "#43AA8B", "#457B9D"],
    ["#74ACDF", "#5FA8E8", "#FFFFFF", "#F6B40E", "#D4AF37", "#A8DADC", "#457B9D", "#E9C46A"],
    ["#0D5EAF", "#277DA1", "#FFFFFF", "#98C1D9", "#3D5A80", "#A8DADC", "#1D3557", "#5BC0EB"],
    ["#006AA7", "#277DA1", "#FECC00", "#E6B800", "#A8DADC", "#3D5A80", "#E9C46A", "#1D3557"],
    ["#0057B7", "#277DA1", "#FFD700", "#E6B800", "#A8DADC", "#E9C46A", "#3D5A80", "#F4D35E"],
    ["#FF9933", "#E67E22", "#FFFFFF", "#138808", "#2D6A4F", "#000080", "#1D3557", "#E9C46A"],
    ["#FFFFFF", "#F7F7F7", "#BC002D", "#D62839", "#8D99AE", "#E63946", "#C9ADA7", "#2B2D42"],
    ["#FFFFFF", "#F1F5F9", "#C60C30", "#005BAC", "#3D5A80", "#E63946", "#98C1D9", "#2B2D42"],
    ["#DE2910", "#D62828", "#FFDE00", "#E6B800", "#A61E1E", "#F77F00", "#6A040F", "#F4D35E"],
    ["#D80621", "#E63946", "#FFFFFF", "#F7F7F7", "#BC4749", "#8D99AE", "#A44A3F", "#D62839"],
    ["#007749", "#2D6A4F", "#FFB81C", "#E6B800", "#DE3831", "#D62828", "#002395", "#1D3557"],
    ["#AA151B", "#BC4749", "#F1BF00", "#E6B800", "#D97706", "#A44A3F", "#E9C46A", "#7F5539"],
    ["#AE1C28", "#D62839", "#FFFFFF", "#21468B", "#457B9D", "#8D99AE", "#1D3557", "#E63946"],
    ["#BA0C2F", "#D62839", "#FFFFFF", "#00205B", "#1D3557", "#457B9D", "#8D99AE", "#BC4749"]
  ];

  const palette = palettes[selectedDay % palettes.length];
  shapeColors = currentData.shapes.map((_, i) => palette[i % palette.length]);
}

function normalize(shape) {
  let minX = Math.min(...shape.map(c => c[0]));
  let minY = Math.min(...shape.map(c => c[1]));
  return shape.map(c => [c[0] - minX, c[1] - minY]);
}

function getShapeSize(shape) {
  const cells = normalize(shape);
  const maxX = Math.max(...cells.map(c => c[0]));
  const maxY = Math.max(...cells.map(c => c[1]));

  return {
    cells,
    width: (maxX + 1) * cellSize,
    height: (maxY + 1) * cellSize
  };
}

// -----------------------------
// PIECE LAYOUT
// -----------------------------
function createPieces() {
  const previousPieces = new Map(
    pieces.map(p => [
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

  pieces = [];

  const layout = getLayoutConfig();
  const boardWidth = currentData.grid_width * cellSize;
  const boardHeight = currentData.grid_height * cellSize;

  const sideMargin = layout.sideMargin;
  const trayGap = layout.trayGap;
  const spacing = layout.pieceSpacing;
  const topMargin = layout.topMargin;
  const extraBottomPadding = layout.extraBottomPadding;

  gameOffsetX = Math.floor((canvas.width - boardWidth) / 2);
  gameOffsetY = topMargin;

  if (isPhoneTrayMode()) {
    trayViewport = getPhoneTrayMetrics(boardWidth, boardHeight);
  } else {
    trayViewport = null;
    trayScrollX = 0;
    trayMaxScrollX = 0;
  }

  const bottomTrayY = boardHeight + trayGap;

  const bottomAvailableLeft = -gameOffsetX + sideMargin;
  const bottomAvailableRight = canvas.width - gameOffsetX - sideMargin;
  const bottomAvailableWidth = Math.max(0, bottomAvailableRight - bottomAvailableLeft);

  const boardCenterX = boardWidth / 2;
  const bottomTrayWidth = Math.min(bottomAvailableWidth, boardWidth + layout.bottomTrayExtraWidth);

  let bottomTrayLeft = boardCenterX - bottomTrayWidth / 2;
  bottomTrayLeft = Math.max(bottomAvailableLeft, bottomTrayLeft);

  const maxBottomTrayLeft = bottomAvailableRight - bottomTrayWidth;
  bottomTrayLeft = Math.min(bottomTrayLeft, maxBottomTrayLeft);

  const leftTrayLeft = -gameOffsetX + sideMargin;
  const leftTrayRight = -trayGap;
  const leftTrayWidth = Math.max(0, leftTrayRight - leftTrayLeft);

  const rightTrayLeft = boardWidth + trayGap;
  const rightTrayRight = canvas.width - gameOffsetX - sideMargin;
  const rightTrayWidth = Math.max(0, rightTrayRight - rightTrayLeft);

  const sideTrayHeight = boardHeight;

  let leftCursorY = 0;
  let rightCursorY = 0;

  let bottomCursorX = bottomTrayLeft;
  let bottomCursorY = bottomTrayY;
  let bottomRowHeight = 0;
  let phoneTrayCursorX = 0;

  let lowestBottomEdge = boardHeight;

  currentData.shapes.forEach((shape, i) => {
    const measured = getShapeSize(shape);
    const { cells, width, height } = measured;

    let x, y;

    if (layout.bottomTrayOnly) {
      const trayInnerY = (trayViewport.y - gameOffsetY) + (trayViewport.height - height) / 2;
      const trayStartX = (trayViewport.x - gameOffsetX) + 12;

      x = trayStartX + phoneTrayCursorX;
      y = trayInnerY;

      phoneTrayCursorX += width + spacing;
      lowestBottomEdge = Math.max(
        lowestBottomEdge,
        (trayViewport.y - gameOffsetY) + trayViewport.height
      );
    } else {
      const fitsLeft = width <= leftTrayWidth && leftCursorY + height <= sideTrayHeight;
      const fitsRight = width <= rightTrayWidth && rightCursorY + height <= sideTrayHeight;

      if (fitsLeft && (!fitsRight || leftCursorY <= rightCursorY)) {
        x = leftTrayRight - width;
        y = leftCursorY;
        leftCursorY += height + spacing;
      } else if (fitsRight) {
        x = rightTrayLeft;
        y = rightCursorY;
        rightCursorY += height + spacing;
      } else {
        if (bottomCursorX + width > bottomTrayLeft + bottomTrayWidth) {
          bottomCursorX = bottomTrayLeft;
          bottomCursorY += bottomRowHeight + spacing;
          bottomRowHeight = 0;
        }

        x = bottomCursorX;
        y = bottomCursorY;

        bottomCursorX += width + spacing;
        bottomRowHeight = Math.max(bottomRowHeight, height);
        lowestBottomEdge = Math.max(lowestBottomEdge, y + height);
      }
    }

    const label = i + 1;
    const prev = previousPieces.get(label);

    const piece = {
      cells,
      x,
      y,
      trayX: x,
      trayY: y,
      placed: false,
      gridX: 0,
      gridY: 0,
      color: shapeColors[i],
      label
    };

    if (prev) {
      piece.placed = prev.placed;
      piece.gridX = prev.gridX;
      piece.gridY = prev.gridY;

      if (prev.placed) {
        piece.x = prev.gridX * cellSize;
        piece.y = prev.gridY * cellSize;
      } else {
        piece.x = piece.trayX;
        piece.y = piece.trayY;
      }
    }

    pieces.push(piece);
    lowestBottomEdge = Math.max(lowestBottomEdge, y + height);
  });

  if (isPhoneTrayMode() && trayViewport) {
    const trayContentWidth = phoneTrayCursorX + 12;
    trayMaxScrollX = Math.max(0, trayContentWidth - trayViewport.width);
    clampTrayScroll();
  } else {
    trayMaxScrollX = 0;
  }

  const neededHeight = gameOffsetY + lowestBottomEdge + extraBottomPadding;
  canvas.height = Math.max(window.innerHeight, neededHeight);
}

// -----------------------------
// RENDERING
// -----------------------------
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function startWinSequence() {
  winAnimationActive = true;
  winAnimationProgress = 0;

  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / WIN_ANIMATION_DURATION);

    winAnimationProgress = easeOutCubic(t);
    render();

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      winAnimationActive = false;
      winAnimationProgress = 1;

      pieces = [];
      showWin = true;
	  shrinkCanvasForCompletedPuzzle();
	  updateRedoPuzzleButton();
      render();

      setTimeout(() => {
        showWinOverlay();
      }, WIN_OVERLAY_DELAY);
    }
  }

  requestAnimationFrame(step);
}

function drawWinFillOverlay() {
  if (!winAnimationActive && !showWin) return;

  const alpha = winAnimationActive ? winAnimationProgress : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#4CAF50";

  currentData.filled_cells.forEach(([x, y]) => {
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  });

  ctx.restore();
}

function drawGrid() {
  currentData.filled_cells.forEach(([x, y]) => {
    ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
  });
}

function getLabelAnchor(piece) {
  const cellCenters = piece.cells.map(([cx, cy]) => ({
    x: piece.x + cx * cellSize + cellSize / 2,
    y: piece.y + cy * cellSize + cellSize / 2
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
  if (!draggingPiece) return;

  ctx.globalAlpha = 0.4;
  ctx.fillStyle = ghostValid ? "green" : "red";

  draggingPiece.cells.forEach(cell => {
    ctx.fillRect(
      ghostGX * cellSize + cell[0] * cellSize,
      ghostGY * cellSize + cell[1] * cellSize,
      cellSize,
      cellSize
    );
  });

  ctx.globalAlpha = 1;
  ctx.fillStyle = draggingPiece.color;

  draggingPiece.cells.forEach(cell => {
    ctx.fillRect(
      draggingPiece.x + cell[0] * cellSize,
      draggingPiece.y + cell[1] * cellSize,
      cellSize,
      cellSize
    );
  });

  if (labelsEnabled) {
    drawPieceLabel(draggingPiece);
  }
}

function drawPieces() {
  if (showWin) return;

  const phoneTrayMode = isPhoneTrayMode() && trayViewport;

  if (phoneTrayMode) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.beginPath();
    ctx.roundRect(
      trayViewport.x - gameOffsetX,
      trayViewport.y - gameOffsetY,
      trayViewport.width,
      trayViewport.height,
      12
    );
    ctx.fill();
    ctx.restore();
  }

  pieces.forEach(p => {
    if (p === draggingPiece) return;

    const isTrayPiece = phoneTrayMode && !p.placed;
    const visualX = isTrayPiece ? p.x - trayScrollX : p.x;

    if (isTrayPiece) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        trayViewport.x - gameOffsetX,
        trayViewport.y - gameOffsetY,
        trayViewport.width,
        trayViewport.height
      );
      ctx.clip();
    }

    ctx.fillStyle = p.color;

    p.cells.forEach(cell => {
      ctx.fillRect(
        visualX + cell[0] * cellSize,
        p.y + cell[1] * cellSize,
        cellSize,
        cellSize
      );
    });

    if (labelsEnabled) {
      if (isTrayPiece) {
        const oldX = p.x;
        p.x = visualX;
        drawPieceLabel(p);
        p.x = oldX;
      } else {
        drawPieceLabel(p);
      }
    }

    if (isTrayPiece) {
      ctx.restore();
    }
  });

  drawDraggingPiece();
}

function render() {
  if (!currentData) return;

  const layout = getLayoutConfig();

  const boardWidth = currentData.grid_width * cellSize;
  const boardHeight = currentData.grid_height * cellSize;

  gameOffsetX = Math.floor((canvas.width - boardWidth) / 2);
  gameOffsetY = layout.topMargin;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(gameOffsetX, gameOffsetY);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 8;

  ctx.fillStyle = getCSS("--grid-bg");
  ctx.beginPath();
  ctx.roundRect(
    -10,
    -10,
    currentData.grid_width * cellSize + 20,
    currentData.grid_height * cellSize + 20,
    12
  );
  ctx.fill();
  ctx.restore();

  drawGrid();
  drawPieces();
  drawWinFillOverlay();

  ctx.restore();

  const dateStr = formatPuzzleDate(selectedDay, "long");

  ctx.fillStyle = getCSS("--text");
  ctx.textAlign = "center";

  if (layout.mode !== "phone") {
    ctx.font = layout.dateFont;
    ctx.fillText(dateStr, canvas.width / 2, gameOffsetY + layout.dateY);

    ctx.font = layout.movesFont;
    ctx.fillText(`Moves: ${moveCount}`, canvas.width / 2, gameOffsetY + layout.movesY);
  }
}

// -----------------------------
// GAME RULE HELPERS
// -----------------------------
function placePiece(piece, gx, gy) {
  piece.gridX = gx;
  piece.gridY = gy;
  piece.x = gx * cellSize;
  piece.y = gy * cellSize;
  piece.placed = true;
  moveCount++;
}

function returnPieceToTray(piece) {
  piece.placed = false;
  piece.gridX = 0;
  piece.gridY = 0;
  piece.x = piece.trayX;
  piece.y = piece.trayY;
}

function isSamePlacement(piece, gx, gy) {
  return dragStartPlaced && dragStartGridX === gx && dragStartGridY === gy;
}

function checkWin() {
  return pieces.every(p => p.placed);
}

function isFilled(x, y) {
  return currentData.filled_cells.some(c => c[0] == x && c[1] == y);
}

function canPlace(piece, gx, gy) {
  for (let cell of piece.cells) {
    let x = gx + cell[0];
    let y = gy + cell[1];

    if (!isFilled(x, y)) return false;

    for (let p of pieces) {
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
  saveCompletedPuzzleState(selectedDay, moveCount);
  clearCurrentPuzzleProgress(selectedDay);
  applyTodayPuzzleCompletionToStreak();
  updateRedoPuzzleButton();
  startWinSequence();
}

// -----------------------------
// POINTER / INPUT HELPERS
// -----------------------------
function getCanvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function toLocal(mx, my) {
  return { x: mx - gameOffsetX, y: my - gameOffsetY };
}

function startPointer(screenX, screenY) {
  if (showWin || showBeginOverlay) return false;

  const point = getCanvasPoint(screenX, screenY);
  const pos = toLocal(point.x, point.y);

  for (let p of pieces) {
    for (let cell of p.cells) {
      let x = p.x + cell[0] * cellSize;
      let y = p.y + cell[1] * cellSize;

      if (pos.x > x && pos.x < x + cellSize && pos.y > y && pos.y < y + cellSize) {
        draggingPiece = p;
        offsetX = pos.x - p.x;
        offsetY = pos.y - p.y;

        dragStartPlaced = p.placed;
        dragStartX = p.x;
        dragStartY = p.y;
        dragStartGridX = p.gridX;
        dragStartGridY = p.gridY;

        ghostValid = false;
        ghostGX = 0;
        ghostGY = 0;

        p.placed = false;
        return true;
      }
    }
  }

  return false;
}

function movePointer(screenX, screenY) {
  if (showWin || !draggingPiece) return;

  const point = getCanvasPoint(screenX, screenY);
  const pos = toLocal(point.x, point.y);

  draggingPiece.x = pos.x - offsetX;
  draggingPiece.y = pos.y - offsetY;

  ghostGX = Math.floor((draggingPiece.x + cellSize / 2) / cellSize);
  ghostGY = Math.floor((draggingPiece.y + cellSize / 2) / cellSize);

  ghostValid = canPlace(draggingPiece, ghostGX, ghostGY);

  render();
}

function restoreDraggedPiece() {
  if (!draggingPiece) return;

  if (!dragStartPlaced && isPhoneTrayMode()) {
    draggingPiece.x = draggingPiece.trayX;
    draggingPiece.y = draggingPiece.trayY;
  } else {
    draggingPiece.x = dragStartX;
    draggingPiece.y = dragStartY;
  }

  draggingPiece.gridX = dragStartGridX;
  draggingPiece.gridY = dragStartGridY;
  draggingPiece.placed = dragStartPlaced;
}

function findPieceAtScreenPoint(screenX, screenY) {
  const point = getCanvasPoint(screenX, screenY);
  const pos = toLocal(point.x, point.y);

  for (let p of pieces) {
    const isTrayPiece = isPhoneTrayMode() && !p.placed;
    const visualX = isTrayPiece ? p.x - trayScrollX : p.x;

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
  draggingPiece = piece;
  offsetX = startOffsetX;
  offsetY = startOffsetY;

  dragStartPlaced = piece.placed;
  dragStartX = (isPhoneTrayMode() && !piece.placed) ? piece.x - trayScrollX : piece.x;
  dragStartY = piece.y;
  dragStartGridX = piece.gridX;
  dragStartGridY = piece.gridY;

  ghostValid = false;
  ghostGX = 0;
  ghostGY = 0;

  piece.x = dragStartX;
  piece.placed = false;
}

function getDropTarget(piece) {
  const gridX = Math.floor((piece.x + cellSize / 2) / cellSize);
  const gridY = Math.floor((piece.y + cellSize / 2) / cellSize);

  return {
    gridX,
    gridY,
    isValid: canPlace(piece, gridX, gridY)
  };
}

function handleValidDrop(piece, gx, gy) {
  if (isSamePlacement(piece, gx, gy)) {
    restoreDraggedPiece();
    return;
  }

  placePiece(piece, gx, gy);
  saveCurrentPuzzleProgress();

  if (checkWin() && !showWin && !winAnimationActive) {
    handlePuzzleCompletion();
  }
}

function handleInvalidDrop(piece) {
  if (dragStartPlaced) {
    returnPieceToTray(piece);
    saveCurrentPuzzleProgress();
  } else {
    restoreDraggedPiece();
  }
}

function resetDragVisualState() {
  ghostValid = false;
  ghostGX = 0;
  ghostGY = 0;
}

function finishDrag() {
  resetDragVisualState();
  draggingPiece = null;
  pendingTouchPiece = null;
  render();
}

function endPointer() {
  if (showWin || !draggingPiece) return;

  const piece = draggingPiece;
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
canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mousemove", onMouseMove);
canvas.addEventListener("mouseup", onMouseUp);

canvas.addEventListener("touchstart", onTouchStart, { passive: false });
canvas.addEventListener("touchmove", onTouchMove, { passive: false });
canvas.addEventListener("touchend", onTouchEnd, { passive: false });
canvas.addEventListener("touchcancel", onTouchCancel, { passive: false });

function onMouseDown(e) {
  startPointer(e.clientX, e.clientY);
}

function onMouseMove(e) {
  movePointer(e.clientX, e.clientY);
}

function onMouseUp() {
  endPointer();
}

function onTouchStart(e) {
  if (showWin || showBeginOverlay || e.touches.length === 0) return;

  const touch = e.touches[0];
  const inTray = isPhoneTrayMode() && pointInTray(touch.clientX, touch.clientY);

  if (inTray) {
    traySwipeActive = true;
    traySwipeStartX = touch.clientX;
    traySwipeStartY = touch.clientY;
    traySwipeStartScrollX = trayScrollX;
    traySwipeTouchId = touch.identifier;
    e.preventDefault();
  }

  const hit = findPieceAtScreenPoint(touch.clientX, touch.clientY);
  if (!hit) return;

  pendingTouchPiece = hit.piece;
  pendingTouchOffsetX = hit.offsetX;
  pendingTouchOffsetY = hit.offsetY;
  pendingTouchStartClientX = touch.clientX;
  pendingTouchStartClientY = touch.clientY;
}

function onTouchMove(e) {
  if (showWin || showBeginOverlay || e.touches.length === 0) return;

  const touch = e.touches[0];
  const dxTray = touch.clientX - traySwipeStartX;
  const dyTray = touch.clientY - traySwipeStartY;
  const absTrayX = Math.abs(dxTray);
  const absTrayY = Math.abs(dyTray);

  if (isPhoneTrayMode() && traySwipeActive && !draggingPiece) {
    if (absTrayX > 6 && absTrayX > absTrayY) {
      trayScrollX = traySwipeStartScrollX - dxTray;
      clampTrayScroll();
      render();
      e.preventDefault();
      return;
    }
  }

  if (!draggingPiece && pendingTouchPiece) {
    const dx = touch.clientX - pendingTouchStartClientX;
    const dy = touch.clientY - pendingTouchStartClientY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (isPhoneTrayMode() && traySwipeActive && !pendingTouchPiece.placed) {
      if (absY > TOUCH_DRAG_THRESHOLD && absY >= absX) {
        beginDraggingPiece(
          pendingTouchPiece,
          pendingTouchOffsetX,
          pendingTouchOffsetY
        );
        traySwipeActive = false;
      }
    } else {
      const dist = Math.hypot(dx, dy);
      if (dist >= TOUCH_DRAG_THRESHOLD) {
        beginDraggingPiece(
          pendingTouchPiece,
          pendingTouchOffsetX,
          pendingTouchOffsetY
        );
      }
    }
  }

  if (draggingPiece) {
    movePointer(touch.clientX, touch.clientY);
    e.preventDefault();
  }
}

function onTouchEnd() {
  if (draggingPiece) {
    endPointer();
  }

  traySwipeActive = false;
  traySwipeTouchId = null;
  pendingTouchPiece = null;
}

function onTouchCancel() {
  traySwipeActive = false;
  traySwipeTouchId = null;
  pendingTouchPiece = null;

  if (!draggingPiece) return;

  restoreDraggedPiece();

  ghostValid = false;
  ghostGX = 0;
  ghostGY = 0;
  draggingPiece = null;
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

  selectedDay = Math.max(minIndex, Math.min(maxIndex, savedViewedDay ?? todayIndex));
  await loadPuzzle(selectedDay);
})();