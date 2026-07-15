/**
 * Settings Page JavaScript
 * Handles API interactions for user settings management
 * 
 * Features:
 * - Profile information display
 * - Username change
 * - Password change
 * - Settings reset
 */

// =====================
// Configuration
// =====================
// Use relative URL - nginx proxies /settings/* to settings-service:4000
const API_BASE_URL = '/settings';

// DOM Elements Cache
const elements = {
    // Tab Navigation
    tabs: document.querySelectorAll('.settings-tab'),
    sections: document.querySelectorAll('.settings-section'),

    // Profile Section
    profileLoading: document.getElementById('profile-loading'),
    profileLoaded: document.getElementById('profile-loaded'),
    profileError: document.getElementById('profile-error'),
    profileErrorMessage: document.getElementById('profile-error-message'),
    profileDisplayUsername: document.getElementById('profile-display-username'),
    profileDisplayEmail: document.getElementById('profile-display-email'),
    profileDisplayJoined: document.getElementById('profile-display-joined'),
    profileAvatarLarge: document.getElementById('profile-avatar-large'),
    retryProfileBtn: document.getElementById('retry-profile-btn'),

    // Header
    headerUsername: document.getElementById('header-username'),
    userAvatar: document.getElementById('user-avatar'),

    // Username Form
    changeUsernameForm: document.getElementById('change-username-form'),
    newUsernameInput: document.getElementById('new-username'),
    submitUsernameBtn: document.getElementById('submit-username-btn'),
    usernameMessage: document.getElementById('username-message'),

    // Password Form
    changePasswordForm: document.getElementById('change-password-form'),
    newPasswordInput: document.getElementById('new-password'),
    confirmPasswordInput: document.getElementById('confirm-password'),
    submitPasswordBtn: document.getElementById('submit-password-btn'),
    passwordMessage: document.getElementById('password-message'),
    strengthFill: document.getElementById('strength-fill'),
    strengthText: document.getElementById('strength-text'),
    togglePasswordBtns: document.querySelectorAll('.toggle-password'),

    // Reset Settings
    resetSettingsBtn: document.getElementById('reset-settings-btn'),
    resetMessage: document.getElementById('reset-message'),

    // Modal
    confirmModal: document.getElementById('confirm-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    modalConfirmBtn: document.getElementById('modal-confirm-btn'),

    // Logout
    logoutBtn: document.getElementById('logout-btn'),
};

// =====================
// State Management
// =====================
let currentUser = null;
let pendingAction = null;

// =====================
// Utility Functions
// =====================

/**
 * Make a fetch request with credentials included
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json().catch(() => ({}));

        return {
            ok: response.ok,
            status: response.status,
            data,
        };
    } catch (error) {
        console.error('API Request Error:', error);
        return {
            ok: false,
            status: 0,
            data: { message: 'Network error. Please check your connection.' },
        };
    }
}

/**
 * Show a message in a form message container
 */
function showMessage(element, message, type = 'error') {
    if (!element) return;

    element.textContent = message;
    element.className = `form-message visible ${type}`;

    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => hideMessage(element), 5000);
    }
}

/**
 * Hide a form message
 */
function hideMessage(element) {
    if (!element) return;
    element.className = 'form-message';
    element.textContent = '';
}

/**
 * Enable or disable a button with loading state
 */
function setButtonLoading(button, isLoading, originalContent = null) {
    if (!button) return;

    if (isLoading) {
        button.disabled = true;
        button.setAttribute('data-original-content', button.innerHTML);
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Processing...</span>';
    } else {
        button.disabled = false;
        const original = originalContent || button.getAttribute('data-original-content');
        if (original) {
            button.innerHTML = original;
        }
    }
}

/**
 * Get the first letter of a string (for avatars)
 */
function getInitial(str) {
    return str ? str.charAt(0).toUpperCase() : 'U';
}

/**
 * Calculate password strength
 */
function calculatePasswordStrength(password) {
    if (!password) {
        return { strength: 'none', score: 0, text: 'Enter a password' };
    }

    let score = 0;

    // Length checks
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    // Determine strength
    if (score <= 2) {
        return { strength: 'weak', score, text: 'Weak password' };
    } else if (score <= 4) {
        return { strength: 'fair', score, text: 'Fair password' };
    } else if (score <= 5) {
        return { strength: 'good', score, text: 'Good password' };
    } else {
        return { strength: 'strong', score, text: 'Strong password' };
    }
}

/**
 * Update the password strength indicator
 */
function updatePasswordStrength(password) {
    const { strength, text } = calculatePasswordStrength(password);

    elements.strengthFill.className = `strength-fill ${strength}`;
    elements.strengthText.className = `strength-text ${strength}`;
    elements.strengthText.textContent = text;
}

// =====================
// Tab Navigation
// =====================

function initTabs() {
    elements.tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const targetTabId = tab.getAttribute('data-tab');

            // Update tab buttons
            elements.tabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');

            // Update sections
            elements.sections.forEach((section) => {
                section.classList.remove('active');
                if (section.id === targetTabId) {
                    section.classList.add('active');
                }
            });

            // Clear any messages when switching tabs
            hideMessage(elements.usernameMessage);
            hideMessage(elements.passwordMessage);
            hideMessage(elements.resetMessage);
        });
    });
}

// =====================
// Profile Loading
// =====================

async function loadProfile() {
    // Show loading state
    elements.profileLoading.style.display = 'flex';
    elements.profileLoaded.style.display = 'none';
    elements.profileError.style.display = 'none';

    const result = await apiRequest('/me', { method: 'GET' });

    if (result.ok) {
        currentUser = result.data;
        displayProfile(currentUser);
    } else {
        showProfileError(result.data.message || 'Failed to load profile');

        // If unauthorized, redirect to login
        if (result.status === 401 || result.status === 403) {
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        }
    }
}

function displayProfile(user) {
    elements.profileLoading.style.display = 'none';
    elements.profileLoaded.style.display = 'flex';
    elements.profileError.style.display = 'none';

    const username = user.username || 'User';
    const email = user.email || 'No email';
    const initial = getInitial(username);

    // Update profile display
    elements.profileDisplayUsername.textContent = username;
    elements.profileDisplayEmail.textContent = email;
    elements.profileAvatarLarge.textContent = initial;

    // Handle joined date
    console.log('User data for profile:', user);

    if (elements.profileDisplayJoined) {
        let joinedDate = user.createdAt ? new Date(user.createdAt) : new Date();

        // If date is invalid, use today
        if (isNaN(joinedDate.getTime())) {
            joinedDate = new Date();
        }

        const month = joinedDate.toLocaleString('default', { month: 'long' });
        const year = joinedDate.getFullYear();
        elements.profileDisplayJoined.textContent = `Member since ${month} ${year}`;
    }

    // Update header
    if (elements.headerUsername) elements.headerUsername.textContent = username;
    if (elements.userAvatar) elements.userAvatar.textContent = initial;
}

function showProfileError(message) {
    elements.profileLoading.style.display = 'none';
    elements.profileLoaded.style.display = 'none';
    elements.profileError.style.display = 'flex';
    elements.profileErrorMessage.textContent = message;
}

// =====================
// Change Username
// =====================

async function handleChangeUsername(event) {
    event.preventDefault();

    const newUsername = elements.newUsernameInput.value.trim();

    if (!newUsername) {
        showMessage(elements.usernameMessage, 'Please enter a username', 'error');
        return;
    }

    if (newUsername.length < 3) {
        showMessage(elements.usernameMessage, 'Username must be at least 3 characters', 'error');
        return;
    }

    setButtonLoading(elements.submitUsernameBtn, true);
    hideMessage(elements.usernameMessage);

    const result = await apiRequest('/user/change-name', {
        method: 'PUT',
        body: JSON.stringify({ username: newUsername }),
    });

    setButtonLoading(elements.submitUsernameBtn, false);

    if (result.ok) {
        showMessage(
            elements.usernameMessage,
            'Username updated successfully!',
            'success'
        );

        // Update displayed username
        if (result.data.user) {
            currentUser = { ...currentUser, ...result.data.user };
            displayProfile(currentUser);
        }

        // Clear input
        elements.newUsernameInput.value = '';
    } else {
        showMessage(
            elements.usernameMessage,
            result.data.message || 'Failed to update username',
            'error'
        );
    }
}

// =====================
// Change Password
// =====================

async function handleChangePassword(event) {
    event.preventDefault();

    const password = elements.newPasswordInput.value;
    const confirmPassword = elements.confirmPasswordInput.value;

    // Validation
    if (!password || !confirmPassword) {
        showMessage(elements.passwordMessage, 'Please fill in both password fields', 'error');
        return;
    }

    if (password.length < 8) {
        showMessage(elements.passwordMessage, 'Password must be at least 8 characters', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showMessage(elements.passwordMessage, 'Passwords do not match', 'error');
        return;
    }

    setButtonLoading(elements.submitPasswordBtn, true);
    hideMessage(elements.passwordMessage);

    const result = await apiRequest('/user/change-password', {
        method: 'PUT',
        body: JSON.stringify({ password, confirmPassword }),
    });

    setButtonLoading(elements.submitPasswordBtn, false);

    if (result.ok) {
        showMessage(
            elements.passwordMessage,
            'Password changed successfully!',
            'success'
        );

        // Clear form
        elements.newPasswordInput.value = '';
        elements.confirmPasswordInput.value = '';
        updatePasswordStrength('');
    } else {
        showMessage(
            elements.passwordMessage,
            result.data.message || 'Failed to change password',
            'error'
        );
    }
}

// =====================
// Toggle Password Visibility
// =====================

function initPasswordToggles() {
    elements.togglePasswordBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('i');

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

// =====================
// Reset Settings
// =====================

function showResetConfirmation() {
    pendingAction = 'reset';
    elements.modalTitle.textContent = 'Reset Settings';
    elements.modalMessage.textContent =
        'Are you sure you want to reset all your settings to default values? This action cannot be undone.';
    elements.confirmModal.classList.add('active');
}

async function handleResetSettings() {
    hideModal();
    setButtonLoading(elements.resetSettingsBtn, true);
    hideMessage(elements.resetMessage);

    const result = await apiRequest('/settings/reset', {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser?.userId || currentUser?._id }),
    });

    setButtonLoading(elements.resetSettingsBtn, false);

    if (result.ok) {
        showMessage(elements.resetMessage, 'Settings have been reset to defaults!', 'success');
    } else {
        showMessage(
            elements.resetMessage,
            result.data.message || 'Failed to reset settings',
            'error'
        );
    }
}

// =====================
// Modal Management
// =====================

function initModal() {
    elements.modalCancelBtn.addEventListener('click', hideModal);
    elements.modalConfirmBtn.addEventListener('click', handleModalConfirm);

    // Close on overlay click
    elements.confirmModal.addEventListener('click', (e) => {
        if (e.target === elements.confirmModal) {
            hideModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.confirmModal.classList.contains('active')) {
            hideModal();
        }
    });
}

function hideModal() {
    elements.confirmModal.classList.remove('active');
    pendingAction = null;
}

function handleModalConfirm() {
    if (pendingAction === 'reset') {
        handleResetSettings();
    }
}

// =====================
// Logout
// =====================

function handleLogout() {
    // Clear cookies by making a logout request or just redirect
    // Since we're using httpOnly cookies, we can navigate away
    window.location.href = 'login.html';
}

// =====================
// Event Listeners
// =====================

function initEventListeners() {
    // Forms
    elements.changeUsernameForm?.addEventListener('submit', handleChangeUsername);
    elements.changePasswordForm?.addEventListener('submit', handleChangePassword);

    // Password strength indicator
    elements.newPasswordInput?.addEventListener('input', (e) => {
        updatePasswordStrength(e.target.value);
    });

    // Retry profile loading
    elements.retryProfileBtn?.addEventListener('click', loadProfile);

    // Reset settings button
    elements.resetSettingsBtn?.addEventListener('click', showResetConfirmation);

    // Logout
    elements.logoutBtn?.addEventListener('click', handleLogout);
}

// =====================
// Initialization
// =====================

function init() {
    initTabs();
    initPasswordToggles();
    initModal();
    initEventListeners();

    // Load initial data
    loadProfile();
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
