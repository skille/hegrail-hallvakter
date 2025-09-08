// bookings.js
// All user-facing text is in Norwegian. Coding and comments in English.

const bookingsFolder = '../data/bookings/';
const weekStart = getWeekStart(new Date());
let selectedDate = new Date();

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday as start
  d.setHours(0,0,0,0);
  return d;
}

function formatDate(date) {
  return date.toISOString().slice(0,10);
}

function loadBookings(weekStartStr) {
  fetch(`${bookingsFolder}${weekStartStr}.json`)
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

  // Overview: first/last booking for all buildings/rooms
  let overviewHtml = '';
  data.buildings.forEach(building => {
    building.rooms.forEach(room => {
      // Filter bookings for selected date
      const bookings = room.bookings.filter(b => b.start.startsWith(dateStr));
      if (bookings.length > 0) {
        const sorted = bookings.sort((a,b) => new Date(a.start) - new Date(b.start));
        const first = sorted[0];
        const last = sorted[sorted.length-1];
        overviewHtml += `<div><strong>${building.buildingName} - ${room.roomName}</strong>: ${first.start.slice(11,16)} - ${last.end.slice(11,16)}</div>`;
      } else {
        overviewHtml += `<div><strong>${building.buildingName} - ${room.roomName}</strong>: Ikke utleid</div>`;
      }
    });
  });
  document.getElementById('overview').innerHTML = overviewHtml;

  // Details: all bookings for selected date
  let detailsHtml = '';
  data.buildings.forEach(building => {
    building.rooms.forEach(room => {
      const bookings = room.bookings.filter(b => b.start.startsWith(dateStr));
      bookings.forEach(b => {
        detailsHtml += `<div class="booking"><span class="room">${building.buildingName} - ${room.roomName}</span><br><span class="time">${b.start.slice(11,16)} - ${b.end.slice(11,16)}</span><br>${b.title || ''}</div>`;
      });
    });
  });
  document.getElementById('details').innerHTML = detailsHtml || 'Ingen bookinger.';
}

function changeDate(offset) {
  selectedDate.setDate(selectedDate.getDate() + offset);
  renderPage();
}

document.getElementById('prev-day').onclick = () => changeDate(-1);
document.getElementById('next-day').onclick = () => changeDate(1);

document.addEventListener('DOMContentLoaded', () => {
  selectedDate = new Date();
  loadBookings(formatDate(weekStart));
});
