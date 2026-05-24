import { auth, db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Session check
const sessionStr = localStorage.getItem('candidateSession');
if (!sessionStr) {
    window.location.href = 'login.html';
}
let session = JSON.parse(sessionStr);

// If session is missing username (from old login), fetch it and reload
if (!session.username) {
    getDoc(doc(db, 'Candidates', session.id)).then(snap => {
        if(snap.exists()) {
            session.username = snap.data().username;
            localStorage.setItem('candidateSession', JSON.stringify(session));
            window.location.reload();
        }
    });
}

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
    const bgColor = type === 'success' ? 'bg-primary' : 'bg-[#FF4842]';
    
    toast.className = `bg-white rounded-xl shadow-soft flex flex-col overflow-hidden transition-all duration-300 transform -translate-y-4 opacity-0 border border-bordercolor pointer-events-auto min-w-[300px]`;
    toast.innerHTML = `
        <div class="px-4 py-3 flex items-center gap-3">
            <iconify-icon icon="${icon}" class="text-xl ${color}"></iconify-icon>
            <span class="text-sm font-bold text-dark">${message}</span>
        </div>
        <div class="h-1 w-full bg-light">
            <div class="h-full ${bgColor} transition-all ease-linear" style="width: 100%; transition-duration: 3000ms;"></div>
        </div>
    `;
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.remove('-translate-y-4', 'opacity-0');
        const progressBar = toast.querySelector('div > div.h-full');
        requestAnimationFrame(() => progressBar.style.width = '0%');
    });
    
    setTimeout(() => {
        toast.classList.add('-translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// UI Elements
const profileName = document.getElementById('nav-profile-name');
const profileInit = document.getElementById('nav-profile-initial');
const btnLogout = document.getElementById('btn-logout');

const tasksContainer = document.getElementById('candidate-tasks-container');
const tasksCount = document.getElementById('active-tasks-count');
const notifsContainer = document.getElementById('candidate-notifs-container');

// Setup UI
if (profileName && profileInit) {
    profileName.textContent = session.name || 'Candidate';
    profileInit.textContent = (session.name || 'C').charAt(0).toUpperCase();
}

// Logout
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('candidateSession');
        window.location.href = 'login.html';
    });
}

// Fetch Attendance and calculate percentage and Score
const attendanceStat = document.getElementById('cand-attendance');
const scoreStat = document.getElementById('cand-score');
if (session.group && session.id) {
    const qAttendance = query(collection(db, 'Attendance'), where('groupId', '==', session.group));
    getDocs(qAttendance).then(snap => {
        let totalClasses = snap.size;
        let presentClasses = 0;
        
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.records && data.records[session.id] === 'present') {
                presentClasses++;
            }
        });
        
        if (totalClasses > 0) {
            let percentage = (presentClasses / totalClasses) * 100;
            if(attendanceStat) attendanceStat.textContent = Math.round(percentage) + '%';
            if(scoreStat) {
                const score = (percentage / 10).toFixed(1);
                scoreStat.innerHTML = `${score}<span class="text-lg text-graytext font-medium">/10</span>`;
            }
        } else {
            if(attendanceStat) attendanceStat.textContent = 'N/A';
            if(scoreStat) scoreStat.innerHTML = 'N/A';
        }
    }).catch(err => {
        console.error("Error fetching attendance:", err);
    });
}

// Realtime Tasks Listener
const tasksQuery = query(collection(db, 'Tasks'), orderBy('createdAt', 'desc'));
onSnapshot(tasksQuery, (snapshot) => {
    let count = 0;
    let html = '';
    
    snapshot.forEach((doc) => {
        const data = doc.data();
        // Check if task targets public, candidate's group, or individual
        const isPublic = Array.isArray(data.targetIds) && data.targetIds.includes('public');
        const isMyGroup = Array.isArray(data.targetIds) && data.targetIds.includes(session.group);
        const isIndividual = data.targetType === 'individual' && Array.isArray(data.targetIds) && data.targetIds.includes(session.username);
        
        if (isPublic || isMyGroup || isIndividual) {
            count++;
            const icon = data.icon || 'mynaui:code';
            const deadline = data.deadline || 'No deadline';
            
            // Calculate progress and time remaining based on createdAt and deadline
            let percent = 0;
            let timeStr = "No deadline";
            let progressColor = 'bg-primary';
            
            if (data.deadline && data.createdAt) {
                const createdTime = data.createdAt.toDate().getTime();
                const deadlineTime = new Date(data.deadline).getTime();
                const now = Date.now();
                const total = deadlineTime - createdTime;
                const elapsed = now - createdTime;
                
                if (total > 0) {
                    percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
                } else {
                    percent = 100;
                }
                
                const remaining = deadlineTime - now;
                if (remaining <= 0) {
                    timeStr = "Time's up!";
                    percent = 100;
                    progressColor = 'bg-[#FF4842]';
                } else {
                    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                    if (days > 0) {
                        timeStr = `${days}d ${hours}h remaining`;
                    } else if (hours > 0) {
                        timeStr = `${hours}h ${mins}m remaining`;
                    } else {
                        timeStr = `${mins}m remaining`;
                        if (mins < 30) progressColor = 'bg-[#FFAB00]'; // Orange when < 30 mins
                    }
                }
            } else {
                percent = data.progress || 0;
                timeStr = `${percent}% Complete`;
            }
            
            html += `
                <div class="bg-white p-5 rounded-2xl border border-bordercolor border-dashed hover:border-primary/30 hover:shadow-soft smooth-hover group flex flex-col gap-4">
                    <div class="flex gap-4">
                        <div class="w-12 h-12 bg-light rounded-xl flex items-center justify-center text-dark shrink-0 group-hover:bg-[#E1F3EA] group-hover:text-primary smooth-hover">
                            <iconify-icon icon="${icon}" class="text-2xl"></iconify-icon>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start mb-1">
                                <h4 class="font-bold text-dark text-md group-hover:text-primary transition-colors truncate pr-4">${data.title || 'Untitled Task'}</h4>
                                <span class="text-[10px] font-bold text-graytext uppercase tracking-wider px-2 py-1 bg-light rounded-md whitespace-nowrap shrink-0">${deadline}</span>
                            </div>
                            <p class="text-sm text-graytext font-medium mb-4 break-words overflow-hidden">${data.description || data.desc || ''}</p>
                            
                            <div class="w-full bg-light h-1.5 rounded-full overflow-hidden">
                                <div class="${progressColor} h-full rounded-full transition-all duration-500" style="width: ${percent}%"></div>
                            </div>
                            <p class="text-xs font-bold text-graytext mt-2 text-right">${timeStr}</p>
                        </div>
                    </div>
                    
                    <!-- Upload Section -->
                    <div class="border-t border-bordercolor border-dashed pt-4 mt-2 flex flex-col sm:flex-row items-center gap-3">
                        <input type="file" id="file-${doc.id}" class="text-sm text-graytext file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors w-full cursor-pointer">
                        <button onclick="submitProject('${doc.id}')" class="w-full sm:w-auto bg-dark hover:bg-[#454F5B] text-white px-6 py-2 rounded-lg text-sm font-bold smooth-hover shrink-0">Submit</button>
                    </div>
                </div>
            `;
        }
    });

    tasksCount.textContent = `${count} Active`;
    
    if (count === 0) {
        tasksContainer.innerHTML = `
            <div class="bg-white p-8 rounded-2xl border border-bordercolor border-dashed flex flex-col items-center justify-center text-center">
                <div class="w-16 h-16 bg-light rounded-full flex items-center justify-center text-primary mb-4 shadow-sm">
                    <iconify-icon icon="mynaui:check-circle" class="text-4xl"></iconify-icon>
                </div>
                <h4 class="font-bold text-dark mb-1">You're all caught up!</h4>
                <p class="text-sm text-graytext font-medium">There are no active tasks assigned to your section.</p>
            </div>
        `;
    } else {
        tasksContainer.innerHTML = html;
    }
}, (error) => {
    console.error("Error fetching tasks:", error);
    tasksContainer.innerHTML = '<p class="text-red-500 font-medium text-sm text-center py-8">Failed to load tasks.</p>';
});

// Project Submission
window.submitProject = function(taskId) {
    const fileInput = document.getElementById(`file-${taskId}`);
    if (fileInput && fileInput.files.length > 0) {
        showToast("Project submitted successfully!", "success");
        fileInput.value = ''; // Reset the file input
    } else {
        showToast("Please select a file to upload first.", "error");
    }
};



// Realtime Notifications Listener
const notifsQuery = query(collection(db, 'Notifications'), orderBy('createdAt', 'desc'));
const allNotifsModalContainer = document.getElementById('all-notifs-modal-container');
window.currentNotifCount = 0;

onSnapshot(notifsQuery, (snapshot) => {
    let count = 0;
    let html = '';
    let sidebarHtml = '';
    
    snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive === false) return; // Skip inactive alerts
        
        const isPublic = Array.isArray(data.targetIds) && data.targetIds.includes('public');
        const isMyGroup = Array.isArray(data.targetIds) && data.targetIds.includes(session.group);
        const isIndividual = data.targetType === 'individual' && Array.isArray(data.targetIds) && data.targetIds.includes(session.username);
        
        if (isPublic || isMyGroup || isIndividual) {
            count++;
            const icon = data.icon || 'mynaui:info-circle';
            const typeClass = data.type === 'alert' ? 'bg-[#FFE4DE] text-[#FF4842]' : 'bg-[#E1F3EA] text-primary';
            
            // Format time loosely
            const date = data.createdAt ? data.createdAt.toDate() : new Date();
            const timeString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const cardHtml = `
                <div class="flex gap-4 p-4 rounded-xl hover:bg-light transition-colors border-b border-bordercolor border-dashed last:border-0">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${typeClass}">
                        <iconify-icon icon="${icon}" class="text-xl"></iconify-icon>
                    </div>
                    <div class="overflow-hidden min-w-0 flex-1">
                        <h4 class="font-bold text-sm text-dark truncate">${data.title || 'Notification'}</h4>
                        <p class="text-xs text-graytext mt-1 font-medium leading-relaxed break-words break-all">${data.message || ''}</p>
                        <span class="text-[10px] font-bold text-graytext opacity-70 mt-2 block">${timeString}</span>
                    </div>
                </div>
            `;
            html += cardHtml;
            if (count <= 3) { // Show up to 3 in sidebar
                sidebarHtml += cardHtml;
            }
        }
    });

    if (count === 0) {
        const emptyMsg = '<p class="text-slate-400 font-medium text-sm text-center py-8 bg-[#F8FAFC] rounded-xl border border-light/50">No new alerts.</p>';
        notifsContainer.innerHTML = emptyMsg;
        if (allNotifsModalContainer) allNotifsModalContainer.innerHTML = emptyMsg;
    } else {
        notifsContainer.innerHTML = sidebarHtml;
        if (allNotifsModalContainer) allNotifsModalContainer.innerHTML = html;
    }
    
    const bellCount = document.getElementById('bell-icon-count');
    window.currentNotifCount = count;
    
    if (bellCount) {
        let lastSeenCount = parseInt(localStorage.getItem('lastSeenNotifCount') || '0');
        let unread = count - lastSeenCount;
        if (unread > 0) {
            bellCount.textContent = unread > 9 ? '9+' : unread;
            bellCount.classList.remove('hidden');
        } else {
            bellCount.classList.add('hidden');
        }
    }
}, (error) => {
    console.error("Error fetching notifications:", error);
    notifsContainer.innerHTML = '<p class="text-red-500 font-medium text-sm text-center py-8">Failed to load alerts.</p>';
});

// Modal & Bell Logic
const notifsModal = document.getElementById('notifs-modal');
const notifsModalContent = document.getElementById('notifs-modal-content');
const btnViewAllNotifs = document.getElementById('btn-view-all-notifs');
const btnCloseNotifsModal = document.getElementById('btn-close-notifs-modal');
const btnBell = document.getElementById('btn-bell');

function markNotifsRead() {
    localStorage.setItem('lastSeenNotifCount', window.currentNotifCount || 0);
    const bellCount = document.getElementById('bell-icon-count');
    if (bellCount) bellCount.classList.add('hidden');
}

if (btnBell && notifsModal) {
    btnBell.addEventListener('click', () => {
        markNotifsRead();
        notifsModal.classList.remove('hidden');
        setTimeout(() => {
            notifsModal.classList.remove('opacity-0');
            notifsModalContent.classList.remove('scale-95');
        }, 10);
    });
}

if (btnViewAllNotifs && notifsModal) {
    btnViewAllNotifs.addEventListener('click', () => {
        markNotifsRead();
        notifsModal.classList.remove('hidden');
        setTimeout(() => {
            notifsModal.classList.remove('opacity-0');
            notifsModalContent.classList.remove('scale-95');
        }, 10);
    });
}
if (btnCloseNotifsModal && notifsModal) {
    btnCloseNotifsModal.addEventListener('click', () => {
        notifsModal.classList.add('opacity-0');
        notifsModalContent.classList.add('scale-95');
        setTimeout(() => notifsModal.classList.add('hidden'), 300);
    });
}
