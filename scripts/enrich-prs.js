const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const appId = process.env.GITHUB_APP_ID;
const privateKeyBase64 = process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');

function generateJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: now - 60, exp: now + 500, iss: appId };
  const msg =
    Buffer.from(JSON.stringify(header)).toString('base64url') +
    '.' +
    Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(msg);
  return msg + '.' + signer.sign(privateKey, 'base64url');
}

async function getInstallationToken() {
  const jwt = generateJwt();
  const iRes = await fetch('https://api.github.com/app/installations', {
    headers: { Authorization: 'Bearer ' + jwt, 'User-Agent': 'PRAXD' },
  });
  const installs = await iRes.json();
  const installId = installs[0].id;

  const tRes = await fetch(
    `https://api.github.com/app/installations/${installId}/access_tokens`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + jwt, 'User-Agent': 'PRAXD' },
    }
  );
  const tJson = await tRes.json();
  return { token: tJson.token, login: installs[0].account?.login || 'abushaidislam' };
}

async function run() {
  console.log('Starting full PR enrichment via GitHub GraphQL...');
  const { token, login } = await getInstallationToken();

  // Load repositories from DB map
  const { data: dbRepos } = await supabase.from('repositories').select('id, full_name, owner_login, name');
  const repoMap = new Map();
  dbRepos.forEach((r) => {
    repoMap.set(r.full_name.toLowerCase(), r.id);
  });

  let cursor = null;
  let totalProcessed = 0;
  let hasNext = true;

  // Fetch up to 300 PRs (3 pages of 100)
  for (let page = 0; page < 3 && hasNext; page++) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const query = `query {
      search(query: "is:pr user:${login} sort:updated-desc", type: ISSUE, first: 100${afterClause}) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ... on PullRequest {
            number
            title
            body
            state
            isDraft
            createdAt
            updatedAt
            headRefName
            baseRefName
            additions
            deletions
            changedFiles
            repository {
              name
              nameWithOwner
            }
            author {
              login
              avatarUrl
            }
          }
        }
      }
    }`;

    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'User-Agent': 'PRAXD',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const json = await res.json();
    const searchData = json.data?.search;
    if (!searchData || !searchData.nodes) {
      console.error('GraphQL error or empty:', json);
      break;
    }

    const prNodes = searchData.nodes.filter(Boolean);
    console.log(`Page ${page + 1}: fetched ${prNodes.length} pull requests.`);

    for (const pr of prNodes) {
      if (!pr || !pr.number) {
        continue;
      }
      const repoFullName = pr.repository?.nameWithOwner?.toLowerCase();
      const repoId = repoMap.get(repoFullName);
      if (!repoId) {
        console.log('No repoId for repoFullName:', repoFullName);
        continue;
      }

      const state = pr.state === 'OPEN' ? 'open' : pr.state === 'MERGED' ? 'merged' : 'closed';
      const authorLogin = pr.author?.login || 'unknown';
      const authorAvatar = pr.author?.avatarUrl || `https://github.com/${authorLogin}.png`;

      // Update Supabase pull_requests table
      const { data, error } = await supabase
        .from('pull_requests')
        .update({
          head_ref: pr.headRefName || 'head',
          base_ref: pr.baseRefName || 'main',
          additions: pr.additions || 0,
          deletions: pr.deletions || 0,
          changed_files_count: pr.changedFiles || 1,
          author_login: authorLogin,
          author_avatar_url: authorAvatar,
          state: state,
          draft: Boolean(pr.isDraft),
          github_updated_at: pr.updatedAt,
        })
        .eq('repository_id', repoId)
        .eq('number', pr.number)
        .select('id');

      if (error) {
        console.error('Update error for PR #' + pr.number, error);
      } else if (data && data.length > 0) {
        totalProcessed++;
      } else {
        // Missing from DB: insert it!
        const { error: insErr } = await supabase.from('pull_requests').insert({
          workspace_id: 'a0000000-0000-0000-0000-000000000001',
          repository_id: repoId,
          github_pr_id: pr.number,
          number: pr.number,
          title: pr.title || `PR #${pr.number}`,
          body: pr.body || '',
          state: state,
          draft: Boolean(pr.isDraft),
          author_login: authorLogin,
          author_avatar_url: authorAvatar,
          head_ref: pr.headRefName || 'head',
          base_ref: pr.baseRefName || 'main',
          additions: pr.additions || 0,
          deletions: pr.deletions || 0,
          changed_files_count: pr.changedFiles || 1,
          html_url: `https://github.com/${repoFullName}/pull/${pr.number}`,
          github_created_at: pr.createdAt,
          github_updated_at: pr.updatedAt,
          synced_at: new Date().toISOString(),
        });
        if (!insErr) {
          console.log(`Inserted missing PR #${pr.number} in ${repoFullName}`);
          totalProcessed++;
        }
      }
    }

    hasNext = searchData.pageInfo?.hasNextPage;
    cursor = searchData.pageInfo?.endCursor;
  }

  console.log(`Successfully enriched ${totalProcessed} pull requests in Supabase!`);
}

run().catch(console.error);
