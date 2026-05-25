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

function getDailyIndex() {
  return getDayIndexFromDate(new Date());
}

function getPuzzleDateLocal(dayIndex) {
  const d = new Date(App.constants.PUZZLE_EPOCH_DATE);
  d.setDate(App.constants.PUZZLE_EPOCH_DATE.getDate() + dayIndex);
  return d;
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

function getCalendarStartIndex() {
  return getDayIndexFromDate(App.constants.CALENDAR_START_DATE);
}

function getLastAvailablePuzzleIndex() {
  return getCalendarStartIndex() + puzzleFiles.length - 1;
}

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

function getPuzzleDate(dayIndex) {
  return new Date(Date.UTC(2024, 0, 1 + dayIndex));
}

function getDateKey(dayIndex) {
  return formatLocalDateKey(getPuzzleDate(dayIndex));
}