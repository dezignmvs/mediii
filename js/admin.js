import { auth, db } from './firebase-config.js';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
let validUsernames = new Set();

// Toast Notification
window.showToast = function(message, type = 'success') {
    const toastContainerId = 'toast-container';
    let container = document.getElementById(toastContainerId);
    if (!container) {
        container = document.createElement('div');
        container.id = toastContainerId;
        container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const icon = type === 'success' ? 'mynaui:check-circle' : 'mynaui:x-circle';
    const color = type === 'success' ? 'text-primary' : 'text-[#FF4842]';
    toast.className = `bg-white rounded-full shadow-soft px-4 py-3 flex items-center gap-3 transition-all duration-300 transform -translate-y-4 opacity-0 border border-bordercolor pointer-events-auto`;
    toast.innerHTML = `<iconify-icon icon="${icon}" class="text-xl ${color}"></iconify-icon><span class="text-sm font-bold text-dark">${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('-translate-y-4', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('-translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Initialize Dashboard
async function init() {
    await loadDashboardData();
    loadAdminNotifications();
    loadAdminTasks();
}

async function loadDashboardData() {
    try {
        // Load counts
        const candSnap = await getDocs(collection(db, 'Candidates'));
        document.getElementById('stat-students').textContent = candSnap.size;
        
        validUsernames.clear();
        candSnap.forEach(doc => {
            const data = doc.data();
            if (data.username) validUsernames.add(data.username);
        });

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
        showToast('Error adding student', 'error');
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
        console.error(err); showToast('Error deleting student', 'error');
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
        console.error(err); showToast('Error updating student', 'error');
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
    const selects = ['cred-group-select', 'att-group-select'];
    
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

    const notifCheckboxes = document.getElementById('notif-groups-checkboxes');
    if (notifCheckboxes) {
        notifCheckboxes.innerHTML = '';
        groups.forEach(g => {
            const label = document.createElement('label');
            label.className = "flex items-center gap-2 cursor-pointer p-1.5 hover:bg-light rounded smooth-hover";
            label.innerHTML = `
                <input type="checkbox" name="notif-group-cb" value="${g.id}" class="text-primary focus:ring-primary h-4 w-4 rounded border-bordercolor">
                <span class="text-sm font-medium text-dark truncate">${g.groupName}</span>
            `;
            notifCheckboxes.appendChild(label);
        });
    }

    const taskCheckboxes = document.getElementById('task-groups-checkboxes');
    if (taskCheckboxes) {
        taskCheckboxes.innerHTML = '';
        groups.forEach(g => {
            const label = document.createElement('label');
            label.className = "flex items-center gap-2 cursor-pointer p-1.5 hover:bg-light rounded smooth-hover";
            label.innerHTML = `
                <input type="checkbox" name="task-group-cb" value="${g.id}" class="text-primary focus:ring-primary h-4 w-4 rounded border-bordercolor">
                <span class="text-sm font-medium text-dark truncate">${g.groupName}</span>
            `;
            taskCheckboxes.appendChild(label);
        });
    }
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
    if(currentNoCreds.length === 0) return showToast("No credentials to save.", "error");
    
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
        showToast('Error saving credentials.', 'error');
        btn.innerHTML = '<iconify-icon icon="mynaui:save"></iconify-icon> Save Changes';
        btn.disabled = false;
    }
});

// Validation Setup
function setupUsernameValidation(inputId, validationId) {
    const input = document.getElementById(inputId);
    const validationText = document.getElementById(validationId);
    if (!input || !validationText) return;
    
    input.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (!val) {
            validationText.classList.add('hidden');
            input.classList.remove('border-primary', 'border-[#FF4842]', 'focus:border-primary', 'focus:border-[#FF4842]');
            input.classList.add('focus:border-dark');
            return;
        }
        
        const usernames = val.split(',').map(u => u.trim()).filter(u => u);
        const invalid = usernames.filter(u => !validUsernames.has(u));
        
        validationText.classList.remove('hidden');
        input.classList.remove('focus:border-dark');
        
        if (invalid.length === 0) {
            validationText.innerHTML = `<span class="text-primary">All usernames are valid!</span>`;
            input.classList.remove('border-[#FF4842]', 'focus:border-[#FF4842]');
            input.classList.add('border-primary', 'focus:border-primary');
        } else {
            validationText.innerHTML = `<span class="text-[#FF4842]">Invalid: ${invalid.join(', ')}</span>`;
            input.classList.remove('border-primary', 'focus:border-primary');
            input.classList.add('border-[#FF4842]', 'focus:border-[#FF4842]');
        }
    });
}

// Notifications
const notifTargetSelect = document.getElementById('notif-target');
const notifIndividualContainer = document.getElementById('notif-individual-container');
const notifGroupContainer = document.getElementById('notif-group-container');
const sendNotifForm = document.getElementById('send-notification-form');
const btnCancelEditNotif = document.getElementById('btn-cancel-edit-notif');
const btnSendNotif = document.getElementById('btn-send-notif');
let editNotifId = null;

setupUsernameValidation('notif-usernames', 'notif-usernames-validation');

if (notifTargetSelect) {
    notifTargetSelect.addEventListener('change', (e) => {
        notifIndividualContainer.classList.add('hidden');
        if (notifGroupContainer) notifGroupContainer.classList.add('hidden');
        document.getElementById('notif-usernames').required = false;

        if (e.target.value === 'individual') {
            notifIndividualContainer.classList.remove('hidden');
            document.getElementById('notif-usernames').required = true;
        } else if (e.target.value === 'group') {
            if (notifGroupContainer) notifGroupContainer.classList.remove('hidden');
        }
    });
}

if (btnCancelEditNotif) {
    btnCancelEditNotif.addEventListener('click', () => {
        editNotifId = null;
        sendNotifForm.reset();
        btnSendNotif.innerHTML = '<iconify-icon icon="mynaui:send"></iconify-icon> Send Broadcast';
        btnCancelEditNotif.classList.add('hidden');
        notifIndividualContainer.classList.add('hidden');
    });
}

sendNotifForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = editNotifId ? 'Updating...' : 'Sending...'; 
    btn.disabled = true;

    const target = document.getElementById('notif-target').value;
    const title = document.getElementById('notif-title').value;
    const message = document.getElementById('notif-message').value;
    const type = document.querySelector('input[name="notif-type"]:checked').value;
    const isActive = document.getElementById('notif-active').checked;

    let targetType = 'public';
    let targetIds = ['public'];
    
    if (target === 'individual') {
        targetType = 'individual';
        const usernamesStr = document.getElementById('notif-usernames').value;
        targetIds = usernamesStr.split(',').map(u => u.trim()).filter(u => u);
        if (targetIds.some(u => !validUsernames.has(u))) {
            showToast("Please ensure all usernames are valid.", "error");
            btn.innerHTML = ogText; btn.disabled = false;
            return;
        }
    } else if (target === 'group') {
        targetType = 'group';
        const checked = Array.from(document.querySelectorAll('input[name="notif-group-cb"]:checked')).map(cb => cb.value);
        if (checked.length === 0) {
            showToast("Please select at least one group.", "error");
            btn.innerHTML = ogText; btn.disabled = false;
            return;
        }
        targetIds = checked;
    }

    try {
        if (editNotifId) {
            await updateDoc(doc(db, 'Notifications', editNotifId), {
                title, message, targetType, targetIds, isActive, type
            });
            showToast('Notification updated successfully!');
            btnCancelEditNotif.click();
        } else {
            await addDoc(collection(db, 'Notifications'), {
                title, message, targetType, targetIds, isActive, type,
                createdAt: serverTimestamp()
            });
            showToast('Alert broadcasted successfully!');
            sendNotifForm.reset();
            if (notifGroupContainer) notifGroupContainer.classList.add('hidden');
            if (notifIndividualContainer) notifIndividualContainer.classList.add('hidden');
        }
        loadAdminNotifications();
    } catch (error) {
        console.error("Error saving notification:", error);
        showToast('Error saving notification', 'error');
    } finally {
        btn.innerHTML = ogText; btn.disabled = false;
    }
});

async function loadAdminNotifications() {
    const tbody = document.getElementById('admin-notifs-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-graytext">Loading...</td></tr>';
    
    try {
        const snap = await getDocs(query(collection(db, 'Notifications')));
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-primary font-bold bg-[#E1F3EA]">No notifications found.</td></tr>';
            return;
        }

        let html = '';
        const groupMap = new Map();
        currentGroups.forEach(g => groupMap.set(g.id, g.groupName));

        // Sort locally by createdAt desc since we fetched without order
        const notifs = [];
        snap.forEach(d => notifs.push({id: d.id, ...d.data()}));
        notifs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        notifs.forEach(data => {
            let targetLabel = 'Public';
            if (data.targetType === 'group') {
                if (data.targetIds && data.targetIds.length > 0) {
                    const groupNames = data.targetIds.map(id => groupMap.get(id) || 'Unknown').join(', ');
                    targetLabel = `<span title="${groupNames}">${data.targetIds.length > 1 ? data.targetIds.length + ' Groups' : groupNames}</span>`;
                }
            } else if (data.targetType === 'individual') {
                targetLabel = `Individual (${data.targetIds.length})`;
            }

            const activeStatus = (data.isActive !== false) 
                ? '<span class="px-2 py-1 bg-[#E1F3EA] text-[#00A76F] text-[10px] uppercase tracking-wider font-bold rounded-md">Active</span>'
                : '<span class="px-2 py-1 bg-light text-graytext border border-bordercolor text-[10px] uppercase tracking-wider font-bold rounded-md">Inactive</span>';

            html += `
                <tr class="hover:bg-[#F9FAFB] transition-colors">
                    <td class="px-6 py-4 font-semibold text-dark">${data.title}</td>
                    <td class="px-6 py-4 text-sm text-graytext truncate max-w-[200px]" title="${data.message}">${data.message}</td>
                    <td class="px-6 py-4 text-sm font-medium text-dark">${targetLabel}</td>
                    <td class="px-6 py-4 text-center">${activeStatus}</td>
                    <td class="px-6 py-4 text-right">
                        <button class="text-graytext hover:text-primary transition-colors mx-1" onclick="editAdminNotification('${data.id}', '${data.title.replace(/'/g, "\\'")}', '${data.message.replace(/'/g, "\\'")}', '${data.targetType}', '${data.targetIds.join(',')}', ${data.isActive !== false}, '${data.type}')" title="Edit">
                            <iconify-icon icon="mynaui:edit-one" class="text-xl"></iconify-icon>
                        </button>
                        <button class="text-graytext hover:text-[#FF4842] transition-colors mx-1" onclick="deleteAdminNotification('${data.id}')" title="Delete">
                            <iconify-icon icon="mynaui:trash-one" class="text-xl"></iconify-icon>
                        </button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch(err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-[#FF4842]">Error loading notifications.</td></tr>';
    }
}

window.deleteAdminNotification = async function(id) {
    if(!confirm("Delete this notification?")) return;
    try {
        await deleteDoc(doc(db, 'Notifications', id));
        showToast("Notification deleted successfully!");
        loadAdminNotifications();
    } catch(err) {
        console.error(err);
        showToast('Error deleting notification', 'error');
    }
};

window.editAdminNotification = function(id, title, message, targetType, targetIdsStr, isActive, type) {
    editNotifId = id;
    document.getElementById('notif-title').value = title;
    document.getElementById('notif-message').value = message;
    
    const targetSelect = document.getElementById('notif-target');
    if (targetType === 'public') {
        targetSelect.value = 'public';
    } else if (targetType === 'individual') {
        targetSelect.value = 'individual';
        document.getElementById('notif-usernames').value = targetIdsStr;
    } else {
        targetSelect.value = 'group';
        const groupIds = targetIdsStr.split(',');
        document.querySelectorAll('input[name="notif-group-cb"]').forEach(cb => {
            cb.checked = groupIds.includes(cb.value);
        });
    }
    
    targetSelect.dispatchEvent(new Event('change'));

    document.getElementById('notif-active').checked = isActive;
    
    document.querySelectorAll('input[name="notif-type"]').forEach(el => {
        if (el.value === type) el.checked = true;
    });

    btnSendNotif.innerHTML = '<iconify-icon icon="mynaui:edit"></iconify-icon> Update Broadcast';
    btnCancelEditNotif.classList.remove('hidden');
    
    document.getElementById('notification-view').scrollIntoView({behavior: 'smooth'});
};

// Tasks
const taskTargetSelect = document.getElementById('task-target');
const taskIndividualContainer = document.getElementById('task-individual-container');
const taskGroupContainer = document.getElementById('task-group-container');
const createTaskForm = document.getElementById('create-task-form');
const btnCancelEditTask = document.getElementById('btn-cancel-edit-task');
const btnCreateTask = document.getElementById('btn-create-task');
let editTaskId = null;

setupUsernameValidation('task-usernames', 'task-usernames-validation');

if (taskTargetSelect) {
    taskTargetSelect.addEventListener('change', (e) => {
        if(taskIndividualContainer) taskIndividualContainer.classList.add('hidden');
        if(taskGroupContainer) taskGroupContainer.classList.add('hidden');
        const usernamesInput = document.getElementById('task-usernames');
        if(usernamesInput) usernamesInput.required = false;

        if (e.target.value === 'individual') {
            if(taskIndividualContainer) taskIndividualContainer.classList.remove('hidden');
            if(usernamesInput) usernamesInput.required = true;
        } else if (e.target.value === 'group') {
            if(taskGroupContainer) taskGroupContainer.classList.remove('hidden');
        }
    });
}

if (btnCancelEditTask) {
    btnCancelEditTask.addEventListener('click', () => {
        editTaskId = null;
        createTaskForm.reset();
        btnCreateTask.innerHTML = '<iconify-icon icon="mynaui:plus-square"></iconify-icon> Deploy Task';
        btnCancelEditTask.classList.add('hidden');
        if(taskGroupContainer) taskGroupContainer.classList.add('hidden');
        if(taskIndividualContainer) taskIndividualContainer.classList.add('hidden');
    });
}

createTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = editTaskId ? 'Updating...' : 'Deploying...'; 
    btn.disabled = true;

    const target = document.getElementById('task-target').value;
    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-description').value;
    const deadline = document.getElementById('task-deadline').value; // datetime-local format e.g., "2026-05-24T15:30"
    const icon = document.getElementById('task-icon').value;

    let targetType = 'public';
    let targetIds = ['public'];

    if (target === 'individual') {
        targetType = 'individual';
        const usernamesStr = document.getElementById('task-usernames').value;
        targetIds = usernamesStr.split(',').map(u => u.trim()).filter(u => u);
        if (targetIds.some(u => !validUsernames.has(u))) {
            showToast("Please ensure all usernames are valid.", "error");
            btn.innerHTML = ogText; btn.disabled = false;
            return;
        }
    } else if (target === 'group') {
        targetType = 'group';
        const checked = Array.from(document.querySelectorAll('input[name="task-group-cb"]:checked')).map(cb => cb.value);
        if (checked.length === 0) {
            showToast("Please select at least one group.", "error");
            btn.innerHTML = ogText; btn.disabled = false;
            return;
        }
        targetIds = checked;
    }

    try {
        if (editTaskId) {
            await updateDoc(doc(db, 'Tasks', editTaskId), {
                title, desc, deadline, icon, targetType, targetIds
            });
            showToast('Task updated successfully!');
            btnCancelEditTask.click();
        } else {
            await addDoc(collection(db, 'Tasks'), {
                title, desc, deadline, icon, targetType, targetIds,
                createdAt: serverTimestamp()
            });
            showToast('Task deployed successfully!');
            createTaskForm.reset();
            if(taskGroupContainer) taskGroupContainer.classList.add('hidden');
            if(taskIndividualContainer) taskIndividualContainer.classList.add('hidden');
        }
        loadAdminTasks();
    } catch (error) {
        console.error(error);
        showToast('Error saving task', 'error');
    } finally {
        btn.innerHTML = ogText; btn.disabled = false;
    }
});

async function loadAdminTasks() {
    const tbody = document.getElementById('admin-tasks-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-graytext">Loading...</td></tr>';
    
    try {
        const snap = await getDocs(query(collection(db, 'Tasks')));
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-primary font-bold bg-[#E1F3EA]">No tasks deployed.</td></tr>';
            return;
        }

        let html = '';
        const groupMap = new Map();
        currentGroups.forEach(g => groupMap.set(g.id, g.groupName));

        const tasksList = [];
        snap.forEach(d => tasksList.push({id: d.id, ...d.data()}));
        tasksList.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        tasksList.forEach(data => {
            let targetLabel = 'Public';
            if (data.targetType === 'group') {
                if (data.targetIds && data.targetIds.length > 0) {
                    const groupNames = data.targetIds.map(id => groupMap.get(id) || 'Unknown').join(', ');
                    targetLabel = `<span title="${groupNames}">${data.targetIds.length > 1 ? data.targetIds.length + ' Groups' : groupNames}</span>`;
                }
            } else if (data.targetType === 'individual') {
                targetLabel = `Individual (${data.targetIds.length})`;
            }
            
            // Format deadline nicely if it's a valid date string
            let formattedDeadline = data.deadline;
            try {
                if (data.deadline && data.deadline.includes('T')) {
                    const d = new Date(data.deadline);
                    formattedDeadline = d.toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
                }
            } catch(e) {}

            html += `
                <tr class="hover:bg-[#F9FAFB] transition-colors">
                    <td class="px-6 py-4 font-semibold text-dark">${data.title}</td>
                    <td class="px-6 py-4 text-sm font-medium text-primary bg-[#E1F3EA]/30 rounded">${formattedDeadline}</td>
                    <td class="px-6 py-4 text-sm font-medium text-dark">${targetLabel}</td>
                    <td class="px-6 py-4 text-right">
                        <button class="text-graytext hover:text-primary transition-colors mx-1" onclick="editAdminTask('${data.id}', '${(data.title || '').replace(/'/g, "\\'")}', '${(data.desc || data.description || '').replace(/'/g, "\\'")}', '${data.deadline || ''}', '${data.icon || ''}', '${data.targetType || ''}', '${(data.targetIds||[]).join(',')}')" title="Edit">
                            <iconify-icon icon="mynaui:edit-one" class="text-xl"></iconify-icon>
                        </button>
                        <button class="text-graytext hover:text-[#FF4842] transition-colors mx-1" onclick="deleteAdminTask('${data.id}')" title="Delete">
                            <iconify-icon icon="mynaui:trash-one" class="text-xl"></iconify-icon>
                        </button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch(err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-[#FF4842]">Error loading tasks.</td></tr>';
    }
}

window.deleteAdminTask = async function(id) {
    if(!confirm("Delete this task?")) return;
    try {
        await deleteDoc(doc(db, 'Tasks', id));
        showToast("Task deleted successfully!");
        loadAdminTasks();
    } catch(err) {
        console.error(err);
        showToast('Error deleting task', 'error');
    }
};

window.editAdminTask = function(id, title, desc, deadline, icon, targetType, targetIdsStr) {
    editTaskId = id;
    document.getElementById('task-title').value = title;
    document.getElementById('task-description').value = desc;
    document.getElementById('task-deadline').value = deadline;
    document.getElementById('task-icon').value = icon;
    
    const targetSelect = document.getElementById('task-target');
    if (targetType === 'public') {
        targetSelect.value = 'public';
    } else if (targetType === 'individual') {
        targetSelect.value = 'individual';
        const usernamesInput = document.getElementById('task-usernames');
        if(usernamesInput) usernamesInput.value = targetIdsStr;
    } else {
        targetSelect.value = 'group';
        const groupIds = targetIdsStr.split(',');
        document.querySelectorAll('input[name="task-group-cb"]').forEach(cb => {
            cb.checked = groupIds.includes(cb.value);
        });
    }
    
    targetSelect.dispatchEvent(new Event('change'));

    btnCreateTask.innerHTML = '<iconify-icon icon="mynaui:edit"></iconify-icon> Update Task';
    if(btnCancelEditTask) btnCancelEditTask.classList.remove('hidden');
    
    document.getElementById('task-view').scrollIntoView({behavior: 'smooth'});
};
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
        if (e.target.dataset.target === 'att-summary') loadAttendanceSummary();
    });
});

// Mark Attendance
const attSelect = document.getElementById('att-group-select');
const attDateSelect = document.getElementById('att-date-select');
const attTimeSelect = document.getElementById('att-time-select');
const btnSaveAttendance = document.getElementById('btn-save-attendance');

if (attDateSelect) attDateSelect.value = new Date().toISOString().split('T')[0];
if (attTimeSelect) {
    const now = new Date();
    attTimeSelect.value = now.toTimeString().slice(0,5);
}

async function loadStudentsForAttendance() {
    const groupId = attSelect?.value;
    const date = attDateSelect?.value;
    const tbody = document.getElementById('att-mark-table-body');
    
    if(!groupId || !date) {
        tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-graytext">Select a group and date to load students.</td></tr>';
        if(btnSaveAttendance) btnSaveAttendance.classList.add('hidden');
        return;
    }
    tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-graytext">Loading...</td></tr>';
    if(btnSaveAttendance) btnSaveAttendance.classList.add('hidden');

    try {
        const qCand = query(collection(db, 'Candidates'), where('group', '==', groupId));
        const snapCand = await getDocs(qCand);
        
        if (snapCand.empty) {
            tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-primary font-bold bg-[#E1F3EA]">No students found.</td></tr>';
            return;
        }

        const qAtt = query(collection(db, 'Attendances'), where('groupId', '==', groupId), where('date', '==', date));
        const snapAtt = await getDocs(qAtt);
        
        const attendanceMap = new Map();
        snapAtt.forEach(doc => {
            const data = doc.data();
            attendanceMap.set(data.candidateId, data.isPresent);
        });

        let html = '';
        snapCand.forEach(docSnap => {
            const data = docSnap.data();
            const candId = docSnap.id;
            const isPresent = attendanceMap.has(candId) ? attendanceMap.get(candId) : true;
            
            html += `
                <tr class="hover:bg-[#F9FAFB] cand-row" data-id="${candId}" data-name="${data.name}" data-class="${data.class || ''}">
                    <td class="px-6 py-4 font-semibold text-dark">${data.name}</td>
                    <td class="px-6 py-4 text-graytext text-sm">${data.class || '-'}</td>
                    <td class="px-6 py-4 text-center">
                        <input type="checkbox" class="att-checkbox w-5 h-5 text-primary rounded focus:ring-primary cursor-pointer border-bordercolor" ${isPresent ? 'checked' : ''}>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        if(btnSaveAttendance) {
            btnSaveAttendance.classList.remove('hidden');
            if (snapAtt.empty) {
                btnSaveAttendance.innerHTML = '<iconify-icon icon="mynaui:save"></iconify-icon> Save Attendance';
            } else {
                btnSaveAttendance.innerHTML = '<iconify-icon icon="mynaui:edit"></iconify-icon> Update Attendance';
            }
        }
    } catch(err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-[#FF4842]">Error loading data.</td></tr>';
    }
}

if (attSelect) attSelect.addEventListener('change', loadStudentsForAttendance);
if (attDateSelect) attDateSelect.addEventListener('change', loadStudentsForAttendance);

if (btnSaveAttendance) {
    btnSaveAttendance.addEventListener('click', async () => {
        const groupId = attSelect.value;
        const date = attDateSelect.value;
        const time = attTimeSelect.value;
        
        if(!groupId || !date) return showToast("Missing group or date", "error");

        btnSaveAttendance.innerHTML = '<iconify-icon icon="mynaui:spinner" class="animate-spin"></iconify-icon> Saving...';
        btnSaveAttendance.disabled = true;

        try {
            const rows = document.querySelectorAll('.cand-row');
            const promises = Array.from(rows).map(row => {
                const candId = row.getAttribute('data-id');
                const name = row.getAttribute('data-name');
                const candClass = row.getAttribute('data-class');
                const isPresent = row.querySelector('.att-checkbox').checked;
                
                const attRef = doc(db, 'Attendances', `${groupId}_${date}_${candId}`);
                return setDoc(attRef, {
                    candidateId: candId,
                    candidateName: name,
                    candidateClass: candClass,
                    groupId: groupId,
                    date: date,
                    time: time,
                    isPresent: isPresent,
                    timestamp: serverTimestamp()
                });
            });

            await Promise.all(promises);
            
            btnSaveAttendance.innerHTML = '<iconify-icon icon="mynaui:check-circle"></iconify-icon> Saved!';
            btnSaveAttendance.classList.replace('bg-primary', 'bg-dark');
            
            setTimeout(() => {
                btnSaveAttendance.innerHTML = '<iconify-icon icon="mynaui:save"></iconify-icon> Save Attendance';
                btnSaveAttendance.classList.replace('bg-dark', 'bg-primary');
                btnSaveAttendance.disabled = false;
            }, 2000);

        } catch (error) {
            console.error(error);
            showToast("Error saving attendance.", "error");
            btnSaveAttendance.innerHTML = '<iconify-icon icon="mynaui:save"></iconify-icon> Save Attendance';
            btnSaveAttendance.disabled = false;
        }
    });
}

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
        const q = query(collection(db, 'Attendances'), where('date', '==', dateStr));
        const snap = await getDocs(q);
        
        const absents = [];
        snap.forEach(d => {
            if (d.data().isPresent === false) absents.push(d.data());
        });

        if(absents.length === 0) {
            container.innerHTML = '<div class="col-span-full py-12 text-center text-primary font-bold bg-[#E1F3EA] rounded-xl">No absences registered for this date.</div>';
            return;
        }
        
        const groupMap = new Map();
        currentGroups.forEach(g => groupMap.set(g.id, g.groupName));

        let html = '';
        absents.forEach(data => {
            const gName = groupMap.get(data.groupId) || 'Unknown Group';
            html += `
                <div class="bg-white p-5 rounded-2xl shadow-soft border border-bordercolor border-dashed hover:border-primary/30 transition-colors">
                    <div class="flex justify-between items-start mb-3">
                        <div class="w-10 h-10 bg-[#FFE4DE] text-[#FF4842] rounded-full flex items-center justify-center">
                            <iconify-icon icon="mynaui:user-x" class="text-xl"></iconify-icon>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] font-bold text-graytext uppercase tracking-wider px-2 py-1 bg-light rounded-md block mb-1">${data.date} ${data.time || ''}</span>
                            <span class="text-[10px] font-bold text-primary uppercase tracking-wider px-2 py-1 bg-[#E1F3EA] rounded-md block truncate max-w-[120px] ml-auto">${gName}</span>
                        </div>
                    </div>
                    <h4 class="font-bold text-dark text-lg">${data.candidateName}</h4>
                    <p class="text-sm text-graytext mt-1">Class: <span class="font-semibold text-dark">${data.candidateClass || '-'}</span></p>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch(err) {
        console.error(err);
        container.innerHTML = '<div class="col-span-full py-12 text-center text-[#FF4842]">Error loading report.</div>';
    }
}

// Summary Report
const summaryMonthInput = document.getElementById('att-summary-month');
if (summaryMonthInput) {
    const now = new Date();
    summaryMonthInput.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    summaryMonthInput.addEventListener('change', loadAttendanceSummary);
}

async function loadAttendanceSummary() {
    const monthStr = summaryMonthInput?.value; // YYYY-MM
    const tbody = document.getElementById('att-summary-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-graytext">Loading attendance summary...</td></tr>';

    try {
        const snap = await getDocs(collection(db, 'Attendances'));
        
        // Group by groupId and date
        const collectionsObj = {};
        
        snap.forEach(docSnap => {
            const data = docSnap.data();
            // Optional: filter by monthStr if provided
            if (monthStr && !data.date.startsWith(monthStr)) return;

            const key = `${data.groupId}_${data.date}`;
            if (!collectionsObj[key]) {
                collectionsObj[key] = {
                    groupId: data.groupId,
                    date: data.date,
                    presentCount: 0,
                    absentCount: 0
                };
            }
            if (data.isPresent) {
                collectionsObj[key].presentCount++;
            } else {
                collectionsObj[key].absentCount++;
            }
        });

        const collectionList = Object.values(collectionsObj);
        // Sort by date descending
        collectionList.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (collectionList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-primary font-bold bg-[#E1F3EA]">No attendance collections found.</td></tr>';
            return;
        }

        const groupMap = new Map();
        currentGroups.forEach(g => groupMap.set(g.id, g.groupName));

        let html = '';
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        collectionList.forEach(col => {
            const gName = groupMap.get(col.groupId) || 'Unknown Group';
            const dateObj = new Date(col.date);
            const dayName = days[dateObj.getDay()];
            
            html += `
                <tr class="hover:bg-[#F9FAFB] transition-colors">
                    <td class="px-6 py-4">
                        <span class="font-bold text-dark block">${dayName}</span>
                        <span class="text-xs text-graytext">${col.date}</span>
                    </td>
                    <td class="px-6 py-4 font-semibold text-primary">${gName}</td>
                    <td class="px-6 py-4 text-center">
                        <span class="px-2 py-1 bg-[#E1F3EA] text-[#00A76F] text-xs font-bold rounded-lg">${col.presentCount}</span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <span class="px-2 py-1 bg-[#FFE4DE] text-[#FF4842] text-xs font-bold rounded-lg">${col.absentCount}</span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <button class="text-graytext hover:text-primary transition-colors mx-1" onclick="editAttendanceCollection('${col.groupId}', '${col.date}')" title="Edit">
                            <iconify-icon icon="mynaui:edit-one" class="text-xl"></iconify-icon>
                        </button>
                        <button class="text-graytext hover:text-[#FF4842] transition-colors mx-1" onclick="deleteAttendanceCollection('${col.groupId}', '${col.date}')" title="Delete">
                            <iconify-icon icon="mynaui:trash-one" class="text-xl"></iconify-icon>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    } catch(err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-[#FF4842]">Error loading summary.</td></tr>';
    }
}

window.editAttendanceCollection = function(groupId, date) {
    document.querySelector('.att-tab[data-target="att-mark"]').click();
    if(attSelect) attSelect.value = groupId;
    if(attDateSelect) attDateSelect.value = date;
    loadStudentsForAttendance();
};

window.deleteAttendanceCollection = async function(groupId, date) {
    if(!confirm(`Are you sure you want to delete the attendance collection for this group on ${date}?`)) return;
    try {
        const q = query(collection(db, 'Attendances'), where('groupId', '==', groupId), where('date', '==', date));
        const snap = await getDocs(q);
        
        const promises = [];
        snap.forEach(docSnap => {
            promises.push(deleteDoc(docSnap.ref));
        });
        await Promise.all(promises);
        
        loadAttendanceSummary();
    } catch(err) {
        console.error(err);
        showToast('Error deleting attendance collection', 'error');
    }
};

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
    
    for(let i=0; i<firstDay; i++) {
        grid.innerHTML += `<div class="aspect-square bg-transparent"></div>`;
    }
    
    getDocs(collection(db, 'Attendances')).then(snap => {
        const attendanceDates = new Set();
        snap.forEach(docSnap => attendanceDates.add(docSnap.data().date));
        
        for(let day=1; day<=daysInMonth; day++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const hasAttendance = attendanceDates.has(dateStr);
            const isPastOrToday = new Date(dateStr) <= new Date();
            
            let classes = "aspect-square rounded-xl flex items-center justify-center text-sm font-bold cursor-pointer smooth-hover border border-bordercolor border-dashed hover:border-primary ";
            
            if (hasAttendance) {
                classes += "bg-primary text-white"; // Green
            } else if (isPastOrToday) {
                classes += "bg-[#FFE4DE] text-[#FF4842]"; // Red
            } else {
                classes += "bg-white text-dark hover:bg-light"; // Future dates without attendance
            }
            
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
