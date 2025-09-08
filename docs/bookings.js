// bookings.js
// All user-facing text is in Norwegian. Coding and comments in English.

function getBookingsPath(date) {
  const year = date.getFullYear();
  const weekNumber = getWeekNumber(date);
  return `bookings/${year}/week-${weekNumber}.json`;
}
const weekStart = getWeekStart(new Date());
let selectedDate = new Date();

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday as start
  d.setHours(0,0,0,0);
  return d;
}

function getWeekNumber(date) {
  // ISO week number, Monday as first day
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

function formatDate(date) {
  return date.toISOString().slice(0,10);
}

function loadBookings(weekStartStr) {
  fetch(getBookingsPath(new Date(weekStartStr)))
    .then(res => res.json())
    .then(data => {
      window.bookingsData = data;
      renderPage();
    })
    .catch(() => {
      document.getElementById('overview').innerText = 'Ingen bookingdata funnet.';
      document.getElementById('details').innerText = '';
    });
}

function renderPage() {
  const data = window.bookingsData;
  if (!data) return;
  const dateStr = formatDate(selectedDate);
  document.getElementById('selected-date').innerText = dateStr;

  // Overview: show first occupied time and last available time
  let overviewHtml = '';
  data.buildings.forEach(building => {
    building.rooms.forEach(room => {
      const bookings = room.bookings.filter(b => b.start.startsWith(dateStr));
      // Only consider bookings with id (occupied)
      const occupiedBookings = bookings.filter(b => b.id);
      if (occupiedBookings.length > 0) {
        const sorted = occupiedBookings.sort((a,b) => new Date(a.start) - new Date(b.start));
        const firstOccupied = sorted[0];
        const lastOccupied = sorted[sorted.length-1];
        overviewHtml += `<div><strong>${building.buildingName} - ${room.roomName}</strong>: ${firstOccupied.start.slice(11,16)} - ${lastOccupied.end.slice(11,16)}</div>`;
      } else {
        overviewHtml += `<div><strong>${building.buildingName} - ${room.roomName}</strong>: Ledig hele dagen</div>`;
      }
    });
  });
  document.getElementById('overview').innerHTML = overviewHtml;

  // Details: graphical timeline for each room, 07:00-22:00
  let detailsHtml = '';
  data.buildings.forEach(building => {
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
        const start = Math.max(timelineStart, startHour + startMin/60);
        const end = Math.min(timelineEnd, endHour + endMin/60);
        if (end > start) {
          blocks.push({start, end, title: b.title || '', info: `${b.start.slice(11,16)} - ${b.end.slice(11,16)}`});
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
        const tooltip = `Fra: ${block.info.split(' - ')[0]}\nTil: ${block.info.split(' - ')[1]}\n${block.title}`;
        timelineHtml += `<div class="timeline-block" style="position:absolute;left:${left}%;width:${width}%;height:32px;background:#e74c3c;border-radius:6px;z-index:2;" title="${tooltip}"></div>`;
      });
      timelineHtml += `</div>`;
      // Room label and timeline only
      detailsHtml += `<div class="booking"><span class="room">${building.buildingName} - ${room.roomName}</span><br>${timelineHtml}</div>`;
    });
  });
  document.getElementById('details').innerHTML = detailsHtml || 'Ingen bookinger.';
}

function changeDate(offset) {
  const currentWeekStart = getWeekStart(new Date());
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
  const newDate = new Date(selectedDate);
  newDate.setDate(newDate.getDate() + offset);
  // Restrict navigation to current week only
  if (newDate >= currentWeekStart && newDate <= currentWeekEnd) {
    selectedDate = newDate;
    renderPage();
  }
}

document.getElementById('prev-day').onclick = () => changeDate(-1);
document.getElementById('next-day').onclick = () => changeDate(1);

document.addEventListener('DOMContentLoaded', () => {
  selectedDate = new Date();
  loadBookings(formatDate(weekStart));
});
