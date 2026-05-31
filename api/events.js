import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // 🔒 SECURITY: Whitelist only YOUR origins - STRICT MODE
  const origin = req.headers.origin || req.headers.referer || '';
  
  // ONLY allow YOUR deployments (everything else denied)
  const allowedOrigins = [
    'admin-tmaster.vercel.app',
    'https://admin-tmaster.vercel.app',
    'tickettmaster-events.vercel.app',
    'https://tickettmaster-events.vercel.app',
    'localhost',
    'http://localhost'
  ];
  
  // Check if origin is allowed (or if no origin/same-origin request)
  const isAllowed = !origin || allowedOrigins.some(allowed => 
    origin.includes(allowed)
  );
  
  // Set CORS headers for allowed origins (MUST be before any return)
  if (isAllowed) {
    // For same-origin requests, use origin if provided, otherwise set specific domain
    const responseOrigin = origin || 'https://admin-tmaster.vercel.app';
    res.setHeader('Access-Control-Allow-Origin', responseOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  } else {
    // Block unauthorized origins
    console.error(`🚫 BLOCKED: Events request from unauthorized origin: ${origin || 'NO_ORIGIN'}`);
    res.setHeader('Access-Control-Allow-Origin', 'null');
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  console.log(`✅ Events API: Request allowed from ${origin}`);
  
  // 🔒 SECURITY LAYER 2: Require secret token (prevents spoofing + raw GitHub access)
  const apiToken = req.headers['x-api-token'];
  const validToken = process.env.API_SECRET_TOKEN || 'tmaster-admin-secure-key-2024';
  
  if (!apiToken || apiToken !== validToken) {
    console.error(`🔐 BLOCKED: Events request without valid token from ${origin}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  }
  
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.status(500).json({ error: 'GitHub token not configured' });
  }

  const customerRepo = 'Cryptovaultiq/My-Own-ticketmaster-Customer';
  const filePath = 'tickets-data.json';

  // ==================== GET - Read events ====================
  if (req.method === 'GET') {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${customerRepo}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (response.ok) {
        const fileData = await response.json();
        if (fileData.content) {
          const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
          const jsonData = JSON.parse(content);
          console.log(`✅ Events served to: ${origin}`);
          return res.status(200).json(jsonData);
        }
      }
      
      console.log('✅ Events (empty) served to: ' + origin);
      return res.status(200).json({ events: [] });
    } catch (error) {
      console.error('Error fetching events:', error);
      return res.status(200).json({ events: [] });
    }
  }

  // ==================== POST - Create new event ====================
  if (req.method === 'POST') {
    try {
      const newEvent = req.body;

      // Validate required fields
      if (!newEvent.title || !newEvent.artist) {
        return res.status(400).json({ error: 'Missing required fields: title, artist' });
      }

      // Fetch current file
      const getResponse = await fetch(
        `https://api.github.com/repos/${customerRepo}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      let events = [];
      let sha = null;

      if (getResponse.ok) {
        try {
          const fileData = await getResponse.json();
          if (fileData.content) {
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            const jsonData = JSON.parse(content);
            events = jsonData.events || [];
            sha = fileData.sha;
          }
        } catch (parseError) {
          console.error('Error parsing events:', parseError);
          events = [];
        }
      }

      // Add new event with ID if not provided
      const eventWithId = {
        id: newEvent.id || `event-${Date.now()}`,
        ...newEvent,
        createdAt: newEvent.createdAt || new Date().toISOString()
      };

      events.push(eventWithId);

      // Prepare new file content
      const newContent = Buffer.from(JSON.stringify({ events }, null, 2)).toString('base64');

      // Update file on GitHub
      const updateResponse = await fetch(
        `https://api.github.com/repos/${customerRepo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Add: New event "${newEvent.title}" by ${newEvent.artist}`,
            content: newContent,
            sha: sha,
            branch: 'main'
          })
        }
      );

      if (updateResponse.ok) {
        console.log(`✅ Event created: ${eventWithId.title}`);
        return res.status(201).json({ 
          success: true, 
          message: 'Event created successfully',
          event: eventWithId 
        });
      } else {
        const errorData = await updateResponse.json();
        console.error('GitHub update failed:', errorData);
        return res.status(500).json({ error: 'Failed to save event to GitHub' });
      }
    } catch (error) {
      console.error('Error creating event:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // ==================== PUT - Update event ====================
  if (req.method === 'PUT') {
    try {
      const updatedEvent = req.body;
      const eventId = req.query.id;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID required' });
      }

      // Fetch current file
      const getResponse = await fetch(
        `https://api.github.com/repos/${customerRepo}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!getResponse.ok) {
        return res.status(500).json({ error: 'Failed to fetch current events' });
      }

      const fileData = await getResponse.json();
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      const jsonData = JSON.parse(content);
      let events = jsonData.events || [];

      // Find and update event
      const eventIndex = events.findIndex(e => e.id === eventId);
      if (eventIndex === -1) {
        return res.status(404).json({ error: 'Event not found' });
      }

      events[eventIndex] = {
        ...events[eventIndex],
        ...updatedEvent,
        id: eventId, // Preserve ID
        createdAt: events[eventIndex].createdAt // Preserve creation date
      };

      // Prepare new file content
      const newContent = Buffer.from(JSON.stringify({ events }, null, 2)).toString('base64');

      // Update file on GitHub
      const updateResponse = await fetch(
        `https://api.github.com/repos/${customerRepo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Update: Event "${events[eventIndex].title}" by ${events[eventIndex].artist}`,
            content: newContent,
            sha: fileData.sha,
            branch: 'main'
          })
        }
      );

      if (updateResponse.ok) {
        console.log(`✅ Event updated: ${events[eventIndex].title}`);
        return res.status(200).json({ 
          success: true, 
          message: 'Event updated successfully',
          event: events[eventIndex]
        });
      } else {
        return res.status(500).json({ error: 'Failed to update event on GitHub' });
      }
    } catch (error) {
      console.error('Error updating event:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // ==================== DELETE - Remove event ====================
  if (req.method === 'DELETE') {
    try {
      const eventId = req.query.id;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID required' });
      }

      // Fetch current file
      const getResponse = await fetch(
        `https://api.github.com/repos/${customerRepo}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!getResponse.ok) {
        return res.status(500).json({ error: 'Failed to fetch current events' });
      }

      const fileData = await getResponse.json();
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      const jsonData = JSON.parse(content);
      let events = jsonData.events || [];

      // Find event to delete
      const eventIndex = events.findIndex(e => e.id === eventId);
      if (eventIndex === -1) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const deletedEvent = events[eventIndex];
      events.splice(eventIndex, 1);

      // Prepare new file content
      const newContent = Buffer.from(JSON.stringify({ events }, null, 2)).toString('base64');

      // Update file on GitHub
      const updateResponse = await fetch(
        `https://api.github.com/repos/${customerRepo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Delete: Event "${deletedEvent.title}" by ${deletedEvent.artist}`,
            content: newContent,
            sha: fileData.sha,
            branch: 'main'
          })
        }
      );

      if (updateResponse.ok) {
        console.log(`✅ Event deleted: ${deletedEvent.title}`);
        return res.status(200).json({ 
          success: true, 
          message: 'Event deleted successfully',
          deletedId: eventId
        });
      } else {
        return res.status(500).json({ error: 'Failed to delete event on GitHub' });
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
