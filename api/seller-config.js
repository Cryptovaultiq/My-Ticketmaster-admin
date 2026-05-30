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
  
  // Set CORS headers for allowed origins (MUST be before any return)
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  } else {
    // Block unauthorized origins
    console.error(`🚫 BLOCKED: Seller-config request from unauthorized origin: ${origin || 'NO_ORIGIN'}`);
    res.setHeader('Access-Control-Allow-Origin', 'null');
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  console.log(`✅ Seller-config API: Request allowed from ${origin}`);
  
  // 🔒 SECURITY LAYER 2: Require secret token (prevents spoofing + raw GitHub access)
  const apiToken = req.headers['x-api-token'];
  const validToken = process.env.API_SECRET_TOKEN || 'tmaster-admin-secure-key-2024';
  
  if (!apiToken || apiToken !== validToken) {
    console.error(`🔐 BLOCKED: Seller-config request without valid token from ${origin}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  }
  
  if (req.method === 'GET') {
    try {
      const githubToken = process.env.GITHUB_TOKEN;
      const githubRepo = 'Cryptovaultiq/My-Ticketmaster-admin';
      
      if (!githubToken) {
        return res.status(200).json({ sellerLink: 'https://twitter.com/@stavrimetaxa98' });
      }

      // Fetch seller-config from GitHub API
      const url = `https://api.github.com/repos/${githubRepo}/contents/seller-config.json`;
      
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
          console.log(`✅ Seller config served to: ${origin}`);
          res.status(200).json(json);
        } else {
          res.status(200).json({ sellerLink: 'https://twitter.com/@stavrimetaxa98' });
        }
      })
      .catch(err => {
        console.error('Seller config fetch error:', err);
        res.status(200).json({ sellerLink: 'https://twitter.com/@stavrimetaxa98' });
      });
    } catch (error) {
      console.error('Error fetching seller config:', error);
      return res.status(200).json({ sellerLink: 'https://twitter.com/@stavrimetaxa98' });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
