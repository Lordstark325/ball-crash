import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const owner = body.owner || 'Lordstark325';
    const repo = body.repo || 'Ball-Crash-';
    const path = body.path || '';
    const branch = body.branch || 'main';

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');

    const url = path
      ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
      : `https://api.github.com/repos/${owner}/${repo}/contents/?ref=${branch}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Base44-App'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      return Response.json({ error: `GitHub API error: ${response.status}`, details: errText }, { status: response.status });
    }

    const data = await response.json();

    // If it's a single file, decode content
    if (!Array.isArray(data) && data.type === 'file') {
      return Response.json({
        name: data.name,
        path: data.path,
        content: atob(data.content.replace(/\n/g, '')),
        encoding: data.encoding
      });
    }

    return Response.json({ files: Array.isArray(data) ? data.map(f => ({ name: f.name, path: f.path, type: f.type, size: f.size })) : data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});