// scripts/testApiSimple.js
require("dotenv").config();

const API_BASE = process.env.API_BASE || "http://localhost:3000";
const SCHOOL_EMAIL =
  process.env.SCHOOL_EMAIL || "escuela1@inventacore.cl";
const SCHOOL_PASSWORD = process.env.SCHOOL_PASSWORD || "escuela123";

async function http(method, path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error || text || `HTTP ${res.status}`;
    throw new Error(`${method} ${path} -> ${msg}`);
  }

  return json;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("Running simple API test:", API_BASE);

  const health = await http("GET", "/health");
  assert(health?.ok === true, "Health check failed");

  const login = await http("POST", "/auth/login", {
    email: SCHOOL_EMAIL,
    password: SCHOOL_PASSWORD,
  });
  assert(login?.token, "Login failed: token missing");

  const assets = await http(
    "GET",
    "/assets?take=1&skip=0&withCount=false",
    null,
    login.token
  );
  assert(Array.isArray(assets.items), "Assets list missing items");

  console.log("Simple API test passed");
}

main().catch((e) => {
  console.error("Simple API test failed:", e.message);
  process.exit(1);
});
