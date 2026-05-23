import { auth, db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Session check
const sessionStr = localStorage.getItem('candidateSession');
if (!sessionStr) {
    window.location.href = 'login.html';
}
const session = JSON.parse(sessionStr);

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

// Fetch Absences and calculate percentage
const attendanceStat = document.getElementById('cand-attendance');
if (attendanceStat && session.id) {
    const qAbsences = query(collection(db, 'Absences'), where('candidateId', '==', session.id));
    getDocs(qAbsences).then(snap => {
        const absences = snap.size;
        // Assume 30 total days for 100% calculation
        const totalDays = 30;
        let percentage = ((totalDays - Math.min(absences, totalDays)) / totalDays) * 100;
        attendanceStat.textContent = Math.round(percentage) + '%';
    }).catch(err => {
        console.error("Error fetching absences:", err);
    });
}

// Realtime Tasks Listener
const tasksQuery = query(collection(db, 'Tasks'), orderBy('createdAt', 'desc'));
onSnapshot(tasksQuery, (snapshot) => {
    let count = 0;
    let html = '';
    
    snapshot.forEach((doc) => {
        const data = doc.data();
        // Check if task targets public or this candidate's group
        const isPublic = Array.isArray(data.targetIds) && data.targetIds.includes('public');
        const isMyGroup = Array.isArray(data.targetIds) && data.targetIds.includes(session.group);
        
        if (isPublic || isMyGroup) {
            count++;
            const icon = data.icon || 'mynaui:code';
            const progress = data.progress || 0;
            const deadline = data.deadline || 'No deadline';
            
            html += `
                <div class="bg-white p-5 rounded-2xl border border-bordercolor border-dashed hover:border-primary/30 hover:shadow-soft smooth-hover group cursor-pointer flex gap-4">
                    <div class="w-12 h-12 bg-light rounded-xl flex items-center justify-center text-dark shrink-0 group-hover:bg-[#E1F3EA] group-hover:text-primary smooth-hover">
                        <iconify-icon icon="${icon}" class="text-2xl"></iconify-icon>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start mb-1">
                            <h4 class="font-bold text-dark text-md group-hover:text-primary transition-colors truncate pr-4">${data.title || 'Untitled Task'}</h4>
                            <span class="text-[10px] font-bold text-graytext uppercase tracking-wider px-2 py-1 bg-light rounded-md whitespace-nowrap shrink-0">${deadline}</span>
                        </div>
                        <p class="text-sm text-graytext font-medium mb-4 break-words overflow-hidden">${data.description || ''}</p>
                        
                        <div class="w-full bg-light h-1.5 rounded-full overflow-hidden">
                            <div class="bg-primary h-full rounded-full transition-all duration-500" style="width: ${progress}%"></div>
                        </div>
                        <p class="text-xs font-bold text-graytext mt-2 text-right">${progress}% Complete</p>
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


// Realtime Notifications Listener
const notifsQuery = query(collection(db, 'Notifications'), orderBy('createdAt', 'desc'));
onSnapshot(notifsQuery, (snapshot) => {
    let count = 0;
    let html = '';
    
    snapshot.forEach((doc) => {
        const data = doc.data();
        const isPublic = Array.isArray(data.targetIds) && data.targetIds.includes('public');
        const isMyGroup = Array.isArray(data.targetIds) && data.targetIds.includes(session.group);
        
        if (isPublic || isMyGroup) {
            count++;
            const icon = data.icon || 'mynaui:info-circle';
            const typeClass = data.type === 'alert' ? 'bg-[#FFE4DE] text-[#FF4842]' : 'bg-[#E1F3EA] text-primary';
            
            // Format time loosely
            const date = data.createdAt ? data.createdAt.toDate() : new Date();
            const timeString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            html += `
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
        }
    });

    if (count === 0) {
        notifsContainer.innerHTML = '<p class="text-slate-400 font-medium text-sm text-center py-8 bg-[#F8FAFC] rounded-xl border border-light/50">No new alerts.</p>';
    } else {
        notifsContainer.innerHTML = html;
    }
    
    const bellCount = document.getElementById('bell-icon-count');
    if (bellCount) {
        if (count > 0) bellCount.classList.remove('hidden');
        else bellCount.classList.add('hidden');
    }
}, (error) => {
    console.error("Error fetching notifications:", error);
    notifsContainer.innerHTML = '<p class="text-red-500 font-medium text-sm text-center py-8">Failed to load alerts.</p>';
});
