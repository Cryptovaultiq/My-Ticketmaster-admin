export default function handler(req, res) {
  // Return environment variables to the client
  // IMPORTANT: This MUST use My-Ticketmaster-admin, not Rahman-ticket-admin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  return res.status(200).json({
    githubToken: process.env.GITHUB_TOKEN || '',
    githubRepo: 'Cryptovaultiq/My-Ticketmaster-admin', // Force correct repo
    githubBranch: process.env.GITHUB_BRANCH || 'main'
  });
}
