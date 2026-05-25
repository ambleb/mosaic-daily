// -----------------------------
// CALENDAR
// -----------------------------
function toggleCalendar() {
  document.getElementById("calendar").classList.toggle("hidden");
}

function changeMonth(delta) {
  const todayIndex = getDailyIndex();
  const todayDate = getPuzzleDateLocal(todayIndex);

  const currentView = new Date(todayDate);
  currentView.setMonth(currentView.getMonth() + App.calendar.calendarOffset);

  const nextView = new Date(currentView);
  nextView.setMonth(nextView.getMonth() + delta);

  const minMonth = new Date(
    App.constants.CALENDAR_START_DATE.getFullYear(),
    App.constants.CALENDAR_START_DATE.getMonth(),
    1
  );

  const lastPuzzleIndex = Math.min(getDailyIndex(), getLastAvailablePuzzleIndex());

  const maxMonthDate = getPuzzleDateLocal(lastPuzzleIndex);

  const maxMonth = new Date(maxMonthDate.getFullYear(), maxMonthDate.getMonth(), 1);
  const nextMonthOnly = new Date(nextView.getFullYear(), nextView.getMonth(), 1);

  if (nextMonthOnly < minMonth) return;
  if (nextMonthOnly > maxMonth) return;

  App.calendar.calendarOffset += delta;
  buildCalendar();
}

async function goToToday() {
  const todayIndex = getDailyIndex();
  const playableIndex = Math.min(todayIndex, getLastAvailablePuzzleIndex());

  App.calendar.calendarOffset = 0;
  await loadPuzzle(playableIndex);
  buildCalendar();
  toggleCalendar();
}

function buildCalendar() {
  const { title, grid } = getCalendarElements();
  if (!title || !grid) return;

  const state = getCalendarState();

  clearCalendarGrid(grid);
  updateCalendarTitle(title, state);
  appendCalendarWeekdays(grid);
  appendCalendarLeadingBlanks(grid, state.startWeekday);
  appendCalendarDays(grid, state);
}

function getCalendarElements() {
  return {
    title: document.getElementById("calendar-title"),
    grid: document.getElementById("calendar-grid")
  };
}

function getCalendarState() {
  const todayIndex = getDailyIndex();
  const minIndex = getCalendarStartIndex();
  const maxPuzzleIndex = getLastAvailablePuzzleIndex();

  const baseDate = getPuzzleDateLocal(todayIndex);
  baseDate.setMonth(baseDate.getMonth() + App.calendar.calendarOffset);

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return {
    todayIndex,
    minIndex,
    maxPuzzleIndex,
    baseDate,
    year,
    month,
    startWeekday,
    daysInMonth
  };
}

function clearCalendarGrid(grid) {
  grid.innerHTML = "";
}

function updateCalendarTitle(title, state) {
  title.textContent = state.baseDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
}

function appendCalendarWeekdays(grid) {
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  weekdays.forEach(day => {
    const el = document.createElement("div");
    el.textContent = day;
    el.className = "calendar-weekday";
    grid.appendChild(el);
  });
}

function appendCalendarLeadingBlanks(grid, count) {
  for (let i = 0; i < count; i++) {
    grid.appendChild(document.createElement("div"));
  }
}

function appendCalendarDays(grid, state) {
  for (let dayNumber = 1; dayNumber <= state.daysInMonth; dayNumber++) {
    const dayEl = createCalendarDayElement(dayNumber, state);
    grid.appendChild(dayEl);
  }
}

function createCalendarDayElement(dayNumber, state) {
  const date = new Date(state.year, state.month, dayNumber);
  const dayIndex = getDayIndexFromDate(date);

  const dayEl = document.createElement("div");
  dayEl.className = "calendar-day";
  dayEl.textContent = dayNumber;

  applyCalendarDayClasses(dayEl, dayIndex, state);
  attachCalendarDayClick(dayEl, dayIndex, state);

  return dayEl;
}

function applyCalendarDayClasses(dayEl, dayIndex, state) {
  if (dayIndex >= state.minIndex && isCompleted(dayIndex)) {
    dayEl.classList.add("completed");
  }

  if (dayIndex === state.todayIndex) {
    dayEl.classList.add("today");
  }

  if (dayIndex === App.puzzle.selectedDay) {
    dayEl.classList.add("selected");
  }

  if (!isCalendarDayPlayable(dayIndex, state)) {
    dayEl.classList.add("disabled");
  }
}

function attachCalendarDayClick(dayEl, dayIndex, state) {
  if (!isCalendarDayPlayable(dayIndex, state)) return;

  dayEl.onclick = () => {
    loadPuzzle(dayIndex);
    toggleCalendar();
  };
}

function isCalendarDayPlayable(dayIndex, state) {
  return (
    dayIndex >= state.minIndex &&
    dayIndex <= state.todayIndex &&
    dayIndex <= state.maxPuzzleIndex
  );
}