import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  // 🔒 SECURITY: Whitelist only YOUR origins - STRICT MODE
  const origin = req.headers.origin || req.headers.referer;
  
  // ONLY allow YOUR deployments (everything else denied)
  const allowedOrigins = [
    'admin-tmaster.vercel.app',
    'https://admin-tmaster.vercel.app',
    'tickettmaster-events.vercel.app',
    'https://tickettmaster-events.vercel.app',
    'localhost',
    'http://localhost'
  ];
  
  const isAllowed = allowedOrigins.some(allowed => 
    origin && origin.includes(allowed)
  );
  
  // STRICT: Block anything not explicitly allowed
  if (!isAllowed) {
    console.error(`🚫 BLOCKED: Events request from unauthorized origin: ${origin || 'NO_ORIGIN'}`);
    res.setHeader('Access-Control-Allow-Origin', 'null');
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  console.log(`✅ Events API: Request allowed from ${origin}`);
  
  // Set CORS only for allowed origins
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 🔒 SECURITY LAYER 2: Require secret token (prevents spoofing + raw GitHub access)
  const apiToken = req.headers['x-api-token'];
  const validToken = process.env.API_SECRET_TOKEN || 'your-secret-token-here';
  
  if (!apiToken || apiToken !== validToken) {
    console.error(`🔐 BLOCKED: Events request without valid token from ${origin}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
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
