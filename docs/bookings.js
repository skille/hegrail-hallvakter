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

// Format a Date for an <input type="date"> value in local time
function formatDateInputLocal(date) {
  const tzOff = date.getTimezoneOffset();
  const local = new Date(date.getTime() - tzOff * 60000);
  return local.toISOString().slice(0, 10);
}

let datePickerEl = null;

function ensureDatePicker() {
  if (!datePickerEl) {
    datePickerEl = document.createElement('input');
    datePickerEl.type = 'date';
    datePickerEl.style.position = 'fixed';
    datePickerEl.style.opacity = '0';
    datePickerEl.style.pointerEvents = 'none';
    datePickerEl.tabIndex = -1;
    datePickerEl.addEventListener('change', () => {
      if (!datePickerEl.value) return;
      // Parse picked date (use noon to avoid TZ shifts)
      const picked = new Date(datePickerEl.value + 'T12:00:00');
      // Update selectedDate and either render or load a new week file
      const data = window.bookingsData;
      selectedDate = picked;
      if (!data) {
        loadBookings(selectedDate);
        return;
      }
      const toDateOnly = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const currentWeekStart = toDateOnly(new Date(data.weekStart));
      const currentWeekEnd = toDateOnly(new Date(data.weekEnd));
      const newDateOnly = toDateOnly(picked);
      if (newDateOnly < currentWeekStart || newDateOnly > currentWeekEnd) {
        filteredBuildingIdxs = [];
        userClearedFilter = false;
        loadBookings(selectedDate);
      } else {
        userClearedFilter = false;
        const dateStr = formatDate(selectedDate);
        filteredBuildingIdxs = getBuildingsWithBookings(window.bookingsData, dateStr);
        renderPage();
      }
    });
    document.body.appendChild(datePickerEl);
  }
  return datePickerEl;
}

function openDatePicker() {
  const input = ensureDatePicker();
  input.value = formatDateInputLocal(selectedDate);
  // Place the input near the selected date element so the picker opens around user's focus
  const anchor = document.getElementById('selected-date');
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    input.style.left = rect.left + 'px';
    input.style.top = (rect.bottom + 4) + 'px';
  }
  // Temporarily enable pointer events and focus, then open picker on next frame for stable layout
  input.style.pointerEvents = 'auto';
  input.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); } catch (_) { input.click(); }
    } else {
      input.click();
    }
    // Restore invisibility behavior
    setTimeout(() => { input.style.pointerEvents = 'none'; }, 0);
  });
}

function loadBookings(dateForWeek = null) {
  // Load bookings for the week that contains the given date (or current selectedDate)
  const date = dateForWeek ? new Date(dateForWeek) : selectedDate;
  fetch(getBookingsPath(date))
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      window.bookingsData = data;
      weekStart = new Date(data.weekStart);
      // Do not reset selectedDate; keep user's chosen day
      // Update booking overview description with current week number
      const bookingOverviewDescElem = document.getElementById('booking-overview-desc');
      if (bookingOverviewDescElem && weekStart) {
        const weekNumber = getWeekNumber(weekStart);
        bookingOverviewDescElem.innerText = `Uke ${weekNumber}`;
      }
      renderPage();
    })
    .catch(() => {
      const ov = document.getElementById('overview');
      const dt = selectedDate.toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' });
      // Keep the header date in sync with the selected target date even if loading fails
      const selectedDateLabel = document.getElementById('selected-date');
      if (selectedDateLabel) {
        const weekday = selectedDate.toLocaleDateString('no-NO', { weekday: 'long' });
        selectedDateLabel.innerText = `${weekday} ${dt}`;
      }
      const bookingOverviewDescElem = document.getElementById('booking-overview-desc');
      if (bookingOverviewDescElem) {
        const weekNumber = getWeekNumber(selectedDate);
        bookingOverviewDescElem.innerText = `Uke ${weekNumber}`;
      }
      ov.innerHTML = `
        <div style="background:#fff;border:1px solid #eee;border-radius:10px;padding:16px;box-shadow:0 2px 8px #0001;max-width:720px;margin:0 auto;text-align:center;color:#555;">
          <h3 style="margin:0 0 8px 0;color:#2c3e50;">Ingen bookingdata funnet</h3>
          <p style="margin:6px 0;">Det finnes ingen data for valgt dato: <strong>${dt}</strong>.</p>
          <p style="margin:6px 0;">Denne tjenesten viser kun data for inneværende uke og neste uke, samt historikk for tidligere uker. Velg en dato i disse ukene for å se bookinger.</p>
          <div style=\"margin-top:12px;\">
            <button id=\"today-btn\" title=\"Gå til dagens dato\" style=\"background:#2980b9;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;\">Gå til dagens dato</button>
          </div>
        </div>`;
      document.getElementById('details').innerText = '';
      const todayBtn = document.getElementById('today-btn');
      if (todayBtn) todayBtn.onclick = () => { window.location.reload(); };
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

  // Update lastUpdate in footer
  let lastUpdateElem = document.getElementById('last-update');
  if (lastUpdateElem && data.lastUpdate) {
    const dt = new Date(data.lastUpdate);
    lastUpdateElem.innerHTML = `Datagrunnlag hentet fra <a href=\"https://www.bookup.no/\" target=\"_blank\">bookup.no</a>. <br> Sist oppdatert: ${dt.toLocaleString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  // 
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
  let overviewHtml = '<div class="overview-grid">';
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
  const style = isSelected ? ` style="background:${color}"` : '';
  let boxHtml = `<div class="overview-card${isSelected ? ' selected' : ''}"${style} onclick="toggleBuildingFilter(${bIdx})">`;
  boxHtml += `<div class="title">${building.buildingName}</div>`;
  if (allBookings.length > 0) {
    const sorted = allBookings.sort((a, b) => new Date(a.start) - new Date(b.start));
    const firstOccupied = sorted[0];
    const lastOccupied = sorted[sorted.length - 1];
    boxHtml += `<div class="hours">${formatTime(firstOccupied.start)} - ${formatTime(lastOccupied.end)}</div>`;
  } else {
    boxHtml += `<div class="free-label">Ledig hele dagen</div>`;
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

let activeBookingPopup = null;

function renderRoomTimeline(room, bookings, color) {
  const timelineStart = 8; // 08:00
  const timelineEnd = 22; // 22:00
  const blocks = getTimelineBlocks(bookings, timelineStart, timelineEnd);
  const timelineLabels = buildTimelineLabels(timelineStart, timelineEnd);
  let timelineHtml = timelineLabels;
  timelineHtml += `<div class=\"timeline\">`;
  blocks.forEach((block, idx) => {
    const left = ((block.start - timelineStart) / (timelineEnd - timelineStart)) * 100;
    const width = ((block.end - block.start) / (timelineEnd - timelineStart)) * 100;
    // Add click handler to show popup
    timelineHtml += `<div class=\"timeline-block\" style=\"left:${left}%;width:${width}%;background:${color};\" onclick=\"showBookingPopup(event, '${escapeBookingInfo(block)}')\"></div>`;
  });
  timelineHtml += `</div>`;
  return `<div class=\"booking\"><span class=\"room\" style=\"color:${color};font-weight:bold;\">${room.roomName}</span><br>${timelineHtml}</div>`;
}

function escapeBookingInfo(block) {
  // Escape quotes and newlines for safe HTML attribute
  let info = `Fra: ${block.info.split(' - ')[0]}<br>Til: ${block.info.split(' - ')[1]}`;
  if (block.title) info += `<br>${block.title}`;
  if (block.renterName) info += `<br>Leietaker: ${block.renterName}`;
  return info.replace(/'/g, "&#39;").replace(/\n/g, '<br>');
}

function showBookingPopup(e, infoHtml) {
  removeBookingPopup();
  const popup = document.createElement('div');
  popup.className = 'booking-popup';
  popup.innerHTML = infoHtml;
  // Calculate position
  const x = (e.touches ? e.touches[0].clientX : e.clientX) + 10;
  const y = (e.touches ? e.touches[0].clientY : e.clientY) + 10;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
  document.body.appendChild(popup);
  activeBookingPopup = popup;
  // Adjust position if out of viewport
  setTimeout(() => {
    const rect = popup.getBoundingClientRect();
    let newLeft = rect.left;
    let newTop = rect.top;
    if (rect.right > window.innerWidth) {
      newLeft = window.innerWidth - rect.width - 10;
      popup.style.left = newLeft + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      newTop = window.innerHeight - rect.height - 10;
      popup.style.top = newTop + 'px';
    }
    document.addEventListener('mousedown', handlePopupDismiss, { once: true });
    document.addEventListener('touchstart', handlePopupDismiss, { once: true });
  }, 0);
}

function removeBookingPopup() {
  if (activeBookingPopup) {
    activeBookingPopup.remove();
    activeBookingPopup = null;
  }
}

function handlePopupDismiss(e) {
  if (activeBookingPopup && !activeBookingPopup.contains(e.target)) {
    removeBookingPopup();
  }
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
  function toDateOnly(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const newDate = new Date(selectedDate);
  newDate.setDate(newDate.getDate() + offset);
  // If we don't have data yet, just update state and try load now
  if (!data) {
    selectedDate = newDate;
    filteredBuildingIdxs = [];
    userClearedFilter = false;
    loadBookings(selectedDate);
    return;
  }
  const currentWeekStart = toDateOnly(new Date(data.weekStart));
  const currentWeekEnd = toDateOnly(new Date(data.weekEnd));
  const newDateOnly = toDateOnly(newDate);
  selectedDate = newDate;
  // Crossing week boundary? Load new file
  if (newDateOnly < currentWeekStart || newDateOnly > currentWeekEnd) {
    filteredBuildingIdxs = [];
    userClearedFilter = false;
    loadBookings(selectedDate);
  } else {
    userClearedFilter = false;
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
  loadBookings(selectedDate);
  const prevBtn = document.getElementById('prev-day');
  const nextBtn = document.getElementById('next-day');
  if (prevBtn) prevBtn.onclick = () => changeDate(-1);
  if (nextBtn) nextBtn.onclick = () => changeDate(1);
  const selectedDateSpan = document.getElementById('selected-date');
  if (selectedDateSpan) selectedDateSpan.onclick = () => openDatePicker();

  const infoBtn = document.getElementById('info-btn');
  if (infoBtn) infoBtn.onclick = () => showInfoModal();
});

function showInfoModal() {
  // Create modal elements
  const modal = document.createElement('div');
  modal.className = 'info-modal';
  modal.id = 'info-modal';

  const content = document.createElement('div');
  content.className = 'info-content';

  content.innerHTML = `
    <div class="info-header">
      <h3 class="info-title">Om denne siden</h3>
      <button class="close-btn" id="close-info">&times;</button>
    </div>
    <div class="info-text">
      <p><strong>Hva finner du her?</strong><br>
      En oversikt over bookinger i Hegrahallen per dag og rom.</p>
      
      <p><strong>Hvordan bruker jeg siden?</strong><br>
      Bruk «Forrige»/«Neste» for å navigere mellom datoer, eller klikk på datoen for å velge en spesifikk dato.</p>
      
      <p><strong>Hvor ofte oppdateres bookinger?</strong><br>
      Data hentes automatisk hver time for bookinger inneværende og neste uke.
      Se "Sist oppdatert" i bunntekst for når data sist ble hentet for aktuell dato.</p>

      <p><strong>Tips</strong><br>
      - Klikk på boksene for å filtrere visningen av bookinger.<br>
      - Klikk på en booking oppføring for å se mer informasjon.<br>
      - Klikk på datoen for å velge ønsket dato direkte.<br>
      
      <p><strong>Kontakt:</strong><br>
      Har du oppdaget en feil, har forslag til forbedringer eller spørsmål? Ta kontakt med <a href="mailto:trond.skille@gmail.com">Trond Skille</a>.<br>
      </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // Add event listeners for closing
  const closeBtn = document.getElementById('close-info');
  closeBtn.onclick = () => closeInfoModal();

  // Close when clicking outside content
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeInfoModal();
    }
  };

  // Close with Escape key
  document.addEventListener('keydown', handleEscapeKey);
}

function closeInfoModal() {
  const modal = document.getElementById('info-modal');
  if (modal) {
    modal.remove();
    document.removeEventListener('keydown', handleEscapeKey);
  }
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    closeInfoModal();
  }
}


