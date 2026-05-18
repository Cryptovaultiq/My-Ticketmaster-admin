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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = 'Cryptovaultiq/My-Ticketmaster-admin';
  const githubBranch = process.env.GITHUB_BRANCH || 'main';

  console.log(`📝 Submissions API: Writing to repo: ${githubRepo}, branch: ${githubBranch}`);

  if (!githubToken) {
    return res.status(500).json({ error: 'GitHub not configured' });
  }

  // HANDLE GET - Return submissions
  if (req.method === 'GET') {
    try {
      if (!githubToken) {
        return res.status(200).json({ submissions: [] });
      }

      const getResponse = await fetch(
        `https://api.github.com/repos/${githubRepo}/contents/submissions.json`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (getResponse.ok) {
        const fileData = await getResponse.json();
        if (fileData.content) {
          try {
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            const jsonData = JSON.parse(content);
            return res.status(200).json({ submissions: jsonData.submissions || [] });
          } catch (parseError) {
            console.error('Error parsing submissions:', parseError);
            return res.status(200).json({ submissions: [] });
          }
        }
      }
      
      // File doesn't exist or not found - return empty submissions
      return res.status(200).json({ submissions: [] });
    } catch (error) {
      console.error('Error fetching submissions:', error);
      // Return empty submissions instead of 500 error
      return res.status(200).json({ submissions: [] });
    }
  }

  // HANDLE POST - Save new submission
  if (req.method === 'POST') {
    try {
      const submission = req.body;
      
      // Validate submission data
      if (!submission.email || !submission.eventTitle) {
        return res.status(400).json({ error: 'Missing required fields' });
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
        try {
          const fileData = await getResponse.json();
          if (fileData.content) {
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            const jsonData = JSON.parse(content);
            submissions = jsonData.submissions || [];
            sha = fileData.sha;
          }
        } catch (parseError) {
          console.error('Error parsing existing submissions:', parseError);
          submissions = [];
          sha = getResponse.headers.get('x-github-sha') || null;
        }
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

      console.log(`✅ Submission saved from ${submission.email} to ${githubRepo}`);

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

  return res.status(405).json({ error: 'Method not allowed' });
}
