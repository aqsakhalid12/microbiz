// frontend/js/api/client.js
// Thin wrapper around fetch for API calls.
// - Same-origin requests with credentials (to send/receive session cookie)
// - JSON request/response bodies
// - Throws an error object on non-2xx responses (with status, message, details)
// - If a non-auth endpoint returns 401, redirect to /login (session expired)
//
// Usage:
//   import { api } from "/js/api/client.js";
//   const data = await api.get("/api/auth/me");
//   await api.post("/api/auth/login", {email, password});

async function request(method, url, body) {
  const options = {
    method,
    credentials: "same-origin", // send cookies with request
    headers: {},
  };

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    // Network error (DNS, offline, etc.)
    throw new Error("Network error. Please check your connection.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Response had no JSON body (e.g., 204 No Content)
    data = null;
  }

  if (!response.ok) {
    // Build error object from response
    const message = (data && data.message) || `Request failed (HTTP ${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data && data.details;

    // Special handling: if this is a non-auth endpoint and we got 401,
    // the session likely expired or is invalid -> redirect to login.
    const isAuthEndpoint =
      url.startsWith("/api/auth/login") ||
      url.startsWith("/api/auth/register");
    if (response.status === 401 && !isAuthEndpoint) {
      window.location.href = "/login";
    }

    throw error;
  }

  return data;
}

export const api = {
  get: (url) => request("GET", url),
  post: (url, body) => request("POST", url, body),
  put: (url, body) => request("PUT", url, body),
  patch: (url, body) => request("PATCH", url, body),
  delete: (url) => request("DELETE", url),
};