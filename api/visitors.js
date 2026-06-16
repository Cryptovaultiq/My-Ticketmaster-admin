// =====================================================
// VISITOR ALERTS API ENDPOINT
// =====================================================

export default async function handler(req, res) {
  // Pre-process body for sendBeacon which sends as plain text without Content-Type
  if (req.method === 'POST') {
    // If body is a string (from sendBeacon text/plain), keep as-is
    // If body is Buffer, convert to string
    if (Buffer.isBuffer(req.body)) {
      req.body = req.body.toString('utf-8');
    }
  }

  // 🔒 CORS & Security headers
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5500',
    'https://tickettmaster-events.vercel.app',
    'https://admin-tmaster.vercel.app'
  ];

  // Allow empty origin (same-origin requests) or exact match
  const isAllowedOrigin = !origin || allowedOrigins.includes(origin);

  // Set CORS headers BEFORE checking origin (important for preflight)
  const responseOrigin = origin || 'https://admin-tmaster.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? responseOrigin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate origin (after CORS headers)
  if (!isAllowedOrigin) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  const API_SECRET_TOKEN = 'tmaster-admin-secure-key-2024';
  const token = req.headers['x-api-token'] || req.query.token;

  // Validate API token
  if (token !== API_SECRET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = 'My-Ticketmaster-admin';
  const githubOwner = 'Cryptovaultiq';
  const filePath = 'visitors.json';

  try {
    if (req.method === 'GET') {
      // Fetch visitors from GitHub
      const response = await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3.raw'
          }
        }
      );

      if (!response.ok) {
        return res.status(response.status).json({ visitors: [] });
      }

      const content = await response.text();
      const data = JSON.parse(content);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      // Add new visitor alert - handle both simplified and detailed formats
      let bodyData = req.body;
      let rawBody = bodyData;
      
      // Handle Buffer from sendBeacon (convert to string first)
      if (Buffer.isBuffer(bodyData)) {
        rawBody = bodyData.toString('utf-8');
      } else if (typeof bodyData === 'object' && bodyData !== null) {
        // Already parsed object - use as-is
        rawBody = bodyData;
      }
      
      // Parse JSON if body is a string (from sendBeacon)
      if (typeof rawBody === 'string') {
        try {
          bodyData = JSON.parse(rawBody);
          console.log('✓ Successfully parsed sendBeacon JSON, length:', rawBody.length);
        } catch (e) {
          console.error('❌ Failed to parse body as JSON:', e.message);
          console.error('Raw body (first 500 chars):', rawBody.substring(0, 500));
          return res.status(400).json({ error: 'Invalid JSON in request body' });
        }
      } else {
        bodyData = rawBody;
      }
      
      // Debug: log what we received
      console.log('📥 Received bodyData:', {
        type: typeof bodyData,
        isObject: typeof bodyData === 'object',
        hasDevice: !!bodyData?.device,
        hasGeo: !!bodyData?.geo,
        hasInteraction: !!bodyData?.interaction,
        hasTimeSpent: !!bodyData?.timeSpent,
        timeSpentValue: bodyData?.timeSpent,
        keys: bodyData && typeof bodyData === 'object' ? Object.keys(bodyData).slice(0, 10) : 'N/A'
      });
      
      let newVisitor = {};
      
      // Check if this is the detailed format from tickets.html
      if (bodyData.device && bodyData.geo && bodyData.interaction) {
        console.log('✅ Using DETAILED format handler');
        // Extract detailed visitor record and map to expected fields
        const { device, geo, page, interaction, sessionVisitorId, visitTimestamp, timeSpent } = bodyData;
        
        const screenMatch = device.userAgent?.match(/(\d+)x(\d+)/);
        
        newVisitor = {
          id: Date.now(),
          visitorId: sessionVisitorId || 'unknown',
          timestamp: visitTimestamp || new Date().toISOString(),
          
          // Device and browser info
          browser: device.browser || 'Unknown',
          device: device.type || 'Unknown',
          os: device.os || 'Unknown',
          deviceType: device.type || 'Unknown',
          screenResolution: screenMatch ? `${screenMatch[1]}x${screenMatch[2]}` : 'Unknown',
          
          // Location and IP
          location: geo.country || 'Unknown',
          country: geo.country || 'Unknown',
          city: geo.city || 'Unknown',
          region: geo.region || 'Unknown',
          ip: geo.ip || 'Unknown',
          
          // Interaction metrics
          scrollDepth: interaction.scrollDepth || 0,
          sessionDuration: interaction.sessionDuration || 0,
          clickCount: interaction.clickCount || 0,
          lastButtonClicked: interaction.lastButtonClicked || 'None',
          
          // Time spent
          timeSpent: timeSpent || interaction.sessionDuration || 0,
          
          // Page info
          pageUrl: page?.url || 'Unknown',
          pageLoadTime: page?.pageLoadTime || 0,
          timeOnPage: page?.timeOnPage || 0,
          
          // Legacy fields for compatibility
          deviceInfo: `${device.type || 'Unknown'} | ${device.os || 'Unknown'}`,
          browserInfo: `${device.browser || 'Unknown'} | Screen: ${screenMatch ? `${screenMatch[1]}x${screenMatch[2]}` : 'Unknown'}`,
          
          detected: 'New Visitor'
        };
      } else {
        console.log('⚠️ Using BACKWARD COMPATIBILITY format - detailed fields missing');
        // Handle simplified format for backward compatibility
        newVisitor = {
          id: Date.now(),
          visitorId: bodyData.visitorId || 'unknown',
          deviceInfo: bodyData.deviceInfo || 'Unknown',
          browserInfo: bodyData.browserInfo || 'Unknown',
          timestamp: bodyData.timestamp || new Date().toISOString(),
          browser: 'Unknown',
          device: 'Unknown',
          os: 'Unknown',
          location: 'Unknown',
          scrollDepth: 0,
          sessionDuration: 0,
          pageLoadTime: 0,
          ip: 'Unknown',
          detected: 'New Visitor'
        };
      }

      if (!newVisitor.visitorId || !newVisitor.timestamp) {
        console.error('Missing required fields:', { visitorId: newVisitor.visitorId, timestamp: newVisitor.timestamp });
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Log what we're about to save
      console.log('💾 Storing visitor record:', {
        visitor_id: newVisitor.visitorId,
        browser: newVisitor.browser,
        device: newVisitor.device,
        time_spent: newVisitor.timeSpent || 'N/A',
        last_button: newVisitor.lastButtonClicked || 'N/A'
      });

      // Fetch current visitors
      const getResponse = await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3.raw'
          }
        }
      );

      let visitors = [];
      if (getResponse.ok) {
        const content = await getResponse.text();
        const data = JSON.parse(content);
        visitors = data.visitors || [];
      }

      // Check if visitor already exists (prevent duplicates within 5 minutes)
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      const isDuplicate = visitors.some(v => 
        v.visitorId === newVisitor.visitorId && 
        new Date(v.timestamp).getTime() > fiveMinutesAgo
      );

      if (isDuplicate) {
        return res.status(200).json({ message: 'Duplicate visitor in last 5 minutes' });
      }

      visitors.unshift(newVisitor); // Add to top

      // Keep only last 100 visitors
      if (visitors.length > 100) {
        visitors = visitors.slice(0, 100);
      }

      // Get current file SHA for update
      const getShaResponse = await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      const shaData = await getShaResponse.json();
      const sha = shaData.sha;

      // Update file on GitHub
      const updateResponse = await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Add visitor alert: ${newVisitor.deviceInfo}`,
            content: Buffer.from(JSON.stringify({ visitors }, null, 2)).toString('base64'),
            sha: sha
          })
        }
      );

      if (!updateResponse.ok) {
        console.error('GitHub update failed:', await updateResponse.json());
        return res.status(500).json({ error: 'Failed to save visitor data' });
      }

      return res.status(200).json({ success: true, visitor: newVisitor });
    }

    if (req.method === 'DELETE') {
      // Clear all visitors
      const getShaResponse = await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      const shaData = await getShaResponse.json();
      const sha = shaData.sha;

      // Reset to empty
      const updateResponse = await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Clear all visitor alerts',
            content: Buffer.from(JSON.stringify({ visitors: [] }, null, 2)).toString('base64'),
            sha: sha
          })
        }
      );

      if (!updateResponse.ok) {
        return res.status(500).json({ error: 'Failed to clear visitors' });
      }

      return res.status(200).json({ success: true, message: 'All visitor alerts cleared' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
