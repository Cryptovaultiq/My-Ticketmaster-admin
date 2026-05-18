export default async function handler(req, res) {
  // 🔒 SECURITY: Block only the known bad origin (Rahman)
  const origin = req.headers.origin || req.headers.referer;
  
  // Block requests from Rahman admin panel ONLY
  const blockedOrigins = [
    'admin-ticketmaaster.vercel.app',
    'https://admin-ticketmaaster.vercel.app'
  ];
  
  const isBlocked = blockedOrigins.some(blocked => 
    origin && origin.includes(blocked)
  );
  
  if (isBlocked) {
    console.error(`🚫 BLOCKED: Request from Rahman panel at ${origin}`);
    return res.status(403).json({ error: 'Forbidden: Request origin not authorized' });
  }
  
  // Allow all other origins
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 🔒 SECURITY: Only allow POST requests (block GET, DELETE, etc.)
  if (req.method !== 'POST') {
    console.error(`🚫 BLOCKED: Unauthorized method ${req.method} from ${origin}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const submission = req.body;
    
    // Validate submission data
    if (!submission.email || !submission.eventTitle) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get GitHub credentials from environment variables
    // SECURITY: Force ONLY My-Ticketmaster-admin repo - NO fallback allowed
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = 'Cryptovaultiq/My-Ticketmaster-admin'; // HARDCODED - Cannot be overridden
    const githubBranch = process.env.GITHUB_BRANCH || 'main';
    
    // Prevent any accidental override via environment variable
    if (process.env.GITHUB_REPO && process.env.GITHUB_REPO !== githubRepo) {
      console.error(`⚠️ SECURITY: Attempted to use wrong repo: ${process.env.GITHUB_REPO}`);
      console.error(`✅ Using correct repo instead: ${githubRepo}`);
    }

    if (!githubToken) {
      return res.status(500).json({ error: 'GitHub not configured' });
    }

    // Fetch current submissions.json from GitHub
    const getResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/submissions.json`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    let submissions = [];
    let sha = null;

    if (getResponse.ok) {
      const fileData = await getResponse.json();
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      const jsonData = JSON.parse(content);
      submissions = jsonData.submissions || [];
      sha = fileData.sha;
    }

    // Add new submission with timestamp
    const newSubmission = {
      id: Date.now(),
      ...submission,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
    };

    submissions.unshift(newSubmission);

    // Prepare new file content
    const fileContent = Buffer.from(JSON.stringify({ submissions }, null, 2)).toString('base64');

    // Upload to GitHub
    const putResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/submissions.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `Add submission from ${submission.email}`,
          content: fileContent,
          sha: sha,
          branch: githubBranch
        })
      }
    );

    if (!putResponse.ok) {
      console.error('GitHub upload failed:', await putResponse.text());
      return res.status(500).json({ error: 'Failed to save submission' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Submission saved',
      submission: newSubmission
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
