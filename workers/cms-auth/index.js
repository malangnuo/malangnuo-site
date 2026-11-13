const COOKIE = '__Host-cms-state';
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
function response(text, status = 400, extra = {}) { return new Response(text, { status, headers: { ...headers, ...extra } }); }
function cookie(value, age) { return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`; }
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return response('Method not allowed', 405);
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.CMS_ORIGIN || !env.GITHUB_REPO) return response('관리자 로그인 설정이 필요합니다. CMS 설정 문서를 확인해주세요.', 503);
    const origin = new URL(env.CMS_ORIGIN).origin;
    const callback = `${origin}/cms-auth/callback`;
    if (url.origin !== origin) return response('Invalid origin', 403);
    if (url.pathname === '/cms-auth/auth') {
      const state = crypto.randomUUID();
      const target = new URL('https://github.com/login/oauth/authorize');
      target.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: callback, scope: 'public_repo', state }).toString();
      return response('', 302, { Location: target.href, 'Set-Cookie': cookie(state, 600) });
    }
    if (url.pathname !== '/cms-auth/callback') return response('Not found', 404);
    const state = url.searchParams.get('state');
    const saved = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    const clear = { 'Set-Cookie': cookie('', 0) };
    if (!state || !saved || state !== saved) return response('로그인 요청이 만료되었습니다. 관리자 화면에서 다시 시도해주세요.', 403, clear);
    const code = url.searchParams.get('code');
    if (!code || url.searchParams.has('error')) return response('GitHub 로그인이 취소되었습니다.', 400, clear);
    try {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: callback }) });
      const data = await tokenResponse.json();
      if (!tokenResponse.ok || !data.access_token) return response('GitHub 인증에 실패했습니다. 다시 로그인해주세요.', 401, clear);
      const repoResponse = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}`, { headers: { Authorization: `Bearer ${data.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'malangnuo-cms' } });
      const repo = await repoResponse.json();
      if (!repoResponse.ok || !repo.permissions?.push) return response('이 저장소에 글을 쓸 권한이 없습니다.', 403, clear);
      const nonce = crypto.randomUUID();
      const payload = JSON.stringify(`authorization:github:success:${JSON.stringify({ token: data.access_token, provider: 'github' })}`).replaceAll('<', '\\u003c');
      const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>로그인 완료</title><p>로그인이 완료되었습니다. 관리자 화면으로 돌아가주세요.</p><script nonce="${nonce}">const origin=${JSON.stringify(origin)};const handler=e=>{if(e.origin!==origin||e.source!==window.opener)return;window.removeEventListener('message',handler);window.opener.postMessage(${payload},origin);window.close();};window.addEventListener('message',handler);if(window.opener)window.opener.postMessage('authorizing:github',origin);</script></html>`;
      return response(html, 200, { ...clear, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'` });
    } catch { return response('로그인 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.', 502, clear); }
  }
};
