let detailsView = false; // false = overview, true = details
// bookings.js
// All user-facing text is in Norwegian. Coding and comments in English.

function getBookingsPath(date) {
  const year = date.getFullYear();
  const weekNumber = getWeekNumber(date);
  return `bookings/${year}/week-${weekNumber}.json`;
}

let weekStart = null;
let selectedDate = new Date();

/**
 * Calculates the ISO week number for a given date.
 * The ISO week starts on Monday and the first week of the year is the one that contains the first Thursday.
 *
 * @param {Date|string|number} date - The date to calculate the week number for. Can be a Date object, a date string, or a timestamp.
 * @returns {number} The ISO week number (1-53).
 */
function getWeekNumber(date) {
  // Robust ISO week number calculation (Monday as first day)
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

function formatDate(date) {
  return date.toISOString().slice(0,10);
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

function renderPage() {
  // Show/hide sections based on detailsView
  var overviewSection = document.getElementById('overview-section');
  var detailsSection = document.getElementById('details-section');
  var toggleBtn = document.getElementById('toggle-view');
  if (overviewSection && detailsSection && toggleBtn) {
    overviewSection.style.display = detailsView ? 'none' : '';
    detailsSection.style.display = detailsView ? '' : 'none';
    toggleBtn.innerText = detailsView ? 'Vis oversikt' : 'Vis detaljer';
  }
  const data = window.bookingsData;
  if (!data) return;
  const weekday = selectedDate.toLocaleDateString('no-NO', { weekday: 'long' });
  const dateStrDisplay = selectedDate.toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateStr = formatDate(selectedDate); // ISO format for filtering
  document.getElementById('selected-date').innerText = `${weekday} ${dateStrDisplay}`;

  // Assign a color per building (move to top so both sections use it)
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

  // Overview: show first occupied time and last available time
  let overviewHtml = '<div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center;">';
  data.buildings.forEach((building, bIdx) => {
    const color = buildingColors[bIdx % buildingColors.length];
    // Gather all bookings for all rooms in this building for the selected date
    let allBookings = [];
    building.rooms.forEach(room => {
      const bookings = room.bookings.filter(b => b.start.startsWith(dateStr) && b.id);
      allBookings = allBookings.concat(bookings);
    });
    let boxHtml = `<div style="background:${color};color:#fff;padding:18px 12px;border-radius:10px;min-width:180px;flex:1 1 180px;max-width:220px;box-shadow:0 2px 8px #0002;display:flex;flex-direction:column;align-items:center;">`;
    boxHtml += `<div style="font-size:1.1em;font-weight:bold;margin-bottom:8px;">${building.buildingName}</div>`;
    if (allBookings.length > 0) {
      const sorted = allBookings.sort((a,b) => new Date(a.start) - new Date(b.start));
      const firstOccupied = sorted[0];
      const lastOccupied = sorted[sorted.length-1];
      boxHtml += `<div>Første: <span style="font-weight:bold;">${firstOccupied.start.slice(11,16)}</span></div>`;
      boxHtml += `<div>Siste: <span style="font-weight:bold;">${lastOccupied.end.slice(11,16)}</span></div>`;
    } else {
      boxHtml += `<div style="margin-top:8px;">Ledig hele dagen</div>`;
    }
    boxHtml += '</div>';
    overviewHtml += boxHtml;
  });
  overviewHtml += '</div>';
  document.getElementById('overview').innerHTML = overviewHtml;

  // Details: graphical timeline for each room, 07:00-22:00
  let detailsHtml = '';
  data.buildings.forEach((building, bIdx) => {
    const color = buildingColors[bIdx % buildingColors.length];
    building.rooms.forEach(room => {
      const bookings = room.bookings.filter(b => b.start.startsWith(dateStr) && b.id);
      // Timeline logic
      const timelineStart = 7; // 07:00
      const timelineEnd = 22; // 22:00
      const timelineWidth = 100; // percent width for responsive design
      let blocks = [];
      // Build occupied blocks
      const minGap = 1/60; // 1 minute gap between bookings
      let lastEnd = null;
      bookings.forEach(b => {
        const startHour = parseInt(b.start.slice(11,13), 10);
        const startMin = parseInt(b.start.slice(14,16), 10);
        const endHour = parseInt(b.end.slice(11,13), 10);
        const endMin = parseInt(b.end.slice(14,16), 10);
        let start = Math.max(timelineStart, startHour + startMin/60);
        let end = Math.min(timelineEnd, endHour + endMin/60);
        if (lastEnd !== null && start < lastEnd + minGap) {
          start = lastEnd + minGap;
        }
        if (end > start) {
          blocks.push({
            start,
            end,
            title: b.title || '',
            info: `${b.start.slice(11,16)} - ${b.end.slice(11,16)}`,
            renterName: b.renterName || ''
          });
          lastEnd = end;
        }
      });
      // Build timeline HTML
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
        timelineLabels += `<span style="${style}">${h.toString().padStart(2,'0')}</span>`;
      }
      timelineLabels += '</div>';
      let timelineHtml = timelineLabels;
      timelineHtml += `<div class="timeline" style="position:relative;width:100%;height:32px;background:#fff;border:1px solid #ccc;border-radius:6px;margin-bottom:8px;">`;
      // No vertical 15-min lines
      // Add occupied blocks with mouse-over tooltip
      blocks.forEach(block => {
        const left = ((block.start - timelineStart) / (timelineEnd - timelineStart)) * 100;
        const width = ((block.end - block.start) / (timelineEnd - timelineStart)) * 100;
        let tooltip = `Fra: ${block.info.split(' - ')[0]}\nTil: ${block.info.split(' - ')[1]}`;
        if (block.title) tooltip += `\n${block.title}`;
        if (block.renterName) tooltip += `\nLeietaker: ${block.renterName}`;
        timelineHtml += `<div class=\"timeline-block\" style=\"position:absolute;left:${left}%;width:${width}%;height:32px;background:${color};border-radius:6px;z-index:2;\" title=\"${tooltip}\"></div>`;
      });
      timelineHtml += `</div>`;
      // Room label and timeline only
  detailsHtml += `<div class=\"booking\"><span class=\"room\" style=\"color:${color};font-weight:bold;\">${room.roomName}</span><br>${timelineHtml}</div>`;
    });
  });
  document.getElementById('details').innerHTML = detailsHtml || 'Ingen bookinger.';
}

function changeDate(offset) {
  // Use weekStart and weekEnd from loaded data for navigation boundaries
    // Use weekStart and weekEnd from loaded data for navigation boundaries
    const data = window.bookingsData;
    if (!data) return;
    // Compare only date part (YYYY-MM-DD)
    function toDateOnly(d) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    const currentWeekStart = toDateOnly(new Date(data.weekStart));
    const currentWeekEnd = toDateOnly(new Date(data.weekEnd));
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + offset);
    const newDateOnly = toDateOnly(newDate);
    // Restrict navigation to current week only (inclusive)
    if (newDateOnly >= currentWeekStart && newDateOnly <= currentWeekEnd) {
      selectedDate = newDate;
      renderPage();
    }
}

document.addEventListener('DOMContentLoaded', () => {
  selectedDate = new Date();
  loadBookings();
  document.getElementById('prev-day').onclick = () => changeDate(-1);
  document.getElementById('next-day').onclick = () => changeDate(1);
  document.getElementById('toggle-view').onclick = () => {
    detailsView = !detailsView;
    renderPage();
  };
});
