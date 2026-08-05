const { PrismaClient } = require('@prisma/client');

const API = process.env.API_URL || 'http://localhost:3003';
const EMAIL = process.env.H3_EMAIL || 'sofia.client@easement.local';
const PASSWORD = process.env.H3_PASSWORD || 'DemoSalon123!';
const NEW_PASSWORD = process.env.H3_NEW_PASSWORD || 'DemoSalon123!';

function getSetCookies(res) {
  // Node fetch / undici
  if (typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie();
  }
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function cookieHeader(cookies) {
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  const cookies = getSetCookies(res);
  return { ok: res.ok, status: res.status, body, cookies };
}

async function me(cookies) {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Cookie: cookieHeader(cookies) },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function changePassword(cookies, currentPassword, newPassword) {
  const res = await fetch(`${API}/auth/password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const body = await res.json().catch(() => ({}));
  const newCookies = getSetCookies(res);
  return {
    ok: res.ok,
    status: res.status,
    body,
    cookies: newCookies.length ? newCookies : cookies,
  };
}

async function main() {
  const prisma = new PrismaClient();
  const before = await prisma.$queryRaw`
    SELECT email, "sessionVersion" FROM "User" WHERE email = ${EMAIL}
  `;

  const sessionA = await login(EMAIL, PASSWORD);
  const sessionB = await login(EMAIL, PASSWORD);

  if (!sessionA.ok || !sessionB.ok) {
    console.log(
      JSON.stringify({
        error: 'login_failed',
        sessionA,
        sessionB,
        before,
      }),
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const meA1 = await me(sessionA.cookies);
  const meB1 = await me(sessionB.cookies);

  // Same password allowed only if different — use temp then revert
  const tempPass = `TempH3_${Date.now()}!`;
  const changed = await changePassword(sessionA.cookies, PASSWORD, tempPass);
  const meA2 = await me(changed.cookies);
  const meB2 = await me(sessionB.cookies);

  const mid = await prisma.$queryRaw`
    SELECT email, "sessionVersion" FROM "User" WHERE email = ${EMAIL}
  `;

  // Restore original password using session A (still valid)
  const restored = await changePassword(changed.cookies, tempPass, PASSWORD);
  const after = await prisma.$queryRaw`
    SELECT email, "sessionVersion" FROM "User" WHERE email = ${EMAIL}
  `;

  const result = {
    before,
    mid,
    after,
    meA1: meA1.status,
    meB1: meB1.status,
    changePassword: { ok: changed.ok, status: changed.status, body: changed.body },
    meA2_afterChange: meA2.status,
    meB2_staleSession: meB2.status,
    meB2_body: meB2.body,
    restored: { ok: restored.ok, status: restored.status },
    h3Pass:
      changed.ok &&
      meA2.status === 200 &&
      meB2.status === 401 &&
      Number(mid[0]?.sessionVersion) > Number(before[0]?.sessionVersion),
  };

  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  process.exit(result.h3Pass ? 0 : 2);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
