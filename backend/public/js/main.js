// Custom JavaScript for Student Attendance Management System 

// --- Admin Dashboard: Dynamic Session Loading ---

document.addEventListener('DOMContentLoaded', function () {
  // Only run on admin-dashboard.html
  if (!window.location.pathname.endsWith('admin-dashboard.html')) return;

  token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  // Fetch and display sessions
  function loadSessions() {
    console.debug('Loading sessions...');
    fetch('/api/qr/sessions', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(sessions => {
        console.debug('Sessions loaded:', sessions);
        const tbody = document.getElementById('active-sessions-tbody');
        tbody.innerHTML = '';
        if (!Array.isArray(sessions) || sessions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No data</td></tr>';
          return;
        }
        sessions.forEach(session => {
          const className = session.className ? session.className : '-';
          const gradeSection = session.grade && session.section ? `${session.grade} - ${session.section}` : '-';
          const createdAt = session.createdAt ? new Date(session.createdAt).toLocaleString() : '-';
          const sessionId = session._id || '-';
          tbody.innerHTML += `
            <tr>
              <td>${sessionId}</td>
              <td>${className}</td>
              <td>${gradeSection}</td>
              <td>${createdAt}</td>
              <td>
                <div class="action-btn-group">
                  <button class="btn btn-outline-success btn-sm scan-qr-btn" data-id="${session._id}"><i class="fa-solid fa-qrcode me-2"></i>Scan QR Code</button>
                  <button class="btn btn-outline-primary btn-sm view-attendance-btn" data-id="${session._id}"><i class="fa fa-users me-2"></i>View Attendance</button>
                  <button class="btn btn-danger btn-sm delete-session-btn" data-id="${session._id}"><i class="fa fa-trash me-2"></i>Delete</button>
                </div>
              </td>
            </tr>
          `;
        });
        // Attach delete listeners
        Array.from(document.getElementsByClassName('delete-session-btn')).forEach(btn => {
          btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');
            const confirmed = await confirmAction('Delete this session? This cannot be undone.');
            if (!confirmed) return;
            fetch(`/api/qr/session/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': 'Bearer ' + token }
            })
              .then(res => res.json())
              .then(data => {
                if (data.message && data.message.includes('deleted')) {
                  if (window.hottoast) window.hottoast.success('Session deleted!');
                  loadSessions();
                  setTimeout(loadAttendanceSummary, 500); // Refresh summary after session delete with delay
                } else {
                  if (window.hottoast) window.hottoast.error(data.message || 'Error');
                }
              });
          });
        });
        // Attach view attendance listeners
        Array.from(document.getElementsByClassName('view-attendance-btn')).forEach(btn => {
          btn.addEventListener('click', function() {
            const sessionId = this.getAttribute('data-id');
            showSessionAttendanceModal(sessionId);
          });
        });
        // Attach scan QR listeners
        Array.from(document.getElementsByClassName('scan-qr-btn')).forEach(btn => {
          btn.addEventListener('click', function() {
            const sessionId = this.getAttribute('data-id');
            showScanQRModal(sessionId);
          });
        });
      })
      .catch(err => console.error('Error loading sessions:', err));
  }

  loadSessions();

  // --- Attendance Summary: Dynamic Loading ---
  function loadAttendanceSummary() {
    console.debug('Loading attendance summary...');
    fetch('/api/attendance/report', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(records => {
        console.debug('Attendance summary loaded:', records);
        const tbody = document.getElementById('attendance-summary-tbody');
        tbody.innerHTML = '';
        if (!Array.isArray(records) || records.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No data</td></tr>';
          return;
        }
        // Group by session (grade, section, class, date)
        const summaryMap = {};
        records.forEach(r => {
          const grade = r.session && r.session.grade ? r.session.grade : '-';
          const section = r.session && r.session.section ? r.session.section : '-';
          const className = r.session && r.session.className ? r.session.className : '-';
          const sessionId = r.session && r.session._id ? r.session._id : '-';
          const dateStr = r.date ? new Date(r.date).toLocaleDateString() : '-';
          const key = `${sessionId}|${grade}|${section}|${className}|${dateStr}`;
          if (!summaryMap[key]) summaryMap[key] = { sessionId, grade, section, className, date: r.date, present: 0, absent: 0 };
          if (r.status === 'present') summaryMap[key].present++;
          else summaryMap[key].absent++;
        });
        Object.values(summaryMap).forEach(s => {
          const sessionId = s.sessionId || '-';
          tbody.innerHTML += `
            <tr>
              <td>${sessionId}</td>
              <td>${s.grade} - ${s.section}</td>
              <td>${s.className}</td>
              <td>${new Date(s.date).toLocaleString()}</td>
              <td>${s.present}</td>
              <td>${s.absent}</td>
              <td><button class="btn btn-outline-success btn-sm download-attendance-btn" data-session-id="${sessionId}"><i class="fa-solid fa-download"></i></button></td>
            </tr>
          `;
        });
        // Attach download listeners
        Array.from(document.getElementsByClassName('download-attendance-btn')).forEach(btn => {
          btn.addEventListener('click', function() {
            const sessionId = this.getAttribute('data-session-id');
            if (sessionId && sessionId !== '-') {
              downloadAttendanceExcel(sessionId);
            }
          });
        });
      })
      .catch(err => console.error('Error loading attendance summary:', err));
  }
  loadAttendanceSummary();

  // --- Attendance Records Table (detailed, with delete) ---
  function loadAttendanceRecords() {
    fetch('/api/attendance/report', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(records => {
        const tbody = document.getElementById('attendance-records-tbody');
        tbody.innerHTML = '';
        if (!Array.isArray(records) || records.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No data</td></tr>';
          return;
        }
        records.forEach(r => {
          const studentName = r.student && r.student.name ? r.student.name : '-';
          const className = r.session && r.session.className ? r.session.className : '-';
          const sessionId = r.session || r._id; // fallback if session not present
          const studentId = r.student && r.student._id ? r.student._id : '';
          const date = r.date ? new Date(r.date).toLocaleString() : '-';
          const status = r.status || '-';
          tbody.innerHTML += `
            <tr>
              <td>${studentName}</td>
              <td>${className}</td>
              <td>${date}</td>
              <td>${status}</td>
              <td><button class="btn btn-danger btn-sm delete-attendance-btn" data-session="${r.session}" data-student="${studentId}"><i class="fa fa-trash"></i> Delete</button></td>
            </tr>
          `;
        });
        // Attach delete listeners
        Array.from(document.getElementsByClassName('delete-attendance-btn')).forEach(btn => {
          btn.addEventListener('click', async function() {
            const sessionId = this.getAttribute('data-session');
            const studentId = this.getAttribute('data-student');
            if (!sessionId || !studentId) {
              if (window.hottoast) window.hottoast.error('Missing session or student ID');
              return;
            }
            const confirmed = await confirmAction('Delete this attendance record? This cannot be undone.');
            if (!confirmed) return;
            fetch(`/api/qr/session/${sessionId}/attendance/${studentId}`, {
              method: 'DELETE',
              headers: { 'Authorization': 'Bearer ' + token }
            })
              .then(res => res.json())
              .then(data => {
                if (data.message && data.message.includes('deleted')) {
                  if (window.hottoast) window.hottoast.success('Attendance deleted!');
                  loadAttendanceRecords();
                  loadAttendanceSummary();
                } else {
                  if (window.hottoast) window.hottoast.error(data.message || 'Error');
                }
              });
          });
        });
      })
      .catch(err => console.error('Error loading attendance records:', err));
  }
  // Call on load
  loadAttendanceRecords();

  // --- Session Creation: Use class name input, create class if needed, then create session ---
  // Ensure token is defined in this scope
  // token = localStorage.getItem('token');
  if (!token) {
    if (window.hottoast) window.hottoast.error('Not authenticated. Please log in again.');
    else alert('Not authenticated. Please log in again.');
    window.location.href = 'index.html';
  }
  // Populate grade-section dropdown for session creation
  function populateSessionGradeSection() {
    fetch('/api/gradesection', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(res => res.json())
      .then(list => {
        const gsSelect = document.getElementById('session-gradesection-input');
        gsSelect.innerHTML = '<option value="">Select Grade & Section</option>';
        list.forEach(gs => {
          gsSelect.innerHTML += `<option value="${gs.grade}|${gs.section}">${gs.grade} - ${gs.section}</option>`;
        });
      });
  }
  if (window.location.pathname.endsWith('admin-dashboard.html')) {
    populateSessionGradeSection();
  }
  // Update session creation to use grade-section
  const sessionForm = document.getElementById('create-session-form');
  if (sessionForm) {
    sessionForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!token) {
        if (window.hottoast) window.hottoast.error('Not authenticated. Please log in again.');
        else alert('Not authenticated. Please log in again.');
        window.location.href = 'index.html';
        return;
      }
      const className = document.getElementById('session-class-input').value.trim();
      const gsValue = document.getElementById('session-gradesection-input').value;
      if (!className || !gsValue) {
        if (window.hottoast) window.hottoast.error('All fields required.');
        else alert('All fields required.');
        return;
      }
      const [grade, section] = gsValue.split('|');
      // Create session with className, grade, section (no duration)
      fetch('/api/qr/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ className, grade, section })
      })
        .then(res => res.json())
        .then(data => {
          if (data.sessionId) {
            if (window.hottoast) window.hottoast.success('Session created successfully!');
            sessionForm.reset();
            loadSessions();
            markAllAbsentForSession(data.sessionId);
            // Ensure attendance summary is refreshed after marking absentees
            setTimeout(loadAttendanceSummary, 500);
          } else {
            if (window.hottoast) window.hottoast.error('Error: ' + (data.message || 'Could not create session'));
            else alert('Error: ' + (data.message || 'Could not create session'));
          }
        })
        .catch(err => {
          if (window.hottoast) window.hottoast.error('Error creating session: ' + err.message);
          else alert('Error creating session: ' + err.message);
        });
    });
  }

  // --- Grade/Section Add Form Logic ---
  const gradeSectionForm = document.getElementById('add-grade-section-form');
  if (gradeSectionForm) {
    gradeSectionForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const grade = document.getElementById('grade-input').value.trim();
      const section = document.getElementById('section-input').value.trim();
      if (!grade || !section) {
        if (window.hottoast) window.hottoast.error('Both fields required');
        else alert('Both fields required');
        return;
      }
      fetch('/api/gradesection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ grade, section })
      })
        .then(res => res.json())
        .then(data => {
          if (data._id) {
            if (window.hottoast) window.hottoast.success('Grade/Section added!');
            else alert('Grade/Section added!');
            gradeSectionForm.reset();
            loadGradeSections();
            populateSessionGradeSection(); // <-- Add this line to update the dropdown
          } else {
            if (window.hottoast) window.hottoast.error(data.message || 'Error');
            else alert(data.message || 'Error');
          }
        });
    });
  }

  // --- Grade/Section List Loading and Deletion ---
  function loadGradeSections() {
    fetch('/api/gradesection', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(list => {
        const tbody = document.getElementById('grade-section-tbody');
        tbody.innerHTML = '';
        if (!Array.isArray(list) || list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No data</td></tr>';
          return;
        }
        list.forEach(gs => {
          tbody.innerHTML += `
            <tr>
              <td>${gs.grade}</td>
              <td>${gs.section}</td>
              <td>
                <button class="btn btn-success btn-sm edit-grade-section-btn me-1" data-id="${gs._id}" data-grade="${gs.grade}" data-section="${gs.section}"><i class="fa fa-edit"></i> Edit</button>
                <button class="btn btn-danger btn-sm delete-grade-section-btn" data-id="${gs._id}"><i class="fa fa-trash"></i> Delete</button>
              </td>
            </tr>
          `;
        });
        // Attach edit listeners
        Array.from(document.getElementsByClassName('edit-grade-section-btn')).forEach(btn => {
          btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');
            const grade = this.getAttribute('data-grade');
            const section = this.getAttribute('data-section');
            document.getElementById('edit-grade-section-id').value = id;
            document.getElementById('edit-grade-input').value = grade;
            document.getElementById('edit-section-input').value = section;
            const modal = new bootstrap.Modal(document.getElementById('editGradeSectionModal'));
            modal.show();
          });
        });
        // Attach delete listeners
        Array.from(document.getElementsByClassName('delete-grade-section-btn')).forEach(btn => {
          btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');
            const confirmed = await confirmAction('Delete this grade/section? This cannot be undone.');
            if (!confirmed) return;
            fetch(`/api/gradesection/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': 'Bearer ' + token }
            })
              .then(res => res.json())
              .then(data => {
                if (data.message && data.message.includes('deleted')) {
                  if (window.hottoast) window.hottoast.success('Grade/Section deleted!');
                  loadGradeSections();
                } else {
                  if (window.hottoast) window.hottoast.error(data.message || 'Error');
                }
              });
          });
        });
      })
      .catch(err => console.error('Error loading grade/sections:', err));
  }
  // Call on load and after add
  loadGradeSections();

  // --- Logout Button Logic (works on all pages) ---
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function() {
      const confirmed = await confirmAction('Are you sure you want to logout?');
      if (!confirmed) return;
      localStorage.removeItem('token');
      if (window.hottoast) window.hottoast.success('Logged out!');
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    });
  }

  // --- Tab Navigation Logic ---
  function showTab(tab) {
    const tabs = ['session', 'active', 'summary', 'students'];
    tabs.forEach(t => {
      const section = document.getElementById('section-' + t);
      const tabBtn = document.getElementById('tab-' + t);
      if (section) section.style.display = (t === tab) ? '' : 'none';
      if (tabBtn) tabBtn.classList.toggle('active', t === tab);
    });
    // If switching to summary tab, reload the summary
    if (tab === 'summary' && typeof loadAttendanceSummary === 'function') {
      loadAttendanceSummary();
    }
  }
  // Attach click listeners to tab buttons
  ['session', 'active', 'summary', 'students'].forEach(t => {
    const tabBtn = document.getElementById('tab-' + t);
    if (tabBtn) {
      tabBtn.addEventListener('click', function(e) {
        e.preventDefault();
        showTab(t);
      });
    }
  });
  // Show default tab on load
  showTab('session');
}); 

// --- Admin Student Management: Load Students ---
function loadStudents() {
  token = localStorage.getItem('token');
  fetch('/api/students', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(res => res.json())
    .then(students => {
      allStudents = students || [];
      updateStudentFilters();
      filterAndRenderStudents();
    });
}
// Modal logic for showing student QR
function showStudentQRModal(studentId, studentName) {
  let modal = document.getElementById('studentQRModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'studentQRModal';
    modal.className = 'modal fade';
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="fa fa-qrcode me-2"></i>QR Code for <span id="qr-modal-name"></span></h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center">
            <div id="qr-modal-code" style="display: flex; justify-content: center; align-items: center;"></div>
            <div class="mt-2 text-muted">Scan to identify this student</div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  // Set name
  document.getElementById('qr-modal-name').textContent = studentName;
  // Clear and render QR
  const qrDiv = document.getElementById('qr-modal-code');
  qrDiv.innerHTML = '';
  qrDiv.style.display = 'flex';
  qrDiv.style.justifyContent = 'center';
  qrDiv.style.alignItems = 'center';
  if (window.QRCode) {
    new QRCode(qrDiv, { text: studentId, width: 200, height: 200 });
  } else {
    qrDiv.textContent = studentId;
  }
  // Show modal (Bootstrap 5)
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
}
// Modal logic for viewing session attendance
function showSessionAttendanceModal(sessionId) {
  const modal = new bootstrap.Modal(document.getElementById('viewAttendanceModal'));
  const tbody = document.getElementById('session-attendance-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading...</td></tr>';
  // First, fetch the session to get grade, section, and createdAt
  fetch(`/api/qr/session/${sessionId}`, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(res => res.json())
    .then(session => {
      if (!session || !session.grade || !session.section) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Session not found or missing grade/section.</td></tr>';
        return;
      }
      const sessionDate = session.createdAt ? new Date(session.createdAt).toLocaleString() : '-';
      // Fetch all students for this grade and section
      fetch(`/api/students?grade=${encodeURIComponent(session.grade)}&section=${encodeURIComponent(session.section)}`, { headers: { 'Authorization': 'Bearer ' + token } })
        .then(res => res.json())
        .then(students => {
          // Fetch attendance records for this session
          fetch(`/api/attendance/report?sessionId=${sessionId}`, { headers: { 'Authorization': 'Bearer ' + token } })
            .then(res => res.json())
            .then(records => {
              tbody.innerHTML = '';
              if (!Array.isArray(students) || students.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No students found for this grade and section.</td></tr>';
                return;
              }
              // Map attendance by studentId and by student._id for quick lookup
              const attendanceMap = {};
              if (Array.isArray(records)) {
                records.forEach(r => {
                  if (r.student && r.student.studentId) attendanceMap[r.student.studentId] = r;
                  if (r.student && r.student._id) attendanceMap[r.student._id] = r;
                });
              }
              students.forEach(student => {
                // Try to match by _id first, then by studentId
                const r = attendanceMap[student._id] || attendanceMap[student.studentId];
                let status = 'Absent';
                let statusClass = 'text-danger fw-bold';
                let date = sessionDate;
                if (r && r.status && r.status.toLowerCase() === 'present') {
                  status = 'Present';
                  statusClass = 'text-success fw-bold';
                  date = r.date ? new Date(r.date).toLocaleString() : sessionDate;
                } else if (r) {
                  // If attendance record exists but not present, still show Absent (red)
                  date = sessionDate;
                }
                tbody.innerHTML += `<tr>
                  <td>${student.studentId}</td>
                  <td>${student.name}</td>
                  <td>${student.grade}</td>
                  <td>${student.section}</td>
                  <td class="${statusClass}">${status}</td>
                  <td>${date}</td>
                </tr>`;
              });
            });
        });
    });
  modal.show();
}
// Modal logic for scanning QR and taking attendance
function showScanQRModal(sessionId) {
  let isScanning = true; // Prevent multiple scans
  const modal = new bootstrap.Modal(document.getElementById('scanQRModal'));
  const container = document.getElementById('qr-scanner-container');
  container.innerHTML = '';
  if (window.Html5Qrcode) {
    const qrScanner = new Html5Qrcode('qr-scanner-container');
    qrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      qrCodeMessage => {
        if (!isScanning) return; // Prevent multiple scans
        isScanning = false;
        // On scan success, mark attendance
        fetch('/api/attendance/mark', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ sessionId, qrCode: qrCodeMessage })
        })
          .then(res => {
            // Save status for error handling
            return res.json().then(data => ({ status: res.status, data }));
          })
          .then(({ status, data }) => {
            if (status === 409) {
              // Student already present
              const errorModal = new bootstrap.Modal(document.getElementById('scanErrorModal'));
              document.getElementById('scan-error-message').textContent = data.message || 'This student is already marked present for this session.';
              errorModal.show();
              // Stop scanner and hide QR modal
              if (qrScanner.getState && (qrScanner.getState() === 2 || qrScanner.getState() === 3)) {
                qrScanner.stop();
              }
              modal.hide();
              return;
            }
            if (window.hottoast) window.hottoast.success(data.message || 'Attendance marked!');
            // Immediately refresh attendance summary
            if (typeof loadAttendanceSummary === 'function') {
              loadAttendanceSummary();
            }
            // Only stop if running or paused
            if (qrScanner.getState && (qrScanner.getState() === 2 || qrScanner.getState() === 3)) {
              qrScanner.stop();
            }
            modal.hide();
            // Show scan success modal with student info
            if (data.student) {
              document.getElementById('scan-success-student-name').textContent = data.student.name || '';
              document.getElementById('scan-success-grade-section').textContent = (data.student.grade && data.student.section) ? `${data.student.grade} - ${data.student.section}` : '';
            } else {
              document.getElementById('scan-success-student-name').textContent = '';
              document.getElementById('scan-success-grade-section').textContent = '';
            }
            document.getElementById('scan-success-status').textContent = 'Status: PRESENT';
            document.getElementById('scan-success-status').className = 'fw-bold text-success';
            const successModal = new bootstrap.Modal(document.getElementById('scanSuccessModal'));
            successModal.show();
            setTimeout(() => {
              successModal.hide();
              // Refresh session attendance modal if open
              if (document.getElementById('viewAttendanceModal').classList.contains('show')) {
                showSessionAttendanceModal(sessionId);
              }
              // (Optional) Refresh attendance summary again
              if (typeof loadAttendanceSummary === 'function') {
                loadAttendanceSummary();
              }
            }, 2000);
          });
      },
      errorMsg => {
        // ignore scan errors
      }
    );
    modal._element.addEventListener('hidden.bs.modal', () => {
      // Only stop if running or paused
      if (qrScanner.getState && (qrScanner.getState() === 2 || qrScanner.getState() === 3)) {
        qrScanner.stop();
      }
      isScanning = true; // Reset for next scan
    }, { once: true });
  } else {
    container.innerHTML = '<div class="alert alert-warning">QR scanner library not loaded.</div>';
  }
  modal.show();
}
// Call on load if admin dashboard
if (window.location.pathname.endsWith('admin-dashboard.html')) {
  loadStudents();
}

// --- After session creation, mark all students as absent ---
function markAllAbsentForSession(sessionId) {
  fetch('/api/attendance/mark-absent-for-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ sessionId })
  })
    .then(res => res.json())
    .then(data => {
      if (window.hottoast) window.hottoast.success(data.message || 'Marked absentees.');
    });
}

// --- Student Dashboard Logic ---
if (window.location.pathname.endsWith('student-dashboard.html')) {
  token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found in localStorage. Redirecting to login.');
    window.location.href = 'index.html';
  } else {
    console.debug('Student dashboard: using token', token);
  }
  fetch('/api/students/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(async res => {
      console.debug('Student dashboard: fetch /api/students/me response', res);
      if (!res.ok) {
        const text = await res.text();
        console.error('Student dashboard: fetch failed, status:', res.status, 'body:', text);
        throw new Error('Failed to fetch student info. Status: ' + res.status + ', Body: ' + text);
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Student dashboard: Expected JSON, got:', text);
        throw new Error('Expected JSON, got: ' + text.slice(0, 100));
      }
      return res.json();
    })
    .then(student => {
      console.debug('Student dashboard: student object', student);
      if (!student || !student.studentId || !student.name || !student.grade || !student.section) {
        document.getElementById('student-qr-code').innerHTML = '<div class="alert alert-danger">Student info incomplete. Please contact admin.</div>';
        document.getElementById('student-id').textContent = '';
        document.getElementById('student-name').textContent = '';
        document.getElementById('student-grade-section').textContent = '';
        console.error('Student dashboard: Incomplete student info', student);
        return;
      }
      // Fill new card layout
      const qrDiv = document.getElementById('student-qr-code');
      qrDiv.innerHTML = '';
      qrDiv.style.display = 'flex';
      qrDiv.style.justifyContent = 'center';
      qrDiv.style.alignItems = 'center';
      if (window.QRCode && student.studentId) {
        new QRCode(qrDiv, {
          text: student.studentId,
          width: 200,
          height: 200
        });
      } else {
        qrDiv.textContent = student.studentId || '-';
      }
      document.getElementById('student-name').textContent = student.name || '-';
      document.getElementById('student-grade-section').textContent = (student.grade && student.section) ? `${student.grade} - ${student.section}` : '-';
      document.getElementById('student-id').textContent = student.studentId || '-';
    })
    .catch(err => {
      document.getElementById('student-qr-code').innerHTML = '<div class="alert alert-danger">Failed to load student info. Check console for details.</div>';
      document.getElementById('student-id').textContent = '';
      document.getElementById('student-name').textContent = '';
      document.getElementById('student-grade-section').textContent = '';
      console.error('Student dashboard error:', err);
    });
} 

// --- Grade/Section Edit Functionality ---
// Add edit button to each grade-section row
function loadGradeSections() {
  fetch('/api/gradesection', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(res => res.json())
    .then(list => {
      const tbody = document.getElementById('grade-section-tbody');
      tbody.innerHTML = '';
      if (!Array.isArray(list) || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No data</td></tr>';
        return;
      }
      list.forEach(gs => {
        tbody.innerHTML += `
          <tr>
            <td>${gs.grade}</td>
            <td>${gs.section}</td>
            <td>
              <button class="btn btn-success btn-sm edit-grade-section-btn me-1" data-id="${gs._id}" data-grade="${gs.grade}" data-section="${gs.section}"><i class="fa fa-edit"></i> Edit</button>
              <button class="btn btn-danger btn-sm delete-grade-section-btn" data-id="${gs._id}"><i class="fa fa-trash"></i> Delete</button>
            </td>
          </tr>
        `;
      });
      // Attach edit listeners for grade-section
      Array.from(document.getElementsByClassName('edit-grade-section-btn')).forEach(btn => {
        btn.addEventListener('click', async function() {
          const id = this.getAttribute('data-id');
          const grade = this.getAttribute('data-grade');
          const section = this.getAttribute('data-section');
          const confirmed = await confirmAction('Are you sure you want to edit this Grade/Section?');
          if (!confirmed) return;
          document.getElementById('edit-grade-section-id').value = id;
          document.getElementById('edit-grade-input').value = grade;
          document.getElementById('edit-section-input').value = section;
          const modal = new bootstrap.Modal(document.getElementById('editGradeSectionModal'));
          modal.show();
        });
      });
      // Attach delete listeners
      Array.from(document.getElementsByClassName('delete-grade-section-btn')).forEach(btn => {
        btn.addEventListener('click', async function() {
          const id = this.getAttribute('data-id');
          const confirmed = await confirmAction('Delete this grade/section? This cannot be undone.');
          if (!confirmed) return;
          fetch(`/api/gradesection/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
          })
            .then(res => res.json())
            .then(data => {
              if (data.message && data.message.includes('deleted')) {
                if (window.hottoast) window.hottoast.success('Grade/Section deleted!');
                loadGradeSections();
              } else {
                if (window.hottoast) window.hottoast.error(data.message || 'Error');
              }
            });
        });
      });
    })
    .catch(err => console.error('Error loading grade/sections:', err));
}
// Attach submit handler for edit-grade-section-form
const editGSForm = document.getElementById('edit-grade-section-form');
if (editGSForm) {
  editGSForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const confirmed = await confirmAction('Are you sure you want to update this Grade/Section?');
    if (!confirmed) return;
    const id = document.getElementById('edit-grade-section-id').value;
    const grade = document.getElementById('edit-grade-input').value.trim();
    const section = document.getElementById('edit-section-input').value.trim();
    if (!id || !grade || !section) {
      if (window.hottoast) window.hottoast.error('All fields required');
      else alert('All fields required');
      return;
    }
    fetch(`/api/gradesection/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ grade, section })
    })
      .then(res => res.json())
      .then(data => {
        if (data._id) {
          if (window.hottoast) window.hottoast.success('Grade/Section updated!');
          loadGradeSections();
          const modal = bootstrap.Modal.getInstance(document.getElementById('editGradeSectionModal'));
          if (modal) modal.hide();
        } else {
          if (window.hottoast) window.hottoast.error(data.message || 'Error');
        }
      });
  });
}

// --- Registration: Ensure grade and section are included and sent ---
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const confirmed = await confirmAction('Are you sure you want to register this student?');
    if (!confirmed) return;
    const name = document.getElementById('register-name').value.trim();
    const studentId = document.getElementById('register-studentid').value.trim();
    const grade = document.getElementById('register-grade').value;
    const section = document.getElementById('register-section').value;
    const password = document.getElementById('register-password').value;
    if (!name || !studentId || !grade || !section || !password) {
      if (window.hottoast) window.hottoast.error('All fields required');
      else alert('All fields required');
      return;
    }
    fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, studentId, grade, section, password })
    })
      .then(res => res.json())
      .then(data => {
        if (data.message && data.message.includes('added')) {
          if (window.hottoast) window.hottoast.success('Registration successful!');
          registerForm.reset();
          setTimeout(() => { window.location.href = 'index.html'; }, 1200);
        } else {
          if (window.hottoast) window.hottoast.error(data.message || 'Error');
        }
      });
  });
} 

// --- Confirmation Modal Utility ---
function confirmAction(message) {
  return new Promise((resolve) => {
    const modal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    document.getElementById('confirmationModalMessage').textContent = message;
    const confirmBtn = document.getElementById('confirmationModalConfirmBtn');
    // Remove previous listeners
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', () => {
      modal.hide();
      resolve(true);
    });
    // Cancel just closes modal
    document.querySelector('#confirmationModal .btn-secondary').onclick = () => {
      modal.hide();
      resolve(false);
    };
    modal.show();
  });
} 

// --- Admin Profile Modal Logic ---
const adminProfileForm = document.getElementById('admin-profile-form');
const adminProfileUsername = document.getElementById('admin-profile-username');
const adminProfilePassword = document.getElementById('admin-profile-password');

// Prefill username when modal is shown
const adminProfileModal = document.getElementById('adminProfileModal');
if (adminProfileModal) {
  adminProfileModal.addEventListener('show.bs.modal', function () {
    // Try to get admin name from token
    let adminName = '';
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      adminName = tokenData.name || '';
    } catch (e) {}
    adminProfileUsername.value = adminName;
    adminProfilePassword.value = '';
  });
}

if (adminProfileForm) {
  adminProfileForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = adminProfileUsername.value.trim();
    const password = adminProfilePassword.value.trim();
    if (!name) {
      if (window.hottoast) window.hottoast.error('Username is required');
      return;
    }
    fetch('/api/admin/update', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(password ? { name, password } : { name })
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.message && data.message.includes('updated')) {
          if (window.hottoast) window.hottoast.success('Profile updated! Please log in again.');
          // Log out after short delay to refresh token
          setTimeout(() => {
            localStorage.removeItem('token');
            window.location.href = 'index.html';
          }, 1200);
        } else {
          if (window.hottoast) window.hottoast.error(data.message || 'Update failed');
        }
      })
      .catch(err => {
        if (window.hottoast) window.hottoast.error('Error: ' + err.message);
      });
  });
} 

// --- Student Management Filtering Logic ---
const studentSearchInput = document.getElementById('student-search');
const filterGradeSelect = document.getElementById('filter-grade');
const filterSectionSelect = document.getElementById('filter-section');
let allStudents = [];

function renderStudentTable(students) {
  const tbody = document.querySelector('#students-table tbody');
  tbody.innerHTML = '';
  if (!Array.isArray(students) || students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No students found</td></tr>';
    return;
  }
  students.forEach(student => {
    tbody.innerHTML += `
      <tr>
        <td>${student.studentId || '-'}</td>
        <td>${student.name}</td>
        <td>${student.grade}</td>
        <td>${student.section}</td>
        <td>
          <button class="btn btn-outline-primary btn-sm view-qr-btn" data-studentid="${student.studentId}" data-name="${student.name}"><i class="fa fa-qrcode"></i> View QR</button>
          <button class="btn btn-success btn-sm edit-student-btn ms-1" data-id="${student._id}" data-name="${student.name}" data-studentid="${student.studentId}" data-grade="${student.grade}" data-section="${student.section}"><i class="fa fa-edit"></i> Edit</button>
          <button class="btn btn-danger btn-sm delete-student-btn ms-1" data-id="${student._id}" data-name="${student.name}"><i class="fa fa-trash"></i> Delete</button>
        </td>
      </tr>
    `;
  });
  // Re-attach listeners for new rows
  Array.from(document.getElementsByClassName('delete-student-btn')).forEach(btn => {
    btn.addEventListener('click', async function() {
      const id = this.getAttribute('data-id');
      const name = this.getAttribute('data-name');
      const confirmed = await confirmAction(`Delete student '${name}'? This cannot be undone.`);
      if (!confirmed) return;
      fetch(`/api/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      })
        .then(res => res.json())
        .then(data => {
          if (data.message && data.message.includes('deleted')) {
            if (window.hottoast) window.hottoast.success('Student deleted!');
            loadStudents();
          } else {
            if (window.hottoast) window.hottoast.error(data.message || 'Error');
          }
        });
    });
  });
  Array.from(document.getElementsByClassName('view-qr-btn')).forEach(btn => {
    btn.addEventListener('click', function() {
      const studentId = this.getAttribute('data-studentid');
      const name = this.getAttribute('data-name');
      showStudentQRModal(studentId, name);
    });
  });
  Array.from(document.getElementsByClassName('edit-student-btn')).forEach(btn => {
    btn.addEventListener('click', async function() {
      const id = this.getAttribute('data-id');
      const name = this.getAttribute('data-name');
      const studentId = this.getAttribute('data-studentid');
      const grade = this.getAttribute('data-grade');
      const section = this.getAttribute('data-section');
      document.getElementById('edit-student-id').value = id;
      document.getElementById('edit-student-name').value = name;
      document.getElementById('edit-student-studentid').value = studentId;
      // Populate grade/section dropdowns
      fetch('/api/gradesection', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(res => res.json())
        .then(list => {
          const gradeSelect = document.getElementById('edit-student-grade');
          const sectionSelect = document.getElementById('edit-student-section');
          gradeSelect.innerHTML = '';
          sectionSelect.innerHTML = '';
          const grades = [...new Set(list.map(gs => gs.grade))];
          grades.forEach(g => {
            gradeSelect.innerHTML += `<option value="${g}">${g}</option>`;
          });
          const sections = [...new Set(list.map(gs => gs.section))];
          sections.forEach(s => {
            sectionSelect.innerHTML += `<option value="${s}">${s}</option>`;
          });
          gradeSelect.value = grade;
          sectionSelect.value = section;
        });
      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('editStudentModal'));
      modal.show();
      // Update QR code preview on studentId change
      const studentIdInput = document.getElementById('edit-student-studentid');
      const qrPreviewDiv = document.getElementById('edit-student-qr-preview');
      if (qrPreviewDiv) {
        qrPreviewDiv.innerHTML = '';
        if (window.QRCode && studentId) {
          new QRCode(qrPreviewDiv, { text: studentId, width: 120, height: 120 });
        } else {
          qrPreviewDiv.textContent = studentId || '-';
        }
      }
      studentIdInput.addEventListener('input', function() {
        if (qrPreviewDiv) {
          qrPreviewDiv.innerHTML = '';
          if (window.QRCode && this.value) {
            new QRCode(qrPreviewDiv, { text: this.value, width: 120, height: 120 });
          } else {
            qrPreviewDiv.textContent = this.value || '-';
          }
        }
      });
    });
  });
}

function updateStudentFilters() {
  // Populate grade and section dropdowns from allStudents
  const grades = [...new Set(allStudents.map(s => s.grade))].sort();
  const sections = [...new Set(allStudents.map(s => s.section))].sort();
  filterGradeSelect.innerHTML = '<option value="">All Grades</option>' + grades.map(g => `<option value="${g}">${g}</option>`).join('');
  filterSectionSelect.innerHTML = '<option value="">All Sections</option>' + sections.map(s => `<option value="${s}">${s}</option>`).join('');
}

function filterAndRenderStudents() {
  let filtered = allStudents;
  const search = studentSearchInput.value.trim().toLowerCase();
  const grade = filterGradeSelect.value;
  const section = filterSectionSelect.value;
  if (search) {
    filtered = filtered.filter(s => s.name.toLowerCase().includes(search));
  }
  if (grade) {
    filtered = filtered.filter(s => s.grade === grade);
  }
  if (section) {
    filtered = filtered.filter(s => s.section === section);
  }
  renderStudentTable(filtered);
}

if (studentSearchInput && filterGradeSelect && filterSectionSelect) {
  studentSearchInput.addEventListener('input', filterAndRenderStudents);
  filterGradeSelect.addEventListener('change', filterAndRenderStudents);
  filterSectionSelect.addEventListener('change', filterAndRenderStudents);
} 

// Download attendance as Excel for a session
function downloadAttendanceExcel(sessionId) {
  if (!sessionId) return;
  // Fetch session details for filename
  fetch(`/api/qr/session/${sessionId}`, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(res => res.json())
    .then(session => {
      if (!session || !session.className || !session.grade || !session.section || !session.createdAt) {
        if (window.hottoast) window.hottoast.error('Session details not found');
        return;
      }
      const className = session.className.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
      const grade = session.grade.replace(/[^a-zA-Z0-9-_ ]/g, '');
      const section = session.section.replace(/[^a-zA-Z0-9-_ ]/g, '');
      const date = new Date(session.createdAt);
      const dateStr = date.toISOString().slice(0,10); // YYYY-MM-DD
      const filename = `${className}_${grade}-${section}_${dateStr}.xlsx`;
      // Now fetch attendance data
      fetch(`/api/attendance/report?sessionId=${sessionId}`, { headers: { 'Authorization': 'Bearer ' + token } })
        .then(res => res.json())
        .then(records => {
          if (!Array.isArray(records) || records.length === 0) {
            if (window.hottoast) window.hottoast.error('No attendance data for this session.');
            return;
          }
          // Prepare data for Excel
          const data = records.map(r => ({
            'Student ID': r.student && r.student.studentId ? r.student.studentId : '-',
            'Name': r.student && r.student.name ? r.student.name : '-',
            'Grade': r.student && r.student.grade ? r.student.grade : '-',
            'Section': r.student && r.student.section ? r.student.section : '-',
            'Status': r.status || '-',
            'Date': r.date ? new Date(r.date).toLocaleString() : '-'
          }));
          const ws = XLSX.utils.json_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
          XLSX.writeFile(wb, filename);
        })
        .catch(err => {
          if (window.hottoast) window.hottoast.error('Download failed');
          console.error('Excel download error:', err);
        });
    })
    .catch(err => {
      if (window.hottoast) window.hottoast.error('Session fetch failed');
      console.error('Session fetch error:', err);
    });
} 