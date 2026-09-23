/**
 * Attendance & Assignment Tracker
 * Local-First Daily Personal Logging Tool
 */

// Baseline Subjects Data (Core Enrolled Subjects)
const BASELINE_SUBJECTS = [
  { id: 'DMGT', name: 'Discrete Mathematics & Graph Theory', baselineHeld: 24, baselineAttended: 15 },
  { id: 'UHV', name: 'Universal Human Values', baselineHeld: 18, baselineAttended: 10 },
  { id: 'AI', name: 'Artificial Intelligence', baselineHeld: 33, baselineAttended: 19 },
  { id: 'ADS', name: 'Advanced Data Structures', baselineHeld: 28, baselineAttended: 14 },
  { id: 'OOPJ', name: 'Object Oriented Programming (Java)', baselineHeld: 33, baselineAttended: 16 },
  { id: 'ADSLAB', name: 'ADS Laboratory', baselineHeld: 12, baselineAttended: 9 },
  { id: 'OOPJLAB', name: 'OOPJ Laboratory', baselineHeld: 21, baselineAttended: 9 },
  { id: 'ES', name: 'Environmental Science', baselineHeld: 14, baselineAttended: 8 },
  { id: 'PP', name: 'Professional Practice', baselineHeld: 3, baselineAttended: 3 }
];

// Miscellaneous / Institutional Baseline (Covers ORIENTATIO 36/6, CRT Aptitu 3/0, CRT Tech 2/0)
const DEFAULT_INSTITUTIONAL = {
  held: 41,
  attended: 6
};

const STORAGE_KEYS = {
  LOGS: 'attendance_logs_v1',
  ASSIGNMENTS: 'attendance_assignments_v1',
  INSTITUTIONAL: 'attendance_institutional_v1'
};

// Application State
const state = {
  activeView: 'dashboard', // 'dashboard' | 'assignments' | 'history'
  todayStr: getTodayIsoString(),
  logs: {}, // Map of 'YYYY-MM-DD' -> LogObject
  assignments: [], // Array of AssignmentObject
  institutional: { ...DEFAULT_INSTITUTIONAL }, // Held: 41, Attended: 6
  currentEditingDate: null,
  trackerDraft: {} // Map of subjectId -> 'none' | 'attended' | 'absent'
};

// Format utilities
function getTodayIsoString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(isoString) {
  if (!isoString) return '';
  const [y, m, d] = isoString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatShortDate(isoString) {
  if (!isoString) return '';
  const [y, m, d] = isoString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

// Storage Operations
function loadData() {
  try {
    const storedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
    state.logs = storedLogs ? JSON.parse(storedLogs) : {};

    const storedAssignments = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
    state.assignments = storedAssignments ? JSON.parse(storedAssignments) : [];

    const storedInstitutional = localStorage.getItem(STORAGE_KEYS.INSTITUTIONAL);
    if (storedInstitutional) {
      const parsed = JSON.parse(storedInstitutional);
      state.institutional = {
        held: Number(parsed.held) || DEFAULT_INSTITUTIONAL.held,
        attended: Number(parsed.attended) || DEFAULT_INSTITUTIONAL.attended
      };
    } else {
      state.institutional = { ...DEFAULT_INSTITUTIONAL };
    }
  } catch (err) {
    console.error('Failed to parse localStorage data', err);
    state.logs = {};
    state.assignments = [];
    state.institutional = { ...DEFAULT_INSTITUTIONAL };
  }
}

function saveLogs() {
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(state.logs));
}

function saveAssignments() {
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(state.assignments));
}

function saveInstitutional() {
  localStorage.setItem(STORAGE_KEYS.INSTITUTIONAL, JSON.stringify(state.institutional));
}

// Statistics Calculations
function computeSubjectStats(subjectId, excludeDate = null) {
  const sub = BASELINE_SUBJECTS.find(s => s.id === subjectId);
  if (!sub) return { held: 0, attended: 0, percentage: 0 };

  let held = sub.baselineHeld;
  let attended = sub.baselineAttended;

  for (const [date, log] of Object.entries(state.logs)) {
    if (excludeDate && date === excludeDate) continue;
    if (log.status === 'attended' && log.subjectLogs && log.subjectLogs[subjectId]) {
      const sStatus = log.subjectLogs[subjectId];
      if (sStatus === 'attended') {
        held += 1;
        attended += 1;
      } else if (sStatus === 'absent') {
        held += 1;
      }
    }
  }

  const percentage = held > 0 ? ((attended / held) * 100).toFixed(1) : '0.0';
  return { held, attended, percentage: Number(percentage) };
}

function computeOverallStats(excludeDate = null) {
  // Institutional / Misc Baseline numbers (Covers portal categories)
  let totalHeld = state.institutional.held || 0;
  let totalAttended = state.institutional.attended || 0;

  // Add cumulative stats from all 9 regular enrolled subjects
  BASELINE_SUBJECTS.forEach(sub => {
    const stats = computeSubjectStats(sub.id, excludeDate);
    totalHeld += stats.held;
    totalAttended += stats.attended;
  });

  const percentage = totalHeld > 0 ? ((totalAttended / totalHeld) * 100).toFixed(1) : '0.0';
  return {
    totalHeld,
    totalAttended,
    percentage: Number(percentage)
  };
}

// UI Render Functions
function updateOverallHeader() {
  const stats = computeOverallStats();
  const pctEl = document.getElementById('overallPercentage');
  const fracEl = document.getElementById('overallFraction');

  if (pctEl) pctEl.textContent = `${stats.percentage}%`;
  if (fracEl) fracEl.textContent = `(${stats.totalAttended} / ${stats.totalHeld} classes)`;
}

function renderSubjectCards() {
  const container = document.getElementById('subjectsGrid');
  if (!container) return;

  container.innerHTML = '';

  BASELINE_SUBJECTS.forEach(sub => {
    const stats = computeSubjectStats(sub.id);
    const subAssignments = state.assignments.filter(a => a.subjectId === sub.id && a.status !== 'submitted');

    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <div>
        <div class="card-top-row">
          <div>
            <span class="subject-code-badge">${sub.id}</span>
            <div class="subject-fullname">${sub.name}</div>
          </div>
          <div class="card-percentage">${stats.percentage}%</div>
        </div>

        <div class="progress-track" title="Attendance Progress: ${stats.percentage}%">
          <div class="progress-fill" style="width: ${Math.min(stats.percentage, 100)}%;"></div>
        </div>
      </div>

      <div class="card-stats-row">
        <div class="card-held-attended">
          <strong>${stats.attended}</strong> / ${stats.held} attended
        </div>
        <button class="card-assignment-pill" onclick="openSubjectAssignments('${sub.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg>
          <span>${subAssignments.length} pending</span>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function updateTodayStatusBanner() {
  const chip = document.getElementById('todayStatusChipText');
  const todayLog = state.logs[state.todayStr];

  if (!chip) return;

  if (!todayLog) {
    chip.textContent = "Today: Not logged yet";
  } else if (todayLog.status === 'holiday') {
    chip.textContent = "Today: Logged as Holiday";
  } else if (todayLog.status === 'leave') {
    chip.textContent = "Today: Logged as Leave";
  } else if (todayLog.status === 'attended') {
    let attendedCount = 0;
    if (todayLog.subjectLogs) {
      attendedCount = Object.values(todayLog.subjectLogs).filter(s => s === 'attended').length;
    }
    chip.textContent = `Today: Attended (${attendedCount} classes)`;
  }
}

// Floating Quick-Log Widget Setup
function renderQuickWidget() {
  const dateEl = document.getElementById('widgetTodayDate');
  const unloggedState = document.getElementById('widgetUnloggedState');
  const loggedState = document.getElementById('widgetLoggedState');
  const classActionWrap = document.getElementById('widgetClassActionWrap');
  const btnAttended = document.getElementById('btnQuickAttended');
  const btnHoliday = document.getElementById('btnQuickHoliday');
  const btnLeave = document.getElementById('btnQuickLeave');
  const loggedStatusTitle = document.getElementById('loggedStatusTitle');
  const loggedStatusSubtitle = document.getElementById('loggedStatusSubtitle');

  if (dateEl) {
    dateEl.textContent = formatDateDisplay(state.todayStr);
  }

  const todayLog = state.logs[state.todayStr];

  if (todayLog) {
    // Already Logged State
    unloggedState.style.display = 'none';
    loggedState.style.display = 'flex';

    if (todayLog.status === 'holiday') {
      loggedStatusTitle.textContent = 'Day recorded: Holiday';
      loggedStatusSubtitle.textContent = 'Enjoy your day off!';
    } else if (todayLog.status === 'leave') {
      loggedStatusTitle.textContent = 'Day recorded: Leave';
      loggedStatusSubtitle.textContent = 'Personal leave taken';
    } else if (todayLog.status === 'attended') {
      const attendedCount = Object.values(todayLog.subjectLogs || {}).filter(s => s === 'attended').length;
      const absentCount = Object.values(todayLog.subjectLogs || {}).filter(s => s === 'absent').length;
      loggedStatusTitle.textContent = 'Day recorded: Attended';
      loggedStatusSubtitle.textContent = `${attendedCount} attended, ${absentCount} absent`;
    }
  } else {
    // Unlogged State
    unloggedState.style.display = 'flex';
    loggedState.style.display = 'none';
    classActionWrap.style.display = 'none';

    btnAttended.classList.remove('active');
    btnHoliday.classList.remove('active');
    btnLeave.classList.remove('active');
  }
}

// Main Tracker Panel Logic
function openTrackerModal(targetDate = null) {
  const dateToEdit = targetDate || state.todayStr;
  state.currentEditingDate = dateToEdit;

  const modal = document.getElementById('mainTrackerModal');
  const modalDate = document.getElementById('trackerModalDate');
  const title = document.getElementById('trackerModalTitle');

  if (modalDate) modalDate.textContent = formatDateDisplay(dateToEdit);
  if (title) title.textContent = dateToEdit === state.todayStr ? "Log Classes for Today" : `Edit Log for ${formatShortDate(dateToEdit)}`;

  // Initialize draft state
  state.trackerDraft = {};
  const existingLog = state.logs[dateToEdit];

  BASELINE_SUBJECTS.forEach(sub => {
    if (existingLog && existingLog.subjectLogs && existingLog.subjectLogs[sub.id]) {
      state.trackerDraft[sub.id] = existingLog.subjectLogs[sub.id];
    } else {
      state.trackerDraft[sub.id] = 'none'; // 'none' represents "Didn't happen"
    }
  });

  renderTrackerModalRows();
  updateTrackerModalSummary();
  modal.classList.add('open');
}

function closeTrackerModal() {
  const modal = document.getElementById('mainTrackerModal');
  modal.classList.remove('open');
  state.currentEditingDate = null;
  state.trackerDraft = {};
}

function renderTrackerModalRows() {
  const container = document.getElementById('trackerSubjectsList');
  if (!container) return;

  container.innerHTML = '';

  BASELINE_SUBJECTS.forEach(sub => {
    const currentStatus = state.trackerDraft[sub.id] || 'none';
    // Calculate cumulative before this day's draft
    const baseStats = computeSubjectStats(sub.id, state.currentEditingDate);

    // Compute live preview with current toggle
    let previewHeld = baseStats.held;
    let previewAttended = baseStats.attended;

    if (currentStatus === 'attended') {
      previewHeld += 1;
      previewAttended += 1;
    } else if (currentStatus === 'absent') {
      previewHeld += 1;
    }

    const previewPct = previewHeld > 0 ? ((previewAttended / previewHeld) * 100).toFixed(1) : '0.0';
    const subAssignments = state.assignments.filter(a => a.subjectId === sub.id);
    const pendingCount = subAssignments.filter(a => a.status !== 'submitted').length;

    const row = document.createElement('div');
    row.className = 'tracker-row';
    row.id = `tracker-row-${sub.id}`;
    row.innerHTML = `
      <div class="tracker-row-main">
        <div class="tracker-subject-info">
          <span class="tracker-code">${sub.id}</span>
          <div class="tracker-stats">
            <span class="tracker-cumulative">${previewAttended}/${previewHeld} attended</span>
            <span class="tracker-cumulative-pct">${previewPct}%</span>
          </div>
        </div>

        <div class="tracker-status-toggle">
          <button type="button" class="toggle-option-btn ${currentStatus === 'none' ? 'selected-none' : ''}" 
                  onclick="setTrackerSubjectStatus('${sub.id}', 'none')">
            Didn't happen
          </button>
          <button type="button" class="toggle-option-btn ${currentStatus === 'attended' ? 'selected-attended' : ''}" 
                  onclick="setTrackerSubjectStatus('${sub.id}', 'attended')">
            Attended
          </button>
          <button type="button" class="toggle-option-btn ${currentStatus === 'absent' ? 'selected-absent' : ''}" 
                  onclick="setTrackerSubjectStatus('${sub.id}', 'absent')">
            Absent
          </button>
        </div>

        <button type="button" class="tracker-assignments-btn ${pendingCount > 0 ? 'has-pending' : ''}" onclick="toggleTrackerAccordion('${sub.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg>
          <span>Assignments (${pendingCount})</span>
        </button>
      </div>

      <div class="tracker-assignments-accordion" id="accordion-${sub.id}">
        <div class="accordion-title-row">
          <span>${sub.name} &bull; Assignments</span>
          <span>${pendingCount} Pending</span>
        </div>
        <div class="accordion-list" id="accordion-list-${sub.id}">
          ${renderAccordionAssignmentItems(sub.id)}
        </div>
        <div class="inline-add-assignment">
          <input type="text" class="inline-add-input" id="inline-title-${sub.id}" placeholder="Add new assignment for ${sub.id}...">
          <input type="date" class="inline-date-input" id="inline-date-${sub.id}" value="${getTodayIsoString()}">
          <button type="button" class="btn btn-secondary btn-sm" onclick="addInlineAssignment('${sub.id}')">Add</button>
        </div>
      </div>
    `;

    container.appendChild(row);
  });
}

function renderAccordionAssignmentItems(subjectId) {
  const items = state.assignments.filter(a => a.subjectId === subjectId);
  if (items.length === 0) {
    return `<div style="font-size:0.75rem; color:var(--text-dim); padding:4px 0;">No assignments listed for ${subjectId}.</div>`;
  }

  return items.map(a => `
    <div class="accordion-item">
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="custom-checkbox ${a.status === 'submitted' ? 'checked' : ''}" onclick="toggleAssignmentDone('${a.id}', true)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <span style="${a.status === 'submitted' ? 'text-decoration:line-through; color:var(--text-dim);' : ''}">${escapeHtml(a.title)}</span>
      </div>
      <span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-dim);">${formatShortDate(a.dueDate)}</span>
    </div>
  `).join('');
}

function setTrackerSubjectStatus(subjectId, status) {
  state.trackerDraft[subjectId] = status;
  renderTrackerModalRows();
  updateTrackerModalSummary();
}

function toggleTrackerAccordion(subjectId) {
  const el = document.getElementById(`accordion-${subjectId}`);
  if (el) {
    el.classList.toggle('open');
  }
}

function addInlineAssignment(subjectId) {
  const titleInput = document.getElementById(`inline-title-${subjectId}`);
  const dateInput = document.getElementById(`inline-date-${subjectId}`);

  const title = titleInput.value.trim();
  const dueDate = dateInput.value;

  if (!title) {
    showToast('Please enter an assignment title');
    return;
  }

  const newAssignment = {
    id: 'asg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    subjectId,
    title,
    dueDate: dueDate || state.todayStr,
    status: 'pending',
    createdAt: Date.now()
  };

  state.assignments.unshift(newAssignment);
  saveAssignments();
  titleInput.value = '';

  renderTrackerModalRows();
  renderSubjectCards();
  renderAssignmentsView();
  updateNavBadge();
  showToast(`Added assignment for ${subjectId}`);
}

function updateTrackerModalSummary() {
  const summaryEl = document.getElementById('trackerModalSummaryPreview');
  if (!summaryEl) return;

  let attended = 0;
  let absent = 0;
  let notHeld = 0;

  BASELINE_SUBJECTS.forEach(sub => {
    const status = state.trackerDraft[sub.id] || 'none';
    if (status === 'attended') attended++;
    else if (status === 'absent') absent++;
    else notHeld++;
  });

  summaryEl.textContent = `${attended} attended \u2022 ${absent} absent \u2022 ${notHeld} didn't happen`;
}

function saveTodayTrackerLog() {
  const dateToSave = state.currentEditingDate || state.todayStr;

  state.logs[dateToSave] = {
    date: dateToSave,
    status: 'attended',
    subjectLogs: { ...state.trackerDraft },
    timestamp: Date.now()
  };

  saveLogs();
  closeTrackerModal();
  refreshAllViews();
  showToast(`Attendance recorded for ${formatShortDate(dateToSave)}`);
}

// Assignments Hub Logic
function renderAssignmentsView() {
  const container = document.getElementById('allAssignmentsList');
  const subjectFilter = document.getElementById('assignmentSubjectFilter').value;
  const statusFilter = document.getElementById('assignmentStatusFilter').value;

  if (!container) return;

  let filtered = state.assignments;
  if (subjectFilter !== 'ALL') {
    filtered = filtered.filter(a => a.subjectId === subjectFilter);
  }
  if (statusFilter !== 'ALL') {
    filtered = filtered.filter(a => a.status === statusFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No assignments found</div>
        <p>No coursework matches the selected filters.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(a => {
    const sub = BASELINE_SUBJECTS.find(s => s.id === a.subjectId);
    const isDone = a.status === 'submitted';

    return `
      <div class="assignment-item ${isDone ? 'is-done' : ''}" id="asg-item-${a.id}">
        <div class="assignment-left">
          <button class="custom-checkbox ${isDone ? 'checked' : ''}" onclick="toggleAssignmentDone('${a.id}')" aria-label="Toggle completed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <div class="assignment-details">
            <div class="assignment-title">${escapeHtml(a.title)}</div>
            <div class="assignment-meta">
              <span class="meta-subject-tag">${a.subjectId}</span>
              <span>&bull;</span>
              <span>Due: ${formatDateDisplay(a.dueDate)}</span>
            </div>
          </div>
        </div>

        <div class="assignment-right">
          <select class="status-dropdown" onchange="changeAssignmentStatus('${a.id}', this.value)">
            <option value="pending" ${a.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="in-progress" ${a.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
            <option value="submitted" ${a.status === 'submitted' ? 'selected' : ''}>Submitted</option>
          </select>
          <button class="btn-icon-danger" onclick="deleteAssignment('${a.id}')" title="Delete assignment" aria-label="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleAssignmentDone(id, refreshAccordion = false) {
  const asg = state.assignments.find(a => a.id === id);
  if (!asg) return;

  asg.status = asg.status === 'submitted' ? 'pending' : 'submitted';
  saveAssignments();
  renderAssignmentsView();
  renderSubjectCards();
  updateNavBadge();

  if (refreshAccordion && state.currentEditingDate) {
    renderTrackerModalRows();
  }
}

function changeAssignmentStatus(id, newStatus) {
  const asg = state.assignments.find(a => a.id === id);
  if (!asg) return;

  asg.status = newStatus;
  saveAssignments();
  renderAssignmentsView();
  renderSubjectCards();
  updateNavBadge();
}

function deleteAssignment(id) {
  state.assignments = state.assignments.filter(a => a.id !== id);
  saveAssignments();
  renderAssignmentsView();
  renderSubjectCards();
  updateNavBadge();
  showToast('Assignment removed');
}

function populateSubjectDropdowns() {
  const selects = [
    document.getElementById('assignmentSubjectSelect'),
    document.getElementById('assignmentSubjectFilter')
  ];

  selects.forEach(sel => {
    if (!sel) return;
    const isFilter = sel.id === 'assignmentSubjectFilter';
    sel.innerHTML = isFilter ? '<option value="ALL">All Subjects</option>' : '';

    BASELINE_SUBJECTS.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = `${sub.id} — ${sub.name}`;
      sel.appendChild(opt);
    });
  });
}

function openGlobalAssignmentModal(defaultSubjectId = null) {
  const modal = document.getElementById('assignmentModal');
  const subjectSelect = document.getElementById('assignmentSubjectSelect');
  const titleInput = document.getElementById('assignmentTitleInput');
  const dueDateInput = document.getElementById('assignmentDueDateInput');
  const statusSelect = document.getElementById('assignmentStatusSelect');

  titleInput.value = '';
  dueDateInput.value = state.todayStr;
  statusSelect.value = 'pending';

  if (defaultSubjectId) {
    subjectSelect.value = defaultSubjectId;
  } else if (BASELINE_SUBJECTS.length > 0) {
    subjectSelect.value = BASELINE_SUBJECTS[0].id;
  }

  modal.classList.add('open');
}

function closeGlobalAssignmentModal() {
  const modal = document.getElementById('assignmentModal');
  modal.classList.remove('open');
}

// History View Logic
function renderHistoryView() {
  const container = document.getElementById('historyTimeline');
  if (!container) return;

  const dates = Object.keys(state.logs).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No daily logs recorded yet</div>
        <p>Use the floating quick logger to log your daily attendance.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = dates.map(date => {
    const log = state.logs[date];
    let summaryText = '';
    let pillsHtml = '';

    if (log.status === 'holiday') {
      summaryText = 'Holiday recorded (no classes conducted)';
    } else if (log.status === 'leave') {
      summaryText = 'Personal leave taken';
    } else if (log.status === 'attended') {
      const subjectEntries = Object.entries(log.subjectLogs || {});
      const attendedList = subjectEntries.filter(([, st]) => st === 'attended').map(([id]) => id);
      const absentList = subjectEntries.filter(([, st]) => st === 'absent').map(([id]) => id);

      summaryText = `${attendedList.length} attended, ${absentList.length} absent`;
      pillsHtml = `
        <div class="history-pills">
          ${attendedList.map(s => `<span class="history-pill attended">${s}</span>`).join('')}
          ${absentList.map(s => `<span class="history-pill absent">${s} (Absent)</span>`).join('')}
        </div>
      `;
    }

    return `
      <div class="history-card">
        <div>
          <div class="history-date">${formatDateDisplay(date)}</div>
          <div class="history-summary">${summaryText}</div>
          ${pillsHtml}
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="editHistoryDate('${date}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteHistoryDate('${date}')" title="Delete log">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function editHistoryDate(date) {
  const log = state.logs[date];
  if (!log) return;

  if (log.status === 'attended') {
    openTrackerModal(date);
  } else {
    // Quick prompt for Holiday / Leave change or re-log
    if (confirm(`Date ${date} is currently logged as "${log.status}". Would you like to open the class logger to convert it to Attended classes?`)) {
      openTrackerModal(date);
    }
  }
}

function deleteHistoryDate(date) {
  if (confirm(`Delete attendance log for ${formatDateDisplay(date)}?`)) {
    delete state.logs[date];
    saveLogs();
    refreshAllViews();
    showToast(`Removed log for ${formatShortDate(date)}`);
  }
}

// Backup Export & Import
function exportBackup() {
  const data = {
    version: 1,
    exportDate: new Date().toISOString(),
    logs: state.logs,
    assignments: state.assignments,
    institutional: state.institutional
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_tracker_backup_${state.todayStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup file downloaded');
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.logs) state.logs = parsed.logs;
      if (parsed.assignments) state.assignments = parsed.assignments;
      if (parsed.institutional) {
        state.institutional = {
          held: Number(parsed.institutional.held) || DEFAULT_INSTITUTIONAL.held,
          attended: Number(parsed.institutional.attended) || DEFAULT_INSTITUTIONAL.attended
        };
        saveInstitutional();
      }

      saveLogs();
      saveAssignments();
      refreshAllViews();
      showToast('Backup restored successfully!');
    } catch (err) {
      showToast('Invalid backup file format');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// Institutional / Miscellaneous Data Modal
function openInstitutionalModal() {
  const modal = document.getElementById('institutionalModal');
  const heldInput = document.getElementById('institutionalHeldInput');
  const attendedInput = document.getElementById('institutionalAttendedInput');

  if (heldInput) heldInput.value = state.institutional.held;
  if (attendedInput) attendedInput.value = state.institutional.attended;

  if (modal) modal.classList.add('open');
}

function closeInstitutionalModal() {
  const modal = document.getElementById('institutionalModal');
  if (modal) modal.classList.remove('open');
}

// Global Refresh Helper
function refreshAllViews() {
  updateOverallHeader();
  renderSubjectCards();
  updateTodayStatusBanner();
  renderQuickWidget();
  renderAssignmentsView();
  renderHistoryView();
  updateNavBadge();
}

function updateNavBadge() {
  const badge = document.getElementById('pendingAssignmentsBadge');
  const count = state.assignments.filter(a => a.status !== 'submitted').length;
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

function switchView(viewName) {
  state.activeView = viewName;

  document.querySelectorAll('.view-nav .nav-tab').forEach(tab => {
    const isSelected = tab.getAttribute('data-view') === viewName;
    tab.classList.toggle('active', isSelected);
    tab.setAttribute('aria-selected', isSelected);
  });

  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSec = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
  if (targetSec) targetSec.classList.add('active');

  if (viewName === 'assignments') renderAssignmentsView();
  if (viewName === 'history') renderHistoryView();
}

window.openSubjectAssignments = function(subjectId) {
  const filter = document.getElementById('assignmentSubjectFilter');
  if (filter) filter.value = subjectId;
  switchView('assignments');
};

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Event Listeners Setup
function initEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.view-nav .nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view');
      switchView(view);
    });
  });

  // Floating Quick Widget Actions
  const btnAttended = document.getElementById('btnQuickAttended');
  const btnHoliday = document.getElementById('btnQuickHoliday');
  const btnLeave = document.getElementById('btnQuickLeave');
  const classActionWrap = document.getElementById('widgetClassActionWrap');
  const btnOpenClassLogger = document.getElementById('btnOpenClassLogger');
  const btnEditTodayLog = document.getElementById('btnEditTodayLog');
  const widgetMinimizeBtn = document.getElementById('widgetMinimizeBtn');
  const widget = document.getElementById('floatingQuickWidget');

  // Minimize / Expand Widget
  if (widgetMinimizeBtn) {
    widgetMinimizeBtn.addEventListener('click', () => {
      widget.classList.toggle('minimized');
    });
  }

  // Click "Attended"
  if (btnAttended) {
    btnAttended.addEventListener('click', () => {
      btnAttended.classList.add('active');
      btnHoliday.classList.remove('active');
      btnLeave.classList.remove('active');
      classActionWrap.style.display = 'block';
    });
  }

  // Click "Holiday"
  if (btnHoliday) {
    btnHoliday.addEventListener('click', () => {
      state.logs[state.todayStr] = {
        date: state.todayStr,
        status: 'holiday',
        timestamp: Date.now()
      };
      saveLogs();
      refreshAllViews();
      showToast('Today logged as Holiday');
    });
  }

  // Click "Leave"
  if (btnLeave) {
    btnLeave.addEventListener('click', () => {
      state.logs[state.todayStr] = {
        date: state.todayStr,
        status: 'leave',
        timestamp: Date.now()
      };
      saveLogs();
      refreshAllViews();
      showToast('Today logged as Leave');
    });
  }

  // Click "Log classes happened"
  if (btnOpenClassLogger) {
    btnOpenClassLogger.addEventListener('click', () => {
      openTrackerModal(state.todayStr);
    });
  }

  // Edit Today's Log
  if (btnEditTodayLog) {
    btnEditTodayLog.addEventListener('click', () => {
      const todayLog = state.logs[state.todayStr];
      if (todayLog && todayLog.status === 'attended') {
        openTrackerModal(state.todayStr);
      } else {
        // Reset today's log to unlogged state for re-selection
        delete state.logs[state.todayStr];
        saveLogs();
        refreshAllViews();
        showToast('Ready to re-log today');
      }
    });
  }

  // Main Tracker Modal Buttons
  document.getElementById('btnCloseTrackerModal')?.addEventListener('click', closeTrackerModal);
  document.getElementById('btnCancelTrackerModal')?.addEventListener('click', closeTrackerModal);
  document.getElementById('btnSaveTodayLog')?.addEventListener('click', saveTodayTrackerLog);

  // Global Assignment Modal
  document.getElementById('btnOpenGlobalAddAssignment')?.addEventListener('click', () => openGlobalAssignmentModal());
  document.getElementById('btnCloseAssignmentModal')?.addEventListener('click', closeGlobalAssignmentModal);
  document.getElementById('btnCancelAssignmentModal')?.addEventListener('click', closeGlobalAssignmentModal);

  // Institutional Modal
  document.getElementById('btnOpenInstitutionalModal')?.addEventListener('click', openInstitutionalModal);
  document.getElementById('btnCloseInstitutionalModal')?.addEventListener('click', closeInstitutionalModal);
  document.getElementById('btnCancelInstitutionalModal')?.addEventListener('click', closeInstitutionalModal);

  document.getElementById('institutionalForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const heldVal = parseInt(document.getElementById('institutionalHeldInput').value, 10);
    const attendedVal = parseInt(document.getElementById('institutionalAttendedInput').value, 10);

    if (isNaN(heldVal) || isNaN(attendedVal) || heldVal < 0 || attendedVal < 0) {
      showToast('Please enter valid positive numbers');
      return;
    }

    state.institutional = {
      held: heldVal,
      attended: attendedVal
    };

    saveInstitutional();
    closeInstitutionalModal();
    updateOverallHeader();
    showToast('Institutional attendance updated!');
  });

  // Assignment Form Submission
  document.getElementById('assignmentForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const subjectId = document.getElementById('assignmentSubjectSelect').value;
    const title = document.getElementById('assignmentTitleInput').value.trim();
    const dueDate = document.getElementById('assignmentDueDateInput').value;
    const status = document.getElementById('assignmentStatusSelect').value;

    if (!title) return;

    state.assignments.unshift({
      id: 'asg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      subjectId,
      title,
      dueDate: dueDate || state.todayStr,
      status: status || 'pending',
      createdAt: Date.now()
    });

    saveAssignments();
    closeGlobalAssignmentModal();
    refreshAllViews();
    showToast('Assignment saved!');
  });

  // Filter Bar Changes
  document.getElementById('assignmentSubjectFilter')?.addEventListener('change', renderAssignmentsView);
  document.getElementById('assignmentStatusFilter')?.addEventListener('change', renderAssignmentsView);

  // Export / Import
  document.getElementById('btnExportData')?.addEventListener('click', exportBackup);
  const importFileInput = document.getElementById('importFileInput');
  document.getElementById('btnImportData')?.addEventListener('click', () => importFileInput?.click());
  importFileInput?.addEventListener('change', importBackup);
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  populateSubjectDropdowns();
  initEventListeners();
  refreshAllViews();
});
