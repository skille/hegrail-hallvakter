function formatTime(dateStr) {
  // Accepts ISO string, returns HH:mm in 24-hour format
  return new Date(dateStr).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', hour12: false });
}
// bookings.js
// All user-facing text is in Norwegian. Coding and comments in English.

function getBookingsPath(date) {
  const year = date.getFullYear();
  const weekNumber = getWeekNumber(date);
  return `bookings/${year}/week-${weekNumber}.json`;
}

let weekStart = null;
let selectedDate = new Date();
let filteredBuildingIdxs = []; // array of selected building indices
let userClearedFilter = false;

/**
 * Calculates the ISO week number for a given date.
 * The ISO week starts on Monday and the first week of the year is the one that contains the first Thursday.
*/
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function loadBookings(weekStartStr) {
  // Load using selectedDate, but weekStart will be set from JSON
  fetch(getBookingsPath(selectedDate))
    .then(res => res.json())
    .then(data => {
      window.bookingsData = data;
      weekStart = new Date(data.weekStart);
      renderPage();
    })
    .catch(() => {
      document.getElementById('overview').innerText = 'Ingen bookingdata funnet.';
      document.getElementById('details').innerText = '';
    });
}


const buildingColors = [
  '#e74c3c', // rød
  '#3498db', // blå
  '#27ae60', // grønn
  '#f1c40f', // gul
  '#9b59b6', // lilla
  '#e67e22', // oransje
  '#1abc9c', // turkis
  '#34495e', // mørk blå
  '#95a5a6', // grå
  '#2ecc71'  // lys grønn
];

function renderPage() {
  showHideSections();
  const data = window.bookingsData;
  if (!data) return;
  const weekday = selectedDate.toLocaleDateString('no-NO', { weekday: 'long' });
  const dateStrDisplay = selectedDate.toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateStr = formatDate(selectedDate); // ISO format for filtering
  // Only preselect buildings with bookings if filter is empty AND user did not clear filter AND not previously cleared for this date
  if (filteredBuildingIdxs.length === 0 && !userClearedFilter) {
    filteredBuildingIdxs = getBuildingsWithBookings(data, dateStr);
  }
  const hasAnyBooking = filteredBuildingIdxs.length > 0;
  document.getElementById('selected-date').innerText = `${weekday} ${dateStrDisplay}`;
  document.getElementById('overview').innerHTML = renderOverview(data, dateStr);
  document.getElementById('details').innerHTML = hasAnyBooking ? renderDetails(data, dateStr, filteredBuildingIdxs) : '';
}

function showHideSections() {
  var overviewSection = document.getElementById('overview-section');
  var detailsSection = document.getElementById('details-section');
  // Always show both sections
  if (overviewSection && detailsSection) {
    overviewSection.style.display = '';
    detailsSection.style.display = '';
  }
}

function renderOverview(data, dateStr) {
  let overviewHtml = '<div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center;">';
  data.buildings.forEach((building, bIdx) => {
    const color = buildingColors[bIdx % buildingColors.length];
    let allBookings = [];
    building.rooms.forEach(room => {
      const bookings = room.bookings.filter(b => b.start.startsWith(dateStr) && b.id);
      allBookings = allBookings.concat(bookings);
    });
    overviewHtml += renderOverviewBox(building, allBookings, color, bIdx);
  });
  overviewHtml += '</div>';
  return overviewHtml;
}

function renderOverviewBox(building, allBookings, color, bIdx) {
  const isSelected = filteredBuildingIdxs.includes(bIdx);
  let boxHtml = `<div style="background:${isSelected ? color : '#f7f7f7'};color:${isSelected ? '#fff' : '#888'};padding:18px 12px;border-radius:10px;min-width:180px;flex:1 1 180px;max-width:220px;box-shadow:0 2px 8px #0002;display:flex;flex-direction:column;align-items:center;cursor:pointer;${isSelected ? 'outline: 4px solid #222; outline-offset: 2px; box-shadow:0 0 0 6px #fff, 0 2px 8px #0002;' : ''}" onclick="toggleBuildingFilter(${bIdx})">`;
  boxHtml += `<div style="font-size:1.1em;font-weight:bold;margin-bottom:8px;">${building.buildingName}</div>`;
  if (allBookings.length > 0) {
    const sorted = allBookings.sort((a, b) => new Date(a.start) - new Date(b.start));
    const firstOccupied = sorted[0];
    const lastOccupied = sorted[sorted.length - 1];
    boxHtml += `<div style=\"font-size:1.2em;font-weight:bold;\">${formatTime(firstOccupied.start)} - ${formatTime(lastOccupied.end)}</div>`;
  } else {
    boxHtml += `<div style="margin-top:8px;">Ledig hele dagen</div>`;
  }
  boxHtml += '</div>';
  return boxHtml;
}

function renderDetails(data, dateStr, buildingIdxs) {
  let detailsHtml = '';
  data.buildings.forEach((building, bIdx) => {
    if (buildingIdxs.length > 0 && !buildingIdxs.includes(bIdx)) return;
    const color = buildingColors[bIdx % buildingColors.length];
    building.rooms.forEach(room => {
      const bookings = room.bookings.filter(b => b.start.startsWith(dateStr) && b.id);
      detailsHtml += renderRoomTimeline(room, bookings, color);
    });
  });
  return detailsHtml;
}

function renderRoomTimeline(room, bookings, color) {
  const timelineStart = 8; // 08:00
  const timelineEnd = 22; // 22:00
  const blocks = getTimelineBlocks(bookings, timelineStart, timelineEnd);
  const timelineLabels = buildTimelineLabels(timelineStart, timelineEnd);
  let timelineHtml = timelineLabels;
  timelineHtml += `<div class="timeline" style="position:relative;width:100%;height:32px;background:#fff;border:1px solid #ccc;border-radius:6px;margin-bottom:8px;">`;
  blocks.forEach(block => {
    const left = ((block.start - timelineStart) / (timelineEnd - timelineStart)) * 100;
    const width = ((block.end - block.start) / (timelineEnd - timelineStart)) * 100;
    let tooltip = `Fra: ${block.info.split(' - ')[0]}\nTil: ${block.info.split(' - ')[1]}`;
    if (block.title) tooltip += `\n${block.title}`;
    if (block.renterName) tooltip += `\nLeietaker: ${block.renterName}`;
    timelineHtml += `<div class=\"timeline-block\" style=\"position:absolute;left:${left}%;width:${width}%;height:32px;background:${color};border-radius:6px;z-index:2;\" title=\"${tooltip}\"></div>`;
  });
  timelineHtml += `</div>`;
  return `<div class=\"booking\"><span class=\"room\" style=\"color:${color};font-weight:bold;\">${room.roomName}</span><br>${timelineHtml}</div>`;
}

function getTimelineBlocks(bookings, timelineStart, timelineEnd) {
  const minGap = 3 / 60; // 3 minute gap between bookings
  let lastEnd = null;
  let blocks = [];
  bookings.forEach(b => {
    const startHour = parseInt(b.start.slice(11, 13), 10);
    const startMin = parseInt(b.start.slice(14, 16), 10);
    const endHour = parseInt(b.end.slice(11, 13), 10);
    const endMin = parseInt(b.end.slice(14, 16), 10);
    let start = Math.max(timelineStart, startHour + startMin / 60);
    let end = Math.min(timelineEnd, endHour + endMin / 60);
    if (lastEnd !== null && start < lastEnd + minGap) {
      start = lastEnd + minGap;
    }
    if (end > start) {
      blocks.push({
        start,
        end,
        title: b.title || '',
        info: `${formatTime(b.start)} - ${formatTime(b.end)}`,
        renterName: b.renterName || ''
      });
      lastEnd = end;
    }
  });
  return blocks;
}

function buildTimelineLabels(timelineStart, timelineEnd) {
  let timelineLabels = '<div class="timeline-labels" style="position:relative;width:100%;margin-bottom:18px;">';
  for (let h = timelineStart; h <= timelineEnd; h++) {
    let style = '';
    if (h === timelineStart) {
      style = `position:absolute;left:0;font-size:0.8em;text-align:left;`;
    } else if (h === timelineEnd) {
      style = `position:absolute;right:0;font-size:0.8em;text-align:right;`;
    } else {
      const left = ((h - timelineStart) / (timelineEnd - timelineStart)) * 100;
      style = `position:absolute;left:${left}%;transform:translateX(-50%);font-size:0.8em;`;
    }
    timelineLabels += `<span style="${style}">${h.toString().padStart(2, '0')}</span>`;
  }
  timelineLabels += '</div>';
  return timelineLabels;
}

function changeDate(offset) {
  const data = window.bookingsData;
  if (!data) return;
  function toDateOnly(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const currentWeekStart = toDateOnly(new Date(data.weekStart));
  const currentWeekEnd = toDateOnly(new Date(data.weekEnd));
  const newDate = new Date(selectedDate);
  newDate.setDate(newDate.getDate() + offset);
  const newDateOnly = toDateOnly(newDate);
  if (newDateOnly >= currentWeekStart && newDateOnly <= currentWeekEnd) {
    selectedDate = newDate;
  // Reset userClearedFilter on date change
  userClearedFilter = false;
  // Always preselect buildings with bookings for new date
  const dateStr = formatDate(selectedDate);
  filteredBuildingIdxs = getBuildingsWithBookings(window.bookingsData, dateStr);
  renderPage();
  }
}

function toggleBuildingFilter(bIdx) {
  const idx = filteredBuildingIdxs.indexOf(bIdx);
  if (idx === -1) {
    filteredBuildingIdxs.push(bIdx);
  } else {
    filteredBuildingIdxs.splice(idx, 1);
    // If user manually deselects all buildings, set userClearedFilter
    if (filteredBuildingIdxs.length === 0) {
      userClearedFilter = true;
    }
  }
  renderPage();
}

function clearFilter() {
  if (filteredBuildingIdxs.length > 0) {
    filteredBuildingIdxs = [];
    userClearedFilter = true;
    renderPage();
  }
}

function getBuildingsWithBookings(data, dateStr) {
  let indices = [];
  data.buildings.forEach((building, bIdx) => {
    let hasBooking = false;
    building.rooms.forEach(room => {
      if (room.bookings.some(b => b.start.startsWith(dateStr) && b.id)) {
        hasBooking = true;
      }
    });
    if (hasBooking) indices.push(bIdx);
  });
  return indices;
}

document.addEventListener('DOMContentLoaded', () => {
  selectedDate = new Date();
  loadBookings();
  document.getElementById('prev-day').onclick = () => changeDate(-1);
  document.getElementById('next-day').onclick = () => changeDate(1);
});
