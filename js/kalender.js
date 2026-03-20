// ── KALENDER RENDER ───────────────────────────────
function renderKalender() {
  const year  = calYear;
  const month = calMonth;
  const today = new Date();

  // Header label
  document.getElementById('calMonthLabel').textContent =
    new Date(year, month, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // Build day grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  // Events map: 'YYYY-MM-DD' -> []
  const evMap = {};
  allKons.forEach(k => {
    if (k.tgl_followup) {
      const key = k.tgl_followup.slice(0, 10);
      if (!evMap[key]) evMap[key] = [];
      evMap[key].push(k);
    }
  });

  const dayNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  let html = dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  // Prev month days
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month">${daysInPrev - i}</div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday    = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const isSelected = calSelected === dateStr;
    const hasEv      = !!evMap[dateStr];
    let cls = 'cal-day';
    if (isToday)    cls += ' today';
    if (isSelected) cls += ' selected';
    if (hasEv)      cls += ' has-event';
    html += `<div class="${cls}" onclick="selectCalDay('${dateStr}')">${d}</div>`;
  }

  // Next month filler
  const total = firstDay + daysInMonth;
  const remainder = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remainder; d++) {
    html += `<div class="cal-day other-month">${d}</div>`;
  }

  document.getElementById('calGrid').innerHTML = html;
  renderCalEvents(evMap);
}

function selectCalDay(dateStr) {
  calSelected = calSelected === dateStr ? null : dateStr;
  renderKalender();
}

function renderCalEvents(evMap) {
  const el = document.getElementById('calEvents');
  const selectedEvents = calSelected ? (evMap[calSelected] || []) : [];

  // All upcoming events (next 14 days) when nothing selected
  let displayEvents;
  let titleTxt;
  if (calSelected) {
    displayEvents = selectedEvents;
    titleTxt = `Follow-up ${new Date(calSelected + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}`;
  } else {
    const today = new Date(new Date().toDateString());
    const limit = new Date(today); limit.setDate(today.getDate() + 14);
    displayEvents = allKons
      .filter(k => k.tgl_followup && new Date(k.tgl_followup + 'T00:00:00') >= today && new Date(k.tgl_followup + 'T00:00:00') <= limit)
      .sort((a, b) => a.tgl_followup.localeCompare(b.tgl_followup));
    titleTxt = '14 Hari ke Depan';
  }

  const canEdit = true;
  let evHtml = `<div class="cal-events-title">${titleTxt}</div>`;

  if (canEdit) {
    const prefill = calSelected ? `?followup=${calSelected}` : '';
    evHtml += `<button class="cal-add-follow-up" onclick="openAddModalWithFollowup('${calSelected || ''}')">＋ Jadwalkan Follow-up${calSelected ? ' Hari Ini' : ''}</button>`;
  }

  if (!displayEvents.length) {
    evHtml += `<div style="text-align:center;padding:24px;color:var(--text-4);font-size:13px">Tidak ada jadwal${calSelected ? ' di tanggal ini' : ''}</div>`;
  } else {
    evHtml += displayEvents.map(k => {
      const statusColors = { 'cek-lokasi': '#0ea5e9', booking: 'var(--brand)', dp: 'var(--amber)', berkas: 'var(--violet)', acc: '#ec4899', selesai: 'var(--emerald)', batal: 'var(--rose)' };
      const dateLabel = calSelected ? '' : `<span class="cal-event-time">${fDateShort(k.tgl_followup)}</span>`;
      return `
        <div class="cal-event-item" onclick="openDetail('${k.id}')">
          <div class="cal-event-dot" style="background:${statusColors[k.status] || 'var(--brand)'}"></div>
          <div class="cal-event-info">
            <div class="cal-event-name">${k.nama}</div>
            <div class="cal-event-meta">${sLabel(k.status)} · ${k.unit || '—'} · ${ownerName(k.owner_id)}</div>
          </div>
          ${dateLabel}
        </div>`;
    }).join('');
  }

  el.innerHTML = evHtml;
}

// ── CALENDAR NAVIGATION ───────────────────────────
function calPrev() {
  if (calMonth === 0) { calMonth = 11; calYear--; }
  else calMonth--;
  renderKalender();
}
function calNext() {
  if (calMonth === 11) { calMonth = 0; calYear++; }
  else calMonth++;
  renderKalender();
}
function calToday() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  calSelected = null;
  renderKalender();
}

// ── OPEN ADD MODAL WITH FOLLOW-UP DATE ────────────
function openAddModalWithFollowup(dateStr) {
  openAddModal();
  if (dateStr) {
    setTimeout(() => {
      document.getElementById('fTglFollowup').value = dateStr;
    }, 100);
  }
}
