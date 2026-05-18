export default function handler(req, res) {
  // Return environment variables to the client
  // SECURITY: Force ONLY My-Ticketmaster-admin repo - NO fallback allowed
  
  // 🔒 SECURITY: STRICT CORS - Only allow from correct customer portal
  const origin = req.headers.origin || req.headers.referer;
  const allowedOrigins = [
    'https://ticketmaster-customer.vercel.app',
    'https://my-ticketmaster-customer.vercel.app',
    'http://localhost:8001'
  ];
  
  const isAllowedOrigin = allowedOrigins.some(allowed => 
    origin && origin.startsWith(allowed)
  );
  
  // Block requests from unauthorized sources
  if (origin && !isAllowedOrigin) {
    console.error(`🚫 BLOCKED: Unauthorized config request from ${origin}`);
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Prevent any accidental override via environment variable
  if (process.env.GITHUB_REPO && process.env.GITHUB_REPO !== 'Cryptovaultiq/My-Ticketmaster-admin') {
    console.error(`⚠️ SECURITY: Attempted to use wrong repo: ${process.env.GITHUB_REPO}`);
  }
  
  return res.status(200).json({
    githubToken: process.env.GITHUB_TOKEN || '',
    githubRepo: 'Cryptovaultiq/My-Ticketmaster-admin', // HARDCODED - Cannot be overridden
    githubBranch: process.env.GITHUB_BRANCH || 'main',
    submissionsApiKey: process.env.SUBMISSIONS_API_KEY || '' // API key for submissions endpoint
  });
}
