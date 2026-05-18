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
    console.error(`🚫 BLOCKED: Config request from unauthorized origin: ${origin || 'NO_ORIGIN'}`);
    res.setHeader('Access-Control-Allow-Origin', 'null');
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  console.log(`✅ Config API: Request allowed from ${origin}`);
  
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
    console.error(`🔐 BLOCKED: Config request without valid token from ${origin}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  }
  
  // Return environment variables to the client
  // SECURITY: Force ONLY My-Ticketmaster-admin repo - NO fallback allowed
  if (process.env.GITHUB_REPO && process.env.GITHUB_REPO !== 'Cryptovaultiq/My-Ticketmaster-admin') {
    console.error(`⚠️ SECURITY: Attempted to use wrong repo: ${process.env.GITHUB_REPO}`);
  }
  
  console.log(`✅ Config requested by: ${origin}, repo: Cryptovaultiq/My-Ticketmaster-admin`);
  
  return res.status(200).json({
    githubToken: process.env.GITHUB_TOKEN || '',
    githubRepo: 'Cryptovaultiq/My-Ticketmaster-admin', // HARDCODED - Cannot be overridden
    githubBranch: process.env.GITHUB_BRANCH || 'main'
  });
}
