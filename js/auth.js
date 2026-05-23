import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// DOM Elements
const tabCandidate = document.getElementById('tab-candidate');
const tabAdmin = document.getElementById('tab-admin');
const formCandidate = document.getElementById('form-candidate');
const formAdmin = document.getElementById('form-admin');

const candidateForm = document.getElementById('candidate-login-form');
const adminForm = document.getElementById('admin-login-form');

const passcodeModal = document.getElementById('passcode-modal');
const passcodeForm = document.getElementById('passcode-form');
const btnCancelPasscode = document.getElementById('btn-cancel-passcode');

// Tab Switching Logic
if (tabCandidate && tabAdmin) {
    tabCandidate.addEventListener('click', () => {
        // Active candidate
        tabCandidate.classList.add('text-primary', 'border-b-2', 'border-primary', 'bg-green-50');
        tabCandidate.classList.remove('text-gray-400', 'hover:bg-gray-50', 'hover:text-gray-600');
        
        // Inactive admin
        tabAdmin.classList.remove('text-primary', 'border-b-2', 'border-primary', 'bg-green-50');
        tabAdmin.classList.add('text-gray-400', 'hover:bg-gray-50', 'hover:text-gray-600');
        
        // Toggle forms
        formCandidate.classList.remove('hidden');
        formAdmin.classList.add('hidden');
    });

    tabAdmin.addEventListener('click', () => {
        // Active admin
        tabAdmin.classList.add('text-primary', 'border-b-2', 'border-primary', 'bg-green-50');
        tabAdmin.classList.remove('text-gray-400', 'hover:bg-gray-50', 'hover:text-gray-600');
        
        // Inactive candidate
        tabCandidate.classList.remove('text-primary', 'border-b-2', 'border-primary', 'bg-green-50');
        tabCandidate.classList.add('text-gray-400', 'hover:bg-gray-50', 'hover:text-gray-600');
        
        // Toggle forms
        formAdmin.classList.remove('hidden');
        formCandidate.classList.add('hidden');
    });
}

// Toast Utility
function showToast(message, isError = false) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    
    const icon = document.createElement('iconify-icon');
    icon.setAttribute('icon', isError ? 'mynaui:danger-circle' : 'mynaui:check-circle');
    icon.style.color = isError ? '#D92243' : '#F69D39';
    icon.style.fontSize = '24px';
    icon.style.marginRight = '8px';
    
    const text = document.createElement('span');
    text.textContent = message;
    text.className = 'text-sm font-medium text-gray-800';

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove toast after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- ADMIN LOGIN LOGIC (Hardcoded for su/si/su) ---
if (adminForm) {
    adminForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('admin-username').value;
        const password = document.getElementById('admin-password').value;

        // Primary check
        if (username === 'su' && password === 'si') {
            // Show passcode modal
            passcodeModal.classList.add('active');
            document.getElementById('admin-passcode-input').value = '';
            setTimeout(() => document.getElementById('admin-passcode-input').focus(), 100);
        } else {
            showToast('Invalid Admin Credentials', true);
        }
    });
}

if (btnCancelPasscode) {
    btnCancelPasscode.addEventListener('click', () => {
        passcodeModal.classList.remove('active');
    });
}

if (passcodeForm) {
    passcodeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const passcode = document.getElementById('admin-passcode-input').value;

        // Secondary check
        if (passcode === 'su') {
            showToast('Authorization successful! Redirecting...');
            passcodeModal.classList.remove('active');
            
            // For the hardcoded demo, we set a localStorage flag
            localStorage.setItem('adminAuthenticated', 'true');
            
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1000);
        } else {
            showToast('Security verification failed', true);
            document.getElementById('admin-passcode-input').value = '';
        }
    });
}

// --- CANDIDATE LOGIN LOGIC (Firebase Auth) ---
if (candidateForm) {
    candidateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('candidate-username').value;
        const password = document.getElementById('candidate-password').value;

        const email = username.includes('@') ? username : `${username}@candidate.mediacup.com`;

        try {
            // Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            showToast('Login successful!');
            setTimeout(() => {
                window.location.href = 'candidate.html';
            }, 1000);
        } catch (error) {
            console.error("Login Error:", error);
            // Firebase errors can be ugly, let's show a cleaner one if possible
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
                showToast('Invalid username or password', true);
            } else {
                showToast('Login failed: ' + error.message, true);
            }
        }
    });
}
