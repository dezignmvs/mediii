import { auth, db } from './firebase-config.js';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Session check
if (localStorage.getItem('adminAuthenticated') !== 'true') {
    window.location.href = 'login.html';
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('adminAuthenticated');
        window.location.href = 'login.html';
    });
}

// Global state
let currentGroups = [];

// Initialize Dashboard
async function init() {
    await loadDashboardData();
}

async function loadDashboardData() {
    try {
        // Load counts
        const candSnap = await getDocs(collection(db, 'Candidates'));
        document.getElementById('stat-students').textContent = candSnap.size;

        const groupsSnap = await getDocs(collection(db, 'Groups'));
        document.getElementById('stat-groups').textContent = groupsSnap.size;
        currentGroups = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const notifsSnap = await getDocs(collection(db, 'Notifications'));
        document.getElementById('stat-notifs').textContent = notifsSnap.size;

        renderGroupsTable(groupsSnap);
        populateGroupDropdowns(currentGroups);

    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

function renderGroupsTable(groupsSnap) {
    const container = document.getElementById('groups-table-body');
    if (!container) return;

    if (!groupsSnap || groupsSnap.empty) {
        container.innerHTML = `<div class="col-span-full py-12 text-center text-graytext font-medium bg-white rounded-2xl shadow-soft">No groups found. Create one to get started.</div>`;
        return;
    }

    let html = '';
    const gradients = [
        'from-primaryDark to-primaryLight',
        'from-[#FFAB00] to-[#FFD666]',
        'from-[#FF4842] to-[#FF9C99]',
        'from-[#1890FF] to-[#74CAFF]'
    ];
    let gradIdx = 0;

    groupsSnap.forEach(docSnap => {
        const data = docSnap.data();
        const initial = data.groupName ? data.groupName.charAt(0).toUpperCase() : 'G';
        const grad = gradients[gradIdx % gradients.length];
        gradIdx++;

        html += `
            <div class="bg-white rounded-2xl shadow-soft overflow-hidden group-card cursor-pointer group flex flex-col hover:-translate-y-1 smooth-hover" data-id="${docSnap.id}" data-name="${data.groupName}">
                <div class="h-24 bg-gradient-to-r ${grad} relative">
                    <div class="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
                </div>
                <div class="flex justify-center -mt-8 relative z-10">
                    <div class="w-16 h-16 bg-white rounded-full p-1 shadow-soft">
                        <div class="w-full h-full rounded-full bg-light text-primary flex items-center justify-center font-bold text-xl uppercase">
                            ${initial}
                        </div>
                    </div>
                </div>
                <div class="p-6 text-center pb-8 flex-1">
                    <h3 class="font-bold text-dark text-lg group-hover:text-primary smooth-hover">${data.groupName}</h3>
                    <p class="text-xs text-graytext uppercase font-semibold mt-1">${data.class || 'Section'}</p>
                    
                    <div class="flex justify-center gap-3 mt-4">
                        <div class="w-8 h-8 rounded-full bg-light text-graytext flex items-center justify-center hover:text-primary hover:bg-[#E1F3EA] smooth-hover">
                            <iconify-icon icon="mynaui:edit-one" class="text-lg"></iconify-icon>
                        </div>
                        <div class="w-8 h-8 rounded-full bg-light text-graytext flex items-center justify-center hover:text-primary hover:bg-[#E1F3EA] smooth-hover">
                            <iconify-icon icon="mynaui:chart-bar" class="text-lg"></iconify-icon>
                        </div>
                    </div>
                </div>
                <div class="border-t border-bordercolor border-dashed grid grid-cols-2 divide-x divide-bordercolor divide-dashed py-4 text-center bg-[#F9FAFB]">
                    <div>
                        <p class="text-xs text-graytext mb-1">Students</p>
                        <p class="font-bold text-dark text-sm">${data.membersCount || 0}</p>
                    </div>
                    <div>
                        <p class="text-[11px] font-bold text-primary uppercase mt-1.5 tracking-wider">Manage <iconify-icon icon="mynaui:arrow-right"></iconify-icon></p>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;

    // Attach click events
    document.querySelectorAll('.group-card').forEach(card => {
        card.addEventListener('click', () => {
            openStudentAdder(card.getAttribute('data-id'), card.getAttribute('data-name'));
        });
    });
}

// Student Adder Logic
function openStudentAdder(groupId, groupName) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById('student-adder-view').classList.add('active');
    document.getElementById('student-adder-title').textContent = groupName;
    document.getElementById('add-student-form').setAttribute('data-target-group', groupId);
    loadStudentsForAdder(groupId);
}

document.getElementById('btn-back-to-groups').addEventListener('click', () => {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById('group-view').classList.add('active');
});

async function loadStudentsForAdder(groupId) {
    const list = document.getElementById('students-table-body');
    list.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-graytext">Loading...</td></tr>';
    
    try {
        const q = query(collection(db, 'Candidates'), where('group', '==', groupId));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            list.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-graytext">No students yet.</td></tr>';
            return;
        }

        let html = '';
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : '-';
            html += `
                <tr class="hover:bg-[#F9FAFB] transition-colors">
                    <td class="px-6 py-4 font-semibold text-dark">${data.name}</td>
                    <td class="px-6 py-4 text-graytext text-sm">${data.class || '-'}</td>
                    <td class="px-6 py-4 text-graytext text-sm">${date}</td>
                    <td class="px-6 py-4 text-right">
                        <button class="text-graytext hover:text-primary transition-colors mx-1" onclick="editStudent('${docSnap.id}', '${data.name}', '${data.class || ''}', '${groupId}')" title="Edit">
                            <iconify-icon icon="mynaui:edit-one" class="text-xl"></iconify-icon>
                        </button>
                        <button class="text-graytext hover:text-[#FF4842] transition-colors mx-1" onclick="deleteStudent('${docSnap.id}', '${groupId}')" title="Delete">
                            <iconify-icon icon="mynaui:trash-one" class="text-xl"></iconify-icon>
                        </button>
                    </td>
                </tr>
            `;
        });
        list.innerHTML = html;
    } catch (err) {
        console.error(err);
        list.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-[#FF4842]">Error loading students.</td></tr>';
    }
}

document.getElementById('add-student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = 'Adding...'; btn.disabled = true;

    const groupId = e.target.getAttribute('data-target-group');
    const name = document.getElementById('student-name').value.trim();
    const studentClass = document.getElementById('student-class').value.trim();

    try {
        await addDoc(collection(db, 'Candidates'), {
            name: name,
            class: studentClass,
            group: groupId,
            hasCredentials: false,
            createdAt: serverTimestamp()
        });
        e.target.reset();
        loadStudentsForAdder(groupId);
    } catch(err) {
        console.error(err);
        alert('Error adding student');
    } finally {
        btn.innerHTML = ogText; btn.disabled = false;
    }
});

// Expose global functions for inline handlers
window.deleteStudent = async function(studentId, groupId) {
    if(!confirm("Are you sure you want to delete this student?")) return;
    try {
        await deleteDoc(doc(db, 'Candidates', studentId));
        loadStudentsForAdder(groupId);
    } catch(err) {
        console.error(err); alert('Error deleting student');
    }
};

window.editStudent = async function(studentId, currentName, currentClass, groupId) {
    const newName = prompt("Enter new name:", currentName);
    if(newName === null) return;
    const newClass = prompt("Enter new class / section:", currentClass);
    if(newClass === null) return;
    
    try {
        await updateDoc(doc(db, 'Candidates', studentId), {
            name: newName.trim(),
            class: newClass.trim()
        });
        loadStudentsForAdder(groupId);
    } catch(err) {
        console.error(err); alert('Error updating student');
    }
};

// Group Creation
document.getElementById('add-group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = 'Creating...'; btn.disabled = true;

    const groupName = document.getElementById('group-name').value.trim();
    const groupClass = document.getElementById('group-section').value.trim();

    try {
        await addDoc(collection(db, 'Groups'), {
            groupName: groupName,
            class: groupClass,
            membersCount: 0,
            createdAt: serverTimestamp()
        });
        e.target.reset();
        await loadDashboardData();
    } catch (error) {
        console.error("Error creating group:", error);
    } finally {
        btn.innerHTML = ogText; btn.disabled = false;
    }
});

// Populate Dropdowns
function populateGroupDropdowns(groups) {
    const selects = ['cred-group-select', 'notif-target', 'task-target', 'att-group-select'];
    
    selects.forEach(id => {
        const select = document.getElementById(id);
        if(!select) return;
        
        const defaultOpt = select.options[0];
        select.innerHTML = '';
        if(defaultOpt) select.appendChild(defaultOpt);

        groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id; 
            opt.textContent = g.groupName;
            select.appendChild(opt);
        });
    });
}

// Credentials Manager
const credSelect = document.getElementById('cred-group-select');
let currentNoCreds = [];

credSelect.addEventListener('change', async (e) => {
    const groupId = e.target.value;
    const tbody = document.getElementById('credentials-table-body');
    const btnSave = document.getElementById('btn-save-credentials');
    
    if(!groupId) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-graytext">Select a group to load candidates.</td></tr>';
        return;
    }

    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-graytext">Loading...</td></tr>';
    btnSave.innerHTML = '<iconify-icon icon="mynaui:save"></iconify-icon> Save Changes';

    try {
        const q = query(collection(db, 'Candidates'), where('group', '==', groupId));
        const snap = await getDocs(q);

        currentNoCreds = [];
        snap.forEach(docSnap => {
            currentNoCreds.push({id: docSnap.id, ...docSnap.data()});
        });

        if (currentNoCreds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-primary font-bold bg-[#E1F3EA]">No students found in this group.</td></tr>';
            return;
        }

        let html = '';
        currentNoCreds.forEach((data, index) => {
            const namePart = (data.name || 'cand').replace(/\s+/g, '').toLowerCase();
            const genUser = data.username || (namePart + Math.floor(Math.random()*1000));
            const genPass = data.password || Math.random().toString(36).slice(-6).toUpperCase();
            
            const statusBadge = data.hasCredentials 
                ? '<span class="px-2 py-1 bg-[#E1F3EA] text-[#00A76F] text-xs font-bold rounded-lg">Active</span>'
                : '<span class="px-2 py-1 bg-[#FFF5CC] text-[#FFAB00] text-xs font-bold rounded-lg">Pending</span>';

            // Assign back to array so we can save later
            currentNoCreds[index].genUser = genUser;
            currentNoCreds[index].genPass = genPass;

            html += `
                <tr class="hover:bg-[#F9FAFB]">
                    <td class="px-6 py-4 font-semibold text-dark">${data.name}</td>
                    <td class="px-6 py-4 text-graytext text-sm">${data.class || '-'}</td>
                    <td class="px-6 py-4"><input type="text" value="${genUser}" class="cred-user-input w-full px-3 py-2 bg-white border border-bordercolor rounded-lg text-sm" data-idx="${index}"></td>
                    <td class="px-6 py-4"><input type="text" value="${genPass}" class="cred-pass-input w-full px-3 py-2 bg-white border border-bordercolor rounded-lg font-mono text-sm" data-idx="${index}"></td>
                    <td class="px-6 py-4 text-center">${statusBadge}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        
        // Listen to edits
        document.querySelectorAll('.cred-user-input').forEach(inp => {
            inp.addEventListener('input', (e) => { currentNoCreds[e.target.dataset.idx].genUser = e.target.value; });
        });
        document.querySelectorAll('.cred-pass-input').forEach(inp => {
            inp.addEventListener('input', (e) => { currentNoCreds[e.target.dataset.idx].genPass = e.target.value; });
        });

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-[#FF4842]">Error loading data.</td></tr>';
    }
});

document.getElementById('btn-save-credentials').addEventListener('click', async (e) => {
    if(currentNoCreds.length === 0) return alert("No credentials to save.");
    
    const btn = e.target;
    btn.innerHTML = '<iconify-icon icon="mynaui:spinner" class="animate-spin"></iconify-icon> Saving...';
    btn.disabled = true;

    try {
        const promises = currentNoCreds.map(cand => {
            return updateDoc(doc(db, 'Candidates', cand.id), {
                username: cand.genUser,
                password: cand.genPass,
                hasCredentials: true
            });
        });
        await Promise.all(promises);
        
        btn.innerHTML = '<iconify-icon icon="mynaui:check-circle"></iconify-icon> Saved!';
        btn.classList.replace('bg-primary', 'bg-dark');
        currentNoCreds = [];
        
        setTimeout(() => {
            btn.innerHTML = '<iconify-icon icon="mynaui:save"></iconify-icon> Save Changes';
            btn.classList.replace('bg-dark', 'bg-primary');
            btn.disabled = false;
            // trigger refresh
            credSelect.dispatchEvent(new Event('change'));
        }, 2000);

    } catch (err) {
        console.error(err);
        alert('Error saving credentials.');
        btn.innerHTML = '<iconify-icon icon="mynaui:save"></iconify-icon> Save Changes';
        btn.disabled = false;
    }
});

// Notifications
document.getElementById('send-notification-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = 'Sending...'; btn.disabled = true;

    const target = document.getElementById('notif-target').value;
    const title = document.getElementById('notif-title').value;
    const message = document.getElementById('notif-message').value;
    const type = document.querySelector('input[name="notif-type"]:checked').value;

    try {
        await addDoc(collection(db, 'Notifications'), {
            title, message, type,
            targetType: target === 'public' ? 'public' : 'group',
            targetIds: target === 'public' ? ['public'] : [target],
            createdAt: serverTimestamp()
        });
        e.target.reset();
        alert('Broadcast sent successfully!');
    } catch (error) {
        console.error(error);
    } finally {
        btn.innerHTML = ogText; btn.disabled = false;
    }
});

// Tasks
document.getElementById('create-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = 'Deploying...'; btn.disabled = true;

    const target = document.getElementById('task-target').value;
    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-description').value;
    const deadline = document.getElementById('task-deadline').value;
    const icon = document.getElementById('task-icon').value;

    try {
        await addDoc(collection(db, 'Tasks'), {
            title, description: desc, deadline, icon, progress: 0,
            targetType: target === 'public' ? 'public' : 'group',
            targetIds: target === 'public' ? ['public'] : [target],
            createdAt: serverTimestamp()
        });
        e.target.reset();
        alert('Task deployed successfully!');
    } catch (error) {
        console.error(error);
    } finally {
        btn.innerHTML = ogText; btn.disabled = false;
    }
});
// ----------------------------------------------------
// ATTENDANCE MODULE
// ----------------------------------------------------

// Tab Logic
document.querySelectorAll('.att-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.att-tab').forEach(b => {
            b.classList.remove('active', 'bg-white', 'shadow-sm', 'text-dark');
            b.classList.add('text-graytext');
        });
        e.target.classList.add('active', 'bg-white', 'shadow-sm', 'text-dark');
        e.target.classList.remove('text-graytext');
        
        document.querySelectorAll('.att-pane').forEach(p => p.classList.add('hidden'));
        document.getElementById(e.target.dataset.target).classList.remove('hidden');
        
        if (e.target.dataset.target === 'att-report') loadAbsentReport();
        if (e.target.dataset.target === 'att-calendar') renderCalendar();
    });
});

// Mark Absence
const attSelect = document.getElementById('att-group-select');
if (attSelect) {
    attSelect.addEventListener('change', async (e) => {
        const groupId = e.target.value;
        const tbody = document.getElementById('att-mark-table-body');
        if(!groupId) {
            tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-graytext">Select a group to load students.</td></tr>';
            return;
        }
        tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-graytext">Loading...</td></tr>';
        try {
            const q = query(collection(db, 'Candidates'), where('group', '==', groupId));
            const snap = await getDocs(q);
            if (snap.empty) {
                tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-primary font-bold bg-[#E1F3EA]">No students found.</td></tr>';
                return;
            }
            let html = '';
            snap.forEach(docSnap => {
                const data = docSnap.data();
                html += `
                    <tr class="hover:bg-[#F9FAFB]">
                        <td class="px-6 py-4 font-semibold text-dark">${data.name}</td>
                        <td class="px-6 py-4 text-graytext text-sm">${data.class || '-'}</td>
                        <td class="px-6 py-4 text-right">
                            <button class="bg-[#FFE4DE] text-[#FF4842] hover:bg-[#FF4842] hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors" onclick="markAbsent('${docSnap.id}', '${data.name}', '${data.class || ''}', '${groupId}')">Mark Absent</button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch(err) {
            console.error(err);
        }
    });
}

window.markAbsent = async function(candId, name, candClass, groupId) {
    const today = new Date().toISOString().split('T')[0];
    try {
        const q = query(collection(db, 'Absences'), where('candidateId', '==', candId), where('date', '==', today));
        const snap = await getDocs(q);
        if(!snap.empty) {
            alert('Student is already marked absent for today.');
            return;
        }
        await addDoc(collection(db, 'Absences'), {
            candidateId: candId,
            candidateName: name,
            candidateClass: candClass,
            groupId: groupId,
            date: today,
            timestamp: serverTimestamp()
        });
        alert('Marked absent successfully!');
    } catch(err) {
        console.error(err); alert('Failed to mark absent');
    }
};

// Absent Report
const reportDateInput = document.getElementById('att-report-date');
if (reportDateInput) {
    reportDateInput.value = new Date().toISOString().split('T')[0];
    reportDateInput.addEventListener('change', loadAbsentReport);
}

async function loadAbsentReport() {
    const dateStr = reportDateInput.value;
    const container = document.getElementById('att-report-container');
    container.innerHTML = '<div class="col-span-full py-12 text-center text-graytext">Loading...</div>';
    
    if(!dateStr) return;
    
    try {
        const q = query(collection(db, 'Absences'), where('date', '==', dateStr));
        const snap = await getDocs(q);
        if(snap.empty) {
            container.innerHTML = '<div class="col-span-full py-12 text-center text-primary font-bold bg-[#E1F3EA] rounded-xl">No absences registered for this date.</div>';
            return;
        }
        let html = '';
        snap.forEach(docSnap => {
            const data = docSnap.data();
            html += `
                <div class="bg-white p-5 rounded-2xl shadow-soft border border-bordercolor border-dashed hover:border-primary/30 transition-colors">
                    <div class="flex justify-between items-start mb-3">
                        <div class="w-10 h-10 bg-[#FFE4DE] text-[#FF4842] rounded-full flex items-center justify-center">
                            <iconify-icon icon="mynaui:user-x" class="text-xl"></iconify-icon>
                        </div>
                        <span class="text-[10px] font-bold text-graytext uppercase tracking-wider px-2 py-1 bg-light rounded-md">${data.date}</span>
                    </div>
                    <h4 class="font-bold text-dark text-lg">${data.candidateName}</h4>
                    <p class="text-sm text-graytext mt-1">Class: <span class="font-semibold text-dark">${data.candidateClass || '-'}</span></p>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch(err) {
        console.error(err);
    }
}

// Calendar View
let currentCalDate = new Date();

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const title = document.getElementById('calendar-month-year');
    if (!grid) return;
    
    const month = currentCalDate.getMonth();
    const year = currentCalDate.getFullYear();
    title.textContent = currentCalDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });
    
    grid.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // blanks
    for(let i=0; i<firstDay; i++) {
        grid.innerHTML += `<div class="aspect-square bg-transparent"></div>`;
    }
    
    getDocs(collection(db, 'Absences')).then(snap => {
        const absentDates = new Set();
        snap.forEach(docSnap => absentDates.add(docSnap.data().date));
        
        for(let day=1; day<=daysInMonth; day++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const hasAbsence = absentDates.has(dateStr);
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            
            let classes = "aspect-square rounded-xl flex items-center justify-center text-sm font-bold cursor-pointer smooth-hover border border-bordercolor border-dashed hover:border-primary ";
            if (isToday) classes += "bg-primary text-white";
            else if (hasAbsence) classes += "bg-[#FFE4DE] text-[#FF4842]";
            else classes += "bg-white text-dark hover:bg-light";
            
            grid.innerHTML += `<div class="${classes}" onclick="selectCalendarDate('${dateStr}')">${day}</div>`;
        }
    });
}

window.selectCalendarDate = function(dateStr) {
    document.querySelector('.att-tab[data-target="att-report"]').click();
    reportDateInput.value = dateStr;
    loadAbsentReport();
};

const calPrev = document.getElementById('cal-prev');
const calNext = document.getElementById('cal-next');
if (calPrev) calPrev.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() - 1); renderCalendar(); });
if (calNext) calNext.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() + 1); renderCalendar(); });

// Startup
init();
