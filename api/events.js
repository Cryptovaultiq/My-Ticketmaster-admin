import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  // 🔒 SECURITY: Block Rahman from reading events
  const origin = req.headers.origin || req.headers.referer;
  
  // Block ALL requests from Rahman
  const blockedOrigins = [
    'admin-ticketmaaster.vercel.app',
    'https://admin-ticketmaaster.vercel.app',
    'ticketmaaster-events.vercel.app',
    'https://ticketmaaster-events.vercel.app'
  ];
  
  const isBlocked = blockedOrigins.some(blocked => 
    origin && origin.includes(blocked)
  );
  
  if (isBlocked) {
    console.error(`🚫 BLOCKED: Unauthorized events request from ${origin}`);
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Allow only YOUR deployments
  const allowedOrigins = [
    'admin-tmaster.vercel.app',
    'https://admin-tmaster.vercel.app',
    'tickettmaster-events.vercel.app',
    'https://tickettmaster-events.vercel.app',
    'localhost'
  ];
  
  const isAllowed = allowedOrigins.some(allowed => 
    origin && origin.includes(allowed)
  );
  
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : 'null');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    try {
      // Return events from environment or GitHub
      const githubToken = process.env.GITHUB_TOKEN;
      const githubRepo = 'Cryptovaultiq/My-Ticketmaster-admin';
      
      if (!githubToken) {
        return res.status(200).json({ events: [] });
      }

      // Fetch events from GitHub API
      const url = `https://api.github.com/repos/${githubRepo}/contents/events.json`;
      
      return fetch(url, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      .then(r => r.json())
      .then(data => {
        if (data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          const json = JSON.parse(content);
          console.log(`✅ Events served to: ${origin}`);
          res.status(200).json(json);
        } else {
          res.status(200).json({ events: [] });
        }
      })
      .catch(err => {
        console.error('Events fetch error:', err);
        res.status(200).json({ events: [] });
      });
    } catch (error) {
      console.error('Error fetching events:', error);
      return res.status(200).json({ events: [] });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
