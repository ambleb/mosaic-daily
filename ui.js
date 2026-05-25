// -----------------------------
// THEME / LABELS
// -----------------------------
function toggleLabels() {
  App.game.labelsEnabled = !App.game.labelsEnabled;
  localStorage.setItem(getLabelsStorageKey(), App.game.labelsEnabled ? "on" : "off");
  updateLabelsButton();
  render();
}

function applySavedLabels() {
  App.game.labelsEnabled = localStorage.getItem(getLabelsStorageKey()) === "on";
  updateLabelsButton();
}

function updateLabelsButton() {
  const btn = document.getElementById("labelsBtn");
  if (!btn) return;

  btn.textContent = "#";
  btn.classList.toggle("inactive", !App.game.labelsEnabled);
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
// OVERLAYS / UI
// -----------------------------
function openSupportOverlay() {
  document.getElementById("supportOverlay").classList.add("active");
}

function closeSupportOverlay() {
  document.getElementById("supportOverlay").classList.remove("active");
}

function openBeginOverlay() {
  if (getLayoutMode() !== "phone") return;

  const overlay = document.getElementById("beginOverlay");
  const dateEl = document.getElementById("beginDate");
  if (!overlay || !dateEl) return;

  dateEl.textContent = getSelectedPuzzleDateString();
  overlay.classList.add("active");
  App.game.showBeginOverlay = true;
}

function closeBeginOverlay() {
  const overlay = document.getElementById("beginOverlay");
  if (overlay) overlay.classList.remove("active");
  App.game.showBeginOverlay = false;
}

function showWinOverlay() {
  updateWinPreview();
  updateWinNextMessage();

  document.getElementById("winOverlay").classList.add("active");
}

function closeWinOverlay() {
  document.getElementById("winOverlay").classList.remove("active");
}

// -----------------------------
// SHARE / WIN TEXT
// -----------------------------
function updateWinPreview() {
  const dateEl = document.getElementById("winPreviewDate");
  const movesEl = document.getElementById("winPreviewMoves");
  const streakEl = document.getElementById("winPreviewStreak");
  const gridEl = document.getElementById("winPreviewGrid");

  if (!dateEl || !movesEl || !streakEl || !gridEl) return;

  const dayIndex = App.puzzle.selectedDay;
  const isToday = isTodayPuzzle(dayIndex);
  const shouldShowTodayStreak = isToday && !App.game.lastWinWasPracticeReplay;

  const hasGrid =
    App.puzzle.currentData &&
    App.puzzle.currentData.filled_cells?.length;

  dateEl.textContent = hasGrid
    ? formatPuzzleDate(dayIndex, "short")
    : `Puzzle ${dayIndex}`;

  movesEl.textContent = `Moves: ${App.game.moveCount}`;

  streakEl.textContent = `${App.streak.current} Day Streak!`;
  streakEl.classList.toggle("hidden", !shouldShowTodayStreak);

  gridEl.innerHTML = hasGrid
    ? buildShareGridText(App.puzzle.currentData.filled_cells, "<br>")
    : "";
}

function updateWinNextMessage() {
  const nextEl = document.getElementById("winNext");
  if (!nextEl) return;

  const shouldUseTodayMessage =
    isTodayPuzzle() &&
    !App.game.lastWinWasPracticeReplay;

  nextEl.textContent = shouldUseTodayMessage
    ? "Come back tomorrow for a new puzzle."
    : "Try another day from the calendar.";
}

function copyResult() {
  if (App.game.lastCompletionWasPractice) {
    const msg = document.getElementById("copyMsg");
    if (!msg) return;

    msg.textContent = "Practice scores are not shareable.";
    msg.classList.add("show");

    setTimeout(() => {
      msg.classList.remove("show");
      msg.textContent = "Copied!";
    }, 1500);

    return;
  }

  const text = getShareText();
  navigator.clipboard.writeText(text);

  const msg = document.getElementById("copyMsg");
  if (!msg) return;

  msg.textContent = "Copied!";
  msg.classList.add("show");

  setTimeout(() => {
    msg.classList.remove("show");
  }, 1500);
}

function getShareText() {
  const dayIndex = App.puzzle.selectedDay;
  const isToday = isTodayPuzzle(dayIndex);
  const shouldShowTodayStreak =
    isToday && !App.game.lastWinWasPracticeReplay;

  const dateStr = formatPuzzleDate(dayIndex, "short");
  const gridText = buildShareGridText(App.puzzle.currentData.filled_cells, "\n");

  const streakLine = shouldShowTodayStreak
    ? `${App.streak.current} Day Streak!`
    : "";

  return [
    App.constants.GAME_NAME,
    App.constants.GAME_URL,
    "",
    dateStr,
    `Moves: ${App.game.moveCount}`,
    streakLine,
    gridText
  ].filter(line => line !== "").join("\n");
}

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

function updateRedoPuzzleButton() {
  const btn = document.getElementById("redoPuzzleBtn");
  if (!btn) return;

  btn.style.display = App.game.showWin ? "block" : "none";
}