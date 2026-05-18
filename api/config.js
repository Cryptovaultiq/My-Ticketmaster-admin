export default function handler(req, res) {
  // Return environment variables to the client
  // SECURITY: Force ONLY My-Ticketmaster-admin repo - NO fallback allowed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Prevent any accidental override via environment variable
  if (process.env.GITHUB_REPO && process.env.GITHUB_REPO !== 'Cryptovaultiq/My-Ticketmaster-admin') {
    console.error(`⚠️ SECURITY: Attempted to use wrong repo: ${process.env.GITHUB_REPO}`);
  }
  
  return res.status(200).json({
    githubToken: process.env.GITHUB_TOKEN || '',
    githubRepo: 'Cryptovaultiq/My-Ticketmaster-admin', // HARDCODED - Cannot be overridden
    githubBranch: process.env.GITHUB_BRANCH || 'main'
  });
}
