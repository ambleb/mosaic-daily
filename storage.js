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
  if (!App.puzzle.currentData || App.game.showWin) return;

  const key = getProgressKey(App.puzzle.selectedDay);

  const placedPieces = App.pieces.list
    .filter(p => p.placed)
    .map(p => ({
      label: p.label,
      gridX: p.gridX,
      gridY: p.gridY
    }));

  localStorage.setItem(
    key,
    JSON.stringify({
      moves: App.game.moveCount,
      placedPieces
    })
  );
}

function clearCurrentPuzzleProgress(dayIndex = App.puzzle.selectedDay) {
  localStorage.removeItem(getProgressKey(dayIndex));
}

function applySavedPuzzleProgress(dayIndex) {
  const raw = localStorage.getItem(getProgressKey(dayIndex));
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);
    const placedMap = new Map((data.placedPieces || []).map(p => [p.label, p]));

    App.game.moveCount = Number.isInteger(data.moves) ? data.moves : 0;

    App.pieces.list.forEach(piece => {
      const saved = placedMap.get(piece.label);

      if (saved) {
        piece.placed = true;
        piece.gridX = saved.gridX;
        piece.gridY = saved.gridY;
        piece.x = saved.gridX * App.layout.cellSize;
        piece.y = saved.gridY * App.layout.cellSize;
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
  App.streak.current = parseInt(localStorage.getItem(getStreakCurrentStorageKey())) || 0;
  App.streak.best = parseInt(localStorage.getItem(getStreakBestStorageKey())) || 0;
  App.streak.lastCompletedDate = localStorage.getItem(getLastCompletedDateStorageKey());

  updateStreakDisplay();
}

function applyTodayPuzzleCompletionToStreak() {
  const realTodayKey = getTodayKey();
  const realYesterdayKey = getYesterdayKey();
  const todayPuzzleIndex = getDailyIndex();

  if (App.puzzle.selectedDay !== todayPuzzleIndex) return;

  if (App.streak.lastCompletedDate === realTodayKey) {
    return;
  } else if (App.streak.lastCompletedDate === realYesterdayKey) {
    App.streak.current++;
  } else {
    App.streak.current = 1;
  }

  if (App.streak.current > App.streak.best) {
    App.streak.best = App.streak.current;
  }

  App.streak.lastCompletedDate = realTodayKey;

  localStorage.setItem(getStreakCurrentStorageKey(), App.streak.current);
  localStorage.setItem(getStreakBestStorageKey(), App.streak.best);
  localStorage.setItem(getLastCompletedDateStorageKey(), App.streak.lastCompletedDate);

  updateStreakDisplay();
}
