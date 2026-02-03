// Dashboard JavaScript - Connects to Settings Service
// Use nginx proxy paths (not direct ports)
const SETTINGS_API = 'http://localhost:4000';
const AUTH_API = 'http://localhost:3000';
const NOTIFICATION_API = 'http://localhost:5000';
const UPLOAD_API = 'http://localhost:6000';

// Services data (can be extended for future microservices)
const servicesData = [
  {
    name: 'Auth Service',
    icon: 'fa-solid fa-key',
    status: 'online',
    port: 3000,
    description: 'User authentication and JWT management',
    endpoints: ['/login', '/signup', '/passwordReset']
  },
  {
    name: 'Settings Service',
    icon: 'fa-solid fa-gear',
    status: 'online',
    port: 4000,
    description: 'User profile and settings management',
    endpoints: ['/me', '/user/change-name']
  },
  {
    name: 'Notification Service',
    icon: 'fa-solid fa-bell',
    status: 'online',
    port: 5000,
    description: 'Email and webhook notifications (SSRF/SSTI)',
    endpoints: ['/webhook/trigger', '/template/create']
  },
  {
    name: 'Upload Service',
    icon: 'fa-solid fa-file-upload',
    status: 'online',
    port: 6000,
    description: 'File storage and processing (RCE/LFI)',
    endpoints: ['/upload', '/download', '/process']
  },
  {
    name: 'MongoDB',
    icon: 'fa-solid fa-database',
    status: 'online',
    port: 27017,
    description: 'NoSQL database for user data',
    endpoints: ['Internal']
  }
];

// DOM Elements
const sections = document.querySelectorAll('.dashboard-section');
const navItems = document.querySelectorAll('.nav-item');
const welcomeName = document.getElementById('welcome-name');
const headerUsername = document.getElementById('header-username');
const userAvatar = document.getElementById('user-avatar');
const profileUsername = document.getElementById('profile-username');
const profileEmail = document.getElementById('profile-email');
const profileAvatar = document.getElementById('profile-avatar');
const servicesGrid = document.getElementById('services-grid');
const servicesList = document.getElementById('services-list');
const changeNameForm = document.getElementById('change-name-form');
const updateMessage = document.getElementById('update-message');
const logoutBtn = document.getElementById('logout-btn');

// Notification Service Elements
const webhookForm = document.getElementById('webhook-form');
const webhookMessage = document.getElementById('webhook-message');
const templateForm = document.getElementById('template-form');
const templateMessage = document.getElementById('template-message');

// Upload Service Elements
const uploadForm = document.getElementById('upload-form');
const uploadMessage = document.getElementById('upload-message');
const fileList = document.getElementById('file-list');
const processFileContainer = document.getElementById('process-file-container');
const processForm = document.getElementById('process-form');
const processFileId = document.getElementById('process-file-id');
const processFilename = document.getElementById('process-filename');
const processOutput = document.getElementById('process-output');


// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  loadUserData();
  renderServices();
  setupNavigation();
  setupForms();
  loadFiles();
});

// Fetch user data from Settings Service
async function loadUserData() {
  try {
    const response = await fetch(`${SETTINGS_API}/me`, {
      method: 'GET',
      credentials: 'include', // Include cookies for JWT
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      // Not authenticated, redirect to login
      console.warn('Not authenticated, redirecting to login...');
      window.location.href = 'login.html';
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }

    const user = await response.json();
    updateUserUI(user);
  } catch (error) {
    console.error('Error loading user data:', error);
    // Show error state and redirect to login
    showMessage('Unable to load user data. Please log in again.', 'error');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
  }
}

// Update UI with user data
function updateUserUI(user) {
  const initial = user.username ? user.username.charAt(0).toUpperCase() : 'U';

  welcomeName.textContent = user.username || 'User';
  headerUsername.textContent = user.username || 'User';
  userAvatar.textContent = initial;
  profileUsername.textContent = user.username || 'Unknown';
  profileEmail.textContent = user.email || 'No email';
  profileAvatar.textContent = initial;
}

// Render services cards
function renderServices() {
  // Quick view cards
  servicesGrid.innerHTML = servicesData.map(service => `
    <div class="service-card">
      <div class="service-header">
        <div class="service-icon" style="color: ${service.status === 'online' ? 'var(--success)' : 'var(--accent)'}">
          <i class="${service.icon}"></i>
        </div>
        <span class="status-badge ${service.status}">${service.status}</span>
      </div>
      <h3>${service.name}</h3>
      <p>${service.description}</p>
      <div class="service-port">Port: ${service.port}</div>
    </div>
  `).join('');

  // Detailed list
  servicesList.innerHTML = servicesData.map(service => `
    <div class="service-item">
      <div class="service-item-header">
        <div class="service-item-icon">
          <i class="${service.icon}"></i>
        </div>
        <div class="service-item-info">
          <h3>${service.name}</h3>
          <p>${service.description}</p>
        </div>
        <span class="status-badge ${service.status}">${service.status}</span>
      </div>
      <div class="service-item-details">
        <div class="detail">
          <span class="detail-label">Port</span>
          <span class="detail-value">${service.port}</span>
        </div>
        <div class="detail">
          <span class="detail-label">Endpoints</span>
          <span class="detail-value">${service.endpoints.join(', ')}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// Navigation
function setupNavigation() {
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const href = item.getAttribute('href');

      // If the link points to a different page, let it navigate naturally
      if (href && href !== '#' && !href.startsWith('#')) {
        return;
      }

      e.preventDefault();
      const sectionId = item.dataset.section;

      // Update active nav
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Show section
      sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `section-${sectionId}`) {
          section.classList.add('active');
        }
      });
    });
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    // Clear cookies and redirect
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = 'login.html';
  });
}

// Forms
function setupForms() {
  changeNameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = document.getElementById('new-username').value.trim();

    if (!newUsername) {
      showMessage('Please enter a username', 'error');
      return;
    }

    try {
      const response = await fetch(`${SETTINGS_API}/user/change-name`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: newUsername })
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('Username updated successfully!', 'success');
        updateUserUI({ username: newUsername, email: profileEmail.textContent });
        document.getElementById('new-username').value = '';
      } else {
        showMessage(data.message || 'Failed to update username', 'error');
      }
    } catch (error) {
      console.error('Error updating username:', error);
      showMessage('Network error. Please try again.', 'error');
    }
  });

  // --- Notification Service Forms ---
  
  // Webhook Form (SSRF)
  webhookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('webhook-url').value;
    const method = document.getElementById('webhook-method').value;

    try {
      const response = await fetch(`${NOTIFICATION_API}/webhook/trigger`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showCustomMessage(webhookMessage, 'Webhook triggered! Check console/logs.', 'success');
        console.log('Webhook Response:', data);
      } else {
        showCustomMessage(webhookMessage, `Error: ${data.message}`, 'error');
      }
    } catch (error) {
      showCustomMessage(webhookMessage, 'Network error', 'error');
    }
  });

  // Template Form (SSTI)
  templateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('template-name').value;
    const subject = document.getElementById('template-subject').value;
    const body = document.getElementById('template-body').value;

    try {
      const response = await fetch(`${NOTIFICATION_API}/template/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subject, body })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showCustomMessage(templateMessage, 'Template created!', 'success');
      } else {
        showCustomMessage(templateMessage, `Error: ${data.message}`, 'error');
      }
    } catch (error) {
      showCustomMessage(templateMessage, 'Network error', 'error');
    }
  });

  // --- Upload Service Forms ---

  // File Upload Form
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file-input');
    const isPublic = document.getElementById('file-public').checked;
    
    if (fileInput.files.length === 0) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('isPublic', isPublic);

    try {
      const response = await fetch(`${UPLOAD_API}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showCustomMessage(uploadMessage, 'File uploaded!', 'success');
        loadFiles(); // Refresh list
        fileInput.value = '';
      } else {
        showCustomMessage(uploadMessage, `Error: ${data.message}`, 'error');
      }
    } catch (error) {
      showCustomMessage(uploadMessage, 'Network error', 'error');
    }
  });

  // File Processing Form (Command Injection)
  processForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileId = processFileId.value;
    const operation = document.getElementById('process-op').value;

    processOutput.style.display = 'block';
    processOutput.textContent = 'Processing...';

    try {
      const response = await fetch(`${UPLOAD_API}/process/${fileId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        processOutput.textContent = data.output || 'No output';
      } else {
        processOutput.textContent = `Error: ${data.message}\n${data.stderr || ''}`;
      }
    } catch (error) {
      processOutput.textContent = 'Network error';
    }
  });
}

// Load files from Upload Service
async function loadFiles() {
  try {
    const response = await fetch(`${UPLOAD_API}/files`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) return;

    const data = await response.json();
    const files = data.files;

    if (files.length === 0) {
      fileList.innerHTML = '<p>No files found.</p>';
      return;
    }

    fileList.innerHTML = files.map(file => `
      <div class="file-item" style="padding: 1rem; border: 1px solid #eee; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${file.originalName}</strong>
          <span style="color: #666; font-size: 0.9em;">(${file.size} bytes)</span>
          ${file.isPublic ? '<span class="status-badge online" style="font-size: 0.8em; padding: 2px 6px;">Public</span>' : ''}
        </div>
        <div class="file-actions">
          <a href="${UPLOAD_API}/download/${file.filename}" target="_blank" class="btn-glass" style="padding: 0.5rem;">
            <i class="fa-solid fa-download"></i>
          </a>
          <button onclick="selectFileForProcess('${file._id}', '${file.originalName}')" class="btn-glass" style="padding: 0.5rem;">
            <i class="fa-solid fa-terminal"></i>
          </button>
          <button onclick="deleteFile('${file._id}')" class="btn-glass" style="padding: 0.5rem; color: var(--accent);">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error loading files:', error);
    fileList.innerHTML = '<p>Error loading files.</p>';
  }
}

// Setup Avatar Upload
const avatarInput = document.getElementById('avatar-input');
if (avatarInput) {
  avatarInput.addEventListener('change', async (e) => {
    if (avatarInput.files.length === 0) return;

    const formData = new FormData();
    formData.append('file', avatarInput.files[0]);
    formData.append('isPublic', 'true'); // Make avatar public so we can display it

    try {
      const response = await fetch(`${UPLOAD_API}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        // Vulnerability: Unrestricted Upload + Public Access
        // We use the public endpoint to display the avatar
        const avatarUrl = `${UPLOAD_API}/public/${data.file.filename}`;
        
        const profileAvatar = document.getElementById('profile-avatar');
        profileAvatar.textContent = ''; // Remove initial
        profileAvatar.style.backgroundImage = `url('${avatarUrl}')`;
        profileAvatar.style.backgroundSize = 'cover';
        profileAvatar.style.backgroundPosition = 'center';
        
        // Also update the header avatar
        const userAvatar = document.getElementById('user-avatar');
        userAvatar.textContent = '';
        userAvatar.style.backgroundImage = `url('${avatarUrl}')`;
        userAvatar.style.backgroundSize = 'cover';
        userAvatar.style.backgroundPosition = 'center';

        showMessage('Profile picture updated!', 'success');
      } else {
        showMessage(`Upload failed: ${data.message}`, 'error');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      showMessage('Network error uploading avatar', 'error');
    }
  });
}

// Helper to select file for processing
window.selectFileForProcess = (id, name) => {
  processFileContainer.style.display = 'block';
  processFileId.value = id;
  processFilename.textContent = name;
  processOutput.style.display = 'none';
  processFileContainer.scrollIntoView({ behavior: 'smooth' });
};

// Helper to delete file
window.deleteFile = async (id) => {
  if (!confirm('Are you sure?')) return;
  
  try {
    const response = await fetch(`${UPLOAD_API}/delete/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (response.ok) {
      loadFiles();
    } else {
      alert('Failed to delete file');
    }
  } catch (error) {
    console.error('Delete error:', error);
  }
};

// Helper for custom messages
function showCustomMessage(element, text, type) {
  element.textContent = text;
  element.className = `form-message ${type}`;
  element.style.display = 'block';
  setTimeout(() => {
    element.style.display = 'none';
  }, 3000);
}

// Show message
function showMessage(text, type) {
  updateMessage.textContent = text;
  updateMessage.className = `form-message ${type}`;
  updateMessage.style.display = 'block';

  setTimeout(() => {
    updateMessage.style.display = 'none';
  }, 3000);
}
