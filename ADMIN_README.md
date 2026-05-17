# Admin Panel - Event Management System

## 📌 Overview

This is the **Admin Panel** for managing events in the Ticketmaster ticket reselling platform. Admins can:
- ✅ Add, edit, and delete events
- ✅ Update event details (title, price, location, availability)
- ✅ Sync events to GitHub for persistent storage
- ✅ Pull events from GitHub to keep in sync
- ✅ Export events as JSON backup

## 🚀 Quick Start

### Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/ticketmaster-admin.git
cd ticketmaster-admin

# 2. Start local server
python -m http.server 8000

# 3. Open in browser
# Visit http://localhost:8000/admin.html
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Your admin panel is live!
# https://ticketmaster-admin.vercel.app
```

---

## 🎮 How to Use

### Adding an Event

1. Open admin panel
2. Fill in the form:
   - **Event Title**: Event name
   - **Location**: City and venue
   - **Date & Time**: Event date and time
   - **Price**: Ticket price ($)
   - **Available Tickets**: Number of tickets
   - **Image URL**: Path to event image
   - **Category**: Music, Football, Festival, etc.
3. Click **"Save Event"**

### Editing an Event

1. Find the event in the list
2. Click **"Edit"** button
3. Update the form fields
4. Click **"Save Event"**

### Deleting an Event

1. Find the event in the list
2. Click **"Delete"** button
3. Confirm deletion

### Syncing to GitHub

Before syncing, configure GitHub:

1. In **GitHub Storage Configuration** section:
   - **GitHub Token**: [Get from GitHub Settings](https://github.com/settings/tokens)
   - **Repository**: `your-username/ticketmaster-admin`
   - **Branch**: `main`
2. Click **"Save Configuration"**
3. Click **"Sync Events to GitHub"**

### Pulling from GitHub

To get latest events from GitHub:
1. Click **"Pull Events from GitHub"**
2. Events are loaded into the panel

### Exporting Events

To backup events as JSON file:
1. Click **"Export Events"** button
2. File downloads as `events-YYYY-MM-DD.json`

---

## 📁 File Structure

```
ticketmaster-admin/
├── admin.html              # Main admin interface
├── admin-script.js         # Admin logic (CRUD operations)
├── events.json             # Current events (auto-generated)
├── vercel.json             # Vercel deployment config
├── package.json            # Project metadata
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

---

## 🔑 GitHub Configuration

### Get GitHub Token

1. Visit [GitHub Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token"
3. Select scope: `repo`
4. Copy the token

### Configure in Admin Panel

1. Open admin.html
2. Scroll to "GitHub Storage Configuration"
3. Enter:
   - **Token**: Your personal access token
   - **Repository**: `owner/repo` (e.g., `holly/ticketmaster-admin`)
   - **Branch**: `main`
4. Click "Save Configuration"

Configuration is saved to browser's localStorage.

---

## 🔄 Event Data Structure

Each event contains:

```json
{
  "id": 1,
  "title": "Fred Again at Bancomer",
  "location": "México, CDMX, Expo Santa Fe",
  "dateTime": "Fri • Dec 12, 2025 • 8:00 PM",
  "price": 200,
  "ticketsAvailable": 4,
  "imageUrl": "Fred.jpg",
  "imageAlt": "Fred Again at Bancomer",
  "category": "Music"
}
```

---

## 💾 Data Storage

### Priority Order

1. **Browser LocalStorage** - Fastest (cache)
2. **GitHub Repository** - Persistent (backup)
3. **events.json** - Static fallback

### How Sync Works

**Admin Panel → GitHub:**
```
Edit Events → Save (localStorage) → Sync (GitHub)
```

**GitHub → Customer Page:**
```
Admin syncs → GitHub updated → Customer pulls on load
```

---

## 🔐 Security

### Token Safety

- ✅ Tokens stored in browser localStorage (not secure)
- ✅ For production, use environment variables
- ✅ Rotate tokens monthly
- ✅ Use minimal scopes (`repo` only)

### Best Practices

1. Never hardcode tokens in code
2. Use separate tokens for admin and customer repos
3. Delete old tokens regularly
4. Enable two-factor authentication on GitHub

---

## 🐛 Troubleshooting

### Events Not Saving

**Problem**: Events don't appear after refresh

**Solution**:
1. Check browser console (F12)
2. Try exporting events as backup
3. Refresh page (Ctrl+F5)
4. Check localStorage: `localStorage.getItem('events')`

### GitHub Sync Fails

**Problem**: "Error: Failed to sync to GitHub"

**Solution**:
1. Verify GitHub token is valid
2. Check repository format: `owner/repo`
3. Ensure token has `repo` scope
4. Check internet connection
5. Try in different browser

### Can't Pull from GitHub

**Problem**: Pull returns no data

**Solution**:
1. Verify `events.json` exists in repository
2. Check branch name (should be `main`)
3. Verify repository is public or token has access
4. Try syncing (creates file if missing)

---

## 📋 Event Categories

Predefined categories:
- Music
- Football
- Festival
- Sports
- Comedy
- Theater

(Add more in `admin.html` select options)

---

## 🔄 Workflow

### Typical Workflow

1. **Add Event** in admin panel
2. **Save Event** (stores locally)
3. **Verify** event appears in list
4. **Sync to GitHub** (pushes to repository)
5. **Customer page** automatically loads new events

### Team Workflow

1. **Admin A** adds event
2. **Admin A** syncs to GitHub
3. **Admin B** pulls from GitHub
4. **Both** see updated events
5. **Customer page** gets latest data

---

## 📊 API Integration (Future)

For real-time updates without manual sync:

```javascript
// Enable auto-sync every 5 minutes
setInterval(async () => {
  await manager.syncToGithub();
}, 300000);
```

---

## 🚀 Deployment Checklist

- [ ] GitHub token generated and valid
- [ ] Repository created (`ticketmaster-admin`)
- [ ] All files committed to git
- [ ] Vercel CLI installed
- [ ] Deployment successful
- [ ] Admin panel accessible at Vercel URL
- [ ] GitHub sync tested
- [ ] Events export tested
- [ ] Customer page configured

---

## 🔗 Links

- **Admin Panel**: https://ticketmaster-admin.vercel.app
- **Customer Page**: https://ticketmaster-customer.vercel.app
- **GitHub Repo**: https://github.com/YOUR_USERNAME/ticketmaster-admin
- **GitHub Tokens**: https://github.com/settings/tokens

---

## 📧 Support

For issues or questions:
1. Check browser console for errors
2. Review GitHub token configuration
3. Test GitHub API access
4. Check Vercel logs

---

## 📝 Changelog

### v1.0.0 - Initial Release
- ✅ Add/Edit/Delete events
- ✅ GitHub sync integration
- ✅ Export to JSON
- ✅ LocalStorage caching
- ✅ Responsive design

---

**Created**: May 2026  
**Version**: 1.0.0  
**Status**: Production Ready ✅
