// backend/tests/auth.test.js
// Plain Node test script (no extra libraries). Runs against the
// server at http://localhost:3000 — start it first (npm run dev).
// Uses unique emails (Date.now()) so it can be re-run safely.

const BASE = "http://localhost:3000";
const UNIQUE = Date.now();

const EMAIL_A = `test-a-${UNIQUE}@example.test`;
const EMAIL_B = `test-b-${UNIQUE}@example.test`;
const PASSWORD = "ValidPass123";

let passed = 0;
let failed = 0;

function check(name, condition, extra) {
  if (condition) {
    passed++;
    console.log(`PASS: ${name}`);
  } else {
    failed++;
    console.log(`FAIL: ${name}${extra ? " -> " + extra : ""}`);
  }
}

// Extract the "microbiz.sid=..." pair from Set-Cookie headers.
function extractSessionCookie(setCookieHeaders) {
  for (const header of setCookieHeaders) {
    const pair = header.split(";")[0].trim();
    if (pair.startsWith("microbiz.sid=")) return pair;
  }
  return null;
}

async function register(fullName, email, password) {
  return fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName, email, password }),
  });
}

async function login(email, password) {
  return fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

async function me(cookie) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  return fetch(`${BASE}/api/auth/me`, { headers });
}

async function main() {
  // a) Register user A -> 201, no password/hash in response
  const regA = await register("Test User A", EMAIL_A, PASSWORD);
  const regABody = await regA.json();
  check("a) register user A returns 201", regA.status === 201, `status ${regA.status}`);
  const regAString = JSON.stringify(regABody);
  check(
    "a) register response has no password or password_hash",
    !regAString.includes("password"),
    regAString
  );

  // b) Duplicate email -> 409
  const regDup = await register("Test User A", EMAIL_A, PASSWORD);
  check("b) duplicate email register returns 409", regDup.status === 409, `status ${regDup.status}`);

  // c) Weak password -> 400
  const regWeak = await register("Test Weak", `weak-${UNIQUE}@example.test`, "abc");
  check("c) weak password register returns 400", regWeak.status === 400, `status ${regWeak.status}`);

  // d) GET /me without login -> 401
  const meAnon = await me(null);
  check("d) GET /me without login returns 401", meAnon.status === 401, `status ${meAnon.status}`);

  // e) Wrong password -> 401 with the generic message
  const loginWrong = await login(EMAIL_A, "WrongPass999");
  const loginWrongBody = await loginWrong.json();
  check("e) wrong password returns 401", loginWrong.status === 401, `status ${loginWrong.status}`);
  check(
    "e) wrong password message is generic",
    loginWrongBody.message === "Invalid email or password",
    JSON.stringify(loginWrongBody)
  );

  // e) Correct password -> 200 + Set-Cookie with HttpOnly
  const loginA = await login(EMAIL_A, PASSWORD);
  const setCookiesA = loginA.headers.getSetCookie();
  check("e) correct password login returns 200", loginA.status === 200, `status ${loginA.status}`);
  const cookieA = extractSessionCookie(setCookiesA);
  check(
    "e) login sets a microbiz.sid cookie",
    cookieA !== null,
    JSON.stringify(setCookiesA)
  );
  check(
    "e) session cookie is HttpOnly",
    setCookiesA.some((h) => h.includes("HttpOnly")),
    JSON.stringify(setCookiesA)
  );

  // f) GET /me with A's cookie -> 200 and A's own email
  const meA = await me(cookieA);
  const meABody = await meA.json();
  check("f) GET /me with cookie returns 200", meA.status === 200, `status ${meA.status}`);
  check(
    "f) /me returns user A's own email",
    meABody.user && meABody.user.email === EMAIL_A,
    JSON.stringify(meABody)
  );

  // g) Register user B; /me with B's cookie returns B's data, never A's
  const regB = await register("Test User B", EMAIL_B, PASSWORD);
  check("g) register user B returns 201", regB.status === 201, `status ${regB.status}`);
  const loginB = await login(EMAIL_B, PASSWORD);
  const cookieB = extractSessionCookie(loginB.headers.getSetCookie());
  const meB = await me(cookieB);
  const meBBody = await meB.json();
  check("g) /me with B's cookie returns 200", meB.status === 200, `status ${meB.status}`);
  check(
    "g) /me returns B's own data (not A's)",
    meBBody.user &&
      meBBody.user.email === EMAIL_B &&
      meBBody.user.id !== meABody.user.id,
    JSON.stringify(meBBody)
  );

  // h) Logout -> 200; /me with the old cookie -> 401
  const logout = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: cookieA },
  });
  check("h) logout returns 200", logout.status === 200, `status ${logout.status}`);
  const meAfterLogout = await me(cookieA);
  check(
    "h) /me with the old cookie returns 401",
    meAfterLogout.status === 401,
    `status ${meAfterLogout.status}`
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test run failed:", err.message);
  process.exit(1);
});
