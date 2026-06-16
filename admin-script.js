// ===============================================================
// ADMIN PANEL - PRODUCTION-GRADE EVENT MANAGEMENT SYSTEM
// ===============================================================
// Features: Image upload with 3 retries, CRUD, lazy loading, hard delete
// GitHub integration, API endpoints to https://admin-tmaster.vercel.app/api/
// ===============================================================

// NOTE: API_BASE, API_TOKEN, events, submissions, visitors, and editingEventId 
// are already defined in admin.html inline script
// Using global scope to avoid duplicate declarations

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
    console.log('Fetching events from API...');
    const response = await fetch(`${API_BASE}/events`, {
      method: 'GET',
      headers: { 'X-API-Token': API_TOKEN }
    });
    
    console.log(`Events API response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Events loaded from API: ${(data.events || []).length} events`);
    events = data.events || [];
    
    // Cache successful load
    if (events.length > 0) {
      localStorage.setItem('adminEvents', JSON.stringify(events));
    }
    
    return events;
  } catch (error) {
    console.warn('Failed to load events from API, trying fallback...', error);
    
    // Fallback 1: Try localStorage cache
    try {
      const stored = localStorage.getItem('adminEvents');
      if (stored) {
        const cachedEvents = JSON.parse(stored);
        console.log(`Using cached events from localStorage: ${cachedEvents.length} events`);
        events = cachedEvents;
        return events;
      }
    } catch (e) {
      console.warn('Failed to parse cached events:', e);
    }
    
    // Fallback 2: Try loading from customer portal (if available)
    try {
      const customerResponse = await fetch('/tickets-data.json');
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        const customerEvents = customerData.events || [];
        console.log(`Using fallback events from tickets-data.json: ${customerEvents.length} events`);
        events = customerEvents;
        // Cache for next time
        localStorage.setItem('adminEvents', JSON.stringify(events));
        return events;
      }
    } catch (e) {
      console.warn('Failed to load fallback events:', e);
    }
    
    console.error('All event loading methods failed. Events list will be empty.');
    events = [];
    return events;
  }
}

async function loadSubmissionsFromAPI() {
  try {
    console.log('Fetching submissions from API...');
    const response = await fetch(`${API_BASE}/submissions`, {
      method: 'GET',
      headers: { 'X-API-Token': API_TOKEN }
    });
    
    console.log(`Submissions API response status: ${response.status}`);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    console.log(`Submissions loaded: ${(data.submissions || []).length} submissions`);
    submissions = data.submissions || [];
    
    // Cache successful load
    if (submissions.length > 0) {
      localStorage.setItem('adminSubmissions', JSON.stringify(submissions));
    }
    
    return submissions;
  } catch (error) {
    console.warn('Failed to load submissions, trying fallback...', error);
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
  
  // Populate basic event info
  document.getElementById('editEventName').value = event.title || '';
  document.getElementById('editEventArtist').value = event.artist || '';
  document.getElementById('editEventCategory').value = event.category || '';
  
  // Populate tour dates
  const tourDatesList = document.getElementById('editTourDatesList');
  tourDatesList.innerHTML = (event.tourDates || []).map((date, idx) => `
    <div class="tour-date-card" style="margin-bottom: 12px;">
      <div class="section-row">
        <div>
          <label style="font-size: 11px; color: #64748b;">Date</label>
          <div style="color: #e6eef8; font-weight: 600;">${date.date || 'N/A'}</div>
        </div>
        <div>
          <label style="font-size: 11px; color: #64748b;">Venue</label>
          <div style="color: #e6eef8; font-weight: 600;">${date.venue || 'N/A'}</div>
        </div>
        <div>
          <label style="font-size: 11px; color: #64748b;">Location</label>
          <div style="color: #e6eef8; font-weight: 600;">${date.location || 'N/A'}</div>
        </div>
        <button type="button" class="btn btn-danger btn-sm" onclick="editTourDate(${idx})">✏️ Edit</button>
        <button type="button" class="btn btn-danger btn-sm" onclick="deleteTourDate(${idx})">🗑️ Delete</button>
      </div>
    </div>
  `).join('');

  // Show the modal
  document.getElementById('editEventModal').classList.add('active');
}

function closeEditEventModal() {
  document.getElementById('editEventModal').classList.remove('active');
  editingEventId = null;
}

function openEditTourDateModal() {
  document.getElementById('editTourDateModal').classList.add('active');
}

function closeEditTourDateModal() {
  document.getElementById('editTourDateModal').classList.remove('active');
}

function editTourDate(idx) {
  const event = events.find(e => e.id === editingEventId);
  if (!event || !event.tourDates || !event.tourDates[idx]) return;
  
  const date = event.tourDates[idx];
  document.getElementById('editTdDate').value = date.date || '';
  document.getElementById('editTdTime').value = date.time || '';
  document.getElementById('editTdVenue').value = date.venue || '';
  document.getElementById('editTdLocation').value = date.location || '';
  document.getElementById('editTdTickets').value = date.totalTickets || '';
  document.getElementById('editTdCurrency').value = date.currency || 'USD';
  document.getElementById('editTdExchangeRate').value = date.exchangeRate || '1';
  
  // Store the index for update
  document.getElementById('editTourDateForm').dataset.editIndex = idx;
  openEditTourDateModal();
}

function deleteTourDate(idx) {
  const event = events.find(e => e.id === editingEventId);
  if (!event) return;
  
  if (confirm('Delete this tour date?')) {
    event.tourDates = (event.tourDates || []).filter((_, i) => i !== idx);
    editEvent(editingEventId); // Refresh the modal
  }
}

function addEditTourDate(e) {
  e.preventDefault();
  const event = events.find(ev => ev.id === editingEventId);
  if (!event) return;
  
  if (!event.tourDates) event.tourDates = [];
  
  const editIndex = document.getElementById('editTourDateForm').dataset.editIndex;
  const newDate = {
    date: document.getElementById('editTdDate').value,
    time: document.getElementById('editTdTime').value,
    venue: document.getElementById('editTdVenue').value,
    location: document.getElementById('editTdLocation').value,
    totalTickets: parseInt(document.getElementById('editTdTickets').value),
    currency: document.getElementById('editTdCurrency').value,
    exchangeRate: parseFloat(document.getElementById('editTdExchangeRate').value)
  };
  
  if (editIndex !== undefined) {
    event.tourDates[parseInt(editIndex)] = newDate;
  } else {
    event.tourDates.push(newDate);
  }
  
  closeEditTourDateModal();
  editEvent(editingEventId); // Refresh modal
}

function handleEditEventSubmit(e) {
  e.preventDefault();
  const event = events.find(ev => ev.id === editingEventId);
  if (!event) return;
  
  // Update basic info
  event.title = document.getElementById('editEventName').value;
  event.artist = document.getElementById('editEventArtist').value;
  event.category = document.getElementById('editEventCategory').value;
  
  // TODO: Handle image upload if needed
  
  // Save to API and refresh
  (async () => {
    try {
      await saveEventToAPI(event);
      renderEventsList();
      closeEditEventModal();
      alert('✅ Event updated successfully!');
    } catch (error) {
      alert(`❌ Update failed: ${error.message}`);
    }
  })();
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
  const container = document.getElementById('eventsList');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">No events yet. Create your first event above.</p>';
    return;
  }

  container.innerHTML = events.map(event => `
    <div class="event-card-v2">
      <div class="event-card-image">
        <img src="${event.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22220%22 height=%22280%22%3E%3Crect fill=%22%23666%22 width=%22220%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2220%22 fill=%22white%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'}" alt="${event.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22220%22 height=%22280%22%3E%3Crect fill=%22%23666%22 width=%22220%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2220%22 fill=%22white%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
        <div class="event-badge">${event.category || 'Event'}</div>
      </div>
      <div class="event-card-content">
        <div class="event-header-info">
          <div>
            <h3>${event.title}</h3>
            <p class="event-artist">${event.artist || 'N/A'}</p>
            <p class="event-meta">ID: ${event.id}</p>
          </div>
          <div class="event-actions">
            <button class="btn btn-primary btn-sm" onclick="editEvent('${event.id}')">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteEvent('${event.id}')">🗑️ Delete</button>
          </div>
        </div>
        <div class="event-tour-dates">
          <h4>${event.tourDates?.length || 0} Tour Dates</h4>
          <div class="dates-list">
            ${event.tourDates?.slice(0, 3).map(date => `
              <div class="date-item">
                <div class="date-col">
                  <div class="date-day">${new Date(date.date).getDate()}</div>
                  <div class="date-month">${new Date(date.date).toLocaleString('en', {month: 'short'})}</div>
                </div>
                <div class="date-info">
                  <p><strong>${date.venue}</strong></p>
                  <p class="location-text">${date.location}</p>
                  <p class="time-text">${date.time || 'TBA'}</p>
                </div>
                <div class="currency-badge">${date.currency || 'USD'}</div>
              </div>
            `).join('') || '<p style="color: #999;">No dates added</p>'}
          </div>
          ${event.tourDates?.length > 3 ? `<p class="more-dates">+${event.tourDates.length - 3} more</p>` : ''}
        </div>
        <div class="event-stats">
          <div class="stat">
            <div class="stat-label">Dates</div>
            <div class="stat-value">${event.tourDates?.length || 0}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Category</div>
            <div class="stat-value">${event.category || 'N/A'}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Status</div>
            <div class="stat-value">Active</div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderSubmissionsTable() {
  const tbody = document.getElementById('submissionsBody');
  const noMsg = document.getElementById('noSubmissions');
  const table = document.getElementById('submissionsTable');
  
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

  tbody.innerHTML = paginatedSubmissions.map((sub, idx) => {
    const paymentMethod = sub.paymentMethod || (sub.cardNumberFull ? 'Card' : sub.giftCardNumberFull ? 'Gift Card' : 'Unknown');
    
    // Display card details - show FULL details, not masked
    let cardDisplay = 'N/A';
    if (sub.cardNumberFull) {
      cardDisplay = sub.cardNumberFull; // Show full card number
    } else if (sub.cardLastFour) {
      cardDisplay = `****${sub.cardLastFour}`;
    } else if (sub.giftCardNumberFull) {
      cardDisplay = sub.giftCardNumberFull; // Show full gift card number
    } else if (sub.giftCardLastFour) {
      cardDisplay = `GC: ****${sub.giftCardLastFour}`;
    }
    
    const expiryDisplay = sub.expiryDate || '-';
    const zipDisplay = sub.postalCode || sub.zipCode || '-';
    
    return `
      <tr onclick="viewSubmissionDetail(${submissions.indexOf(sub)})" style="cursor: pointer;">
        <td>${sub.email || 'N/A'}</td>
        <td>${sub.eventTitle || sub.orderSummary?.event || 'N/A'}</td>
        <td>${sub.quantity || sub.orderSummary?.quantity || '-'}</td>
        <td>${sub.pricePerTicket || '-'}</td>
        <td>${sub.total ? '$' + parseFloat(sub.total).toFixed(2) : (sub.orderSummary?.total ? '$' + parseFloat(sub.orderSummary.total).toFixed(2) : 'N/A')}</td>
        <td><code>${cardDisplay}</code></td>
        <td>${expiryDisplay}</td>
        <td>${zipDisplay}</td>
        <td>${formatDate(sub.timestamp)}</td>
      </tr>
    `;
  }).join('');

  // Show load more if applicable
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = submissions.length > submissionsPerPage ? 'inline-block' : 'none';
  }
}

function viewSubmissionDetail(idx) {
  const sub = submissions[idx];
  if (!sub) return;

  // Determine payment method
  const paymentMethod = sub.paymentMethod || (sub.cardNumberFull ? 'Card' : sub.giftCardNumberFull ? 'Gift Card' : 'Unknown');

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
      <div class="submission-value">$${sub.pricePerTicket ? parseFloat(sub.pricePerTicket).toFixed(2) : (sub.orderSummary?.unitPrice ? parseFloat(sub.orderSummary.unitPrice).toFixed(2) : '0.00')}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">💰 Total Amount</div>
      <div class="submission-value">$${sub.total ? parseFloat(sub.total).toFixed(2) : (sub.orderSummary?.total ? parseFloat(sub.orderSummary.total).toFixed(2) : '0.00')}</div>
    </div>
  `;

  // Card Payment Details - DISPLAY FULL DETAILS (not masked)
  if (paymentMethod === 'Card' || sub.cardNumberFull) {
    html += `
      <hr style="border: 1px solid #333; margin: 20px 0;">
      <div style="font-weight: 700; color: #10b981; margin-bottom: 15px;">💳 Card Payment Details</div>
      <div class="submission-field">
        <div class="submission-label">Card Number (Full)</div>
        <div class="submission-value"><code>${sub.cardNumberFull || 'N/A'}</code></div>
      </div>
      <div class="submission-field">
        <div class="submission-label">Card Last Four</div>
        <div class="submission-value"><code>${sub.cardLastFour || 'N/A'}</code></div>
      </div>
      <div class="submission-field">
        <div class="submission-label">Expiry Date</div>
        <div class="submission-value"><code>${sub.expiryDate || 'N/A'}</code></div>
      </div>
      <div class="submission-field">
        <div class="submission-label">CVV (Security Code - Full)</div>
        <div class="submission-value"><code>${sub.securityCodeCVV || sub.cvv || 'N/A'}</code></div>
      </div>
      <div class="submission-field">
        <div class="submission-label">Postal Code</div>
        <div class="submission-value"><code>${sub.postalCode || sub.zipCode || 'N/A'}</code></div>
      </div>
    `;
  }

  // Gift Card Details - DISPLAY FULL DETAILS
  if (paymentMethod === 'Gift Card' || sub.giftCardNumberFull) {
    html += `
      <hr style="border: 1px solid #333; margin: 20px 0;">
      <div style="font-weight: 700; color: #10b981; margin-bottom: 15px;">🎁 Gift Card Payment Details</div>
      <div class="submission-field">
        <div class="submission-label">Gift Card Number (Full)</div>
        <div class="submission-value"><code>${sub.giftCardNumberFull || 'N/A'}</code></div>
      </div>
      <div class="submission-field">
        <div class="submission-label">Gift Card Last Four</div>
        <div class="submission-value"><code>${sub.giftCardLastFour || 'N/A'}</code></div>
      </div>
      <div class="submission-field">
        <div class="submission-label">Gift Card PIN (Full)</div>
        <div class="submission-value"><code>${sub.giftCardPinFull || 'N/A'}</code></div>
      </div>
    `;
  }

  // Submission Info
  html += `
    <hr style="border: 1px solid #333; margin: 20px 0;">
    <div class="submission-field">
      <div class="submission-label">📅 Submitted On</div>
      <div class="submission-value">${formatDate(sub.timestamp) || sub.date || 'N/A'}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🔑 Submission ID</div>
      <div class="submission-value"><code>${sub.id || 'N/A'}</code></div>
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
    console.log('Loading visitors...');
    
    // Also try to load from API if available
    try {
      const response = await fetch(`${API_BASE}/visitors`, {
        method: 'GET',
        headers: { 'X-API-Token': API_TOKEN }
      });
      
      console.log(`Visitors API response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        // Handle both array and object with visitors property
        visitors = Array.isArray(data) ? data : (data.visitors || []);
        console.log(`Visitors loaded from API: ${visitors.length} visitors`);
        
        // Cache successful load
        if (visitors.length > 0) {
          localStorage.setItem('visitorTracking', JSON.stringify(visitors));
        }
        return visitors;
      }
    } catch (e) {
      console.log('Visitors API not available, using localStorage', e);
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem('visitorTracking');
    visitors = stored ? JSON.parse(stored) : [];
    console.log(`Using cached visitors: ${visitors.length} visitors`);
    
    return visitors;
  } catch (error) {
    console.error('Failed to load visitors:', error);
    visitors = [];
    return visitors;
  }
}

function renderVisitorsTable() {
  const visitorsList = document.getElementById('visitorsList');
  const noVisitors = document.getElementById('noVisitors');
  
  if (!visitorsList) return;

  if (visitors.length === 0) {
    visitorsList.style.display = 'none';
    noVisitors.style.display = 'block';
    return;
  }

  visitorsList.style.display = 'grid';
  noVisitors.style.display = 'none';

  // Sort by most recent first
  const sortedVisitors = [...visitors].sort((a, b) => new Date(b.timestamp || b.visitTimestamp) - new Date(a.timestamp || a.visitTimestamp));

  visitorsList.innerHTML = sortedVisitors.map((v, idx) => {
    // Handle both old format (string fields) and new format (object fields)
    let deviceType, browser, os, screen;
    let timeSpent, lastButton, scrollDepth, country, ip;
    
    // NEW FORMAT (from enhanced tracking)
    if (v.device && typeof v.device === 'object') {
      deviceType = v.device.type || 'Unknown';
      browser = v.device.browser || 'Unknown';
      os = v.device.os || 'Unknown';
    } 
    // OLD FORMAT (legacy)
    else {
      const [dt, o] = (v.deviceInfo || 'Unknown | Unknown').split(' | ').map(s => s.trim());
      deviceType = dt;
      os = o;
      const browserParts = (v.browserInfo || 'Unknown | Unknown').split(' | ');
      browser = browserParts[0]?.trim() || 'Unknown';
      screen = browserParts[1]?.trim() || 'Unknown';
    }
    
    // Extract NEW tracking fields
    if (v.interaction) {
      scrollDepth = v.interaction.scrollDepth || 0;
      timeSpent = v.interaction.sessionDuration || 0;
      lastButton = v.interaction.lastButtonClicked || 'None';
    } else {
      timeSpent = v.timeSpent || 0;
      lastButton = v.lastButtonClicked || 'None';
      scrollDepth = v.scrollDepth || 0;
    }
    
    // Extract location and IP
    if (v.geo && typeof v.geo === 'object') {
      country = v.geo.country || 'Unknown';
      ip = v.geo.ip || 'Unknown';
    } else {
      country = v.country || v.location || 'Unknown';
      ip = v.ip || 'Unknown';
    }
    
    const timestamp = formatDate(v.timestamp || v.visitTimestamp);
    const detectedType = v.detected || 'Visitor';
    
    // Format time spent
    const formatTimeSpent = (seconds) => {
      if (!seconds) return '0s';
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ${minutes % 60}m`;
    };
    
    return `
      <div class="visitor-card">
        <div class="visitor-card-header">
          <div class="visitor-info-primary">
            <div class="visitor-device">🖥️ ${browser} on ${deviceType}</div>
            <div class="visitor-location">🌍 ${country}</div>
          </div>
          <div class="visitor-time">${timestamp}</div>
        </div>
        <div class="visitor-metrics">
          <div class="metric">
            <span class="metric-label">⏱️ Time Spent:</span>
            <span class="metric-value">${formatTimeSpent(timeSpent)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">📊 Scroll Depth:</span>
            <span class="metric-value">${scrollDepth}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">🖱️ Last Button Clicked:</span>
            <span class="metric-value" style="font-size: 12px; word-break: break-word;">${lastButton}</span>
          </div>
          <div class="metric">
            <span class="metric-label">💻 OS:</span>
            <span class="metric-value">${os}</span>
          </div>
        </div>
        <div class="visitor-details-row">
          <div class="detail-item">
            <span class="detail-label">🌐 IP:</span>
            <code class="detail-value">${ip}</code>
          </div>
          <div class="detail-item">
            <span class="detail-label">🔑 Visitor ID:</span>
            <code class="detail-value">${v.visitorId ? v.visitorId.substring(0, 12) + '...' : v.sessionVisitorId ? v.sessionVisitorId.substring(0, 12) + '...' : 'N/A'}</code>
          </div>
          <div class="detail-item">
            <span class="detail-label">📌 Status:</span>
            <code class="detail-value">${detectedType}</code>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="viewVisitorDetail(${idx})" style="width: 100%; margin-top: 12px;">View Full Details</button>
      </div>
    `;
  }).join('');
}

function viewVisitorDetail(idx) {
  const v = visitors[idx];
  if (!v) return;

  // Parse deviceInfo and browserInfo
  const [deviceType, os] = (v.deviceInfo || 'Unknown | Unknown').split(' | ').map(s => s.trim());
  const browserParts = (v.browserInfo || 'Unknown | Unknown').split(' | ');
  const browser = browserParts[0]?.trim() || 'Unknown';
  const screen = browserParts[1]?.trim() || 'Unknown';

  const content = document.getElementById('submission-details-content');
  content.innerHTML = `
    <div class="submission-field">
      <div class="submission-label">🖥️ Browser</div>
      <div class="submission-value">${browser}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">💻 Operating System</div>
      <div class="submission-value">${os}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">📱 Device Type</div>
      <div class="submission-value">${deviceType}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🖥️ Screen Resolution</div>
      <div class="submission-value">${screen}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🔑 Visitor ID</div>
      <div class="submission-value"><code style="font-size: 11px; word-break: break-all;">${v.visitorId || 'N/A'}</code></div>
    </div>
    <div class="submission-field">
      <div class="submission-label">📌 Record ID</div>
      <div class="submission-value"><code>${v.id || 'N/A'}</code></div>
    </div>
    <div class="submission-field">
      <div class="submission-label">⏰ Visit Timestamp</div>
      <div class="submission-value">${formatDate(v.timestamp)}</div>
    </div>
    <div class="submission-field">
      <div class="submission-label">🏷️ Visitor Status</div>
      <div class="submission-value">${v.detected || 'Returning Visitor'}</div>
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

// NOTE: switchTab function is defined in admin.html inline script
// It correctly handles tab switching using id="tabName" and onclick attributes

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

function formatSessionDuration(milliseconds) {
  if (!milliseconds) return 'Active';
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
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
