// src/api.js — Thin fetch wrapper that auto-attaches the JWT Authorization
// header and handles 401 → redirect to login.

export function getApiBaseUrl() {
  let url = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").trim();
  url = url.replace(/\/+$/, "");
  if (!url.endsWith("/api")) {
    url += "/api";
  }
  return url;
}

/**
 * Make an API request. Automatically attaches the stored JWT.
 * On 401, clears the token and reloads (forces login screen).
 */
export async function api(path, options = {}) {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${getApiBaseUrl()}${cleanPath}`, {
    ...options,
    headers,
  });

  // On 401, clear tokens and force re-login.
  if (res.status === 401 && token) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.reload();
    throw new Error("Session expired");
  }

  return res;
}

/**
 * Convenience: POST JSON.
 */
export function postApi(path, body) {
  return api(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Convenience: PATCH JSON.
 */
export function patchApi(path, body) {
  return api(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * Convenience: PUT JSON.
 */
export function putApi(path, body) {
  return api(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * Convenience: DELETE.
 */
export function deleteApi(path) {
  return api(path, {
    method: "DELETE",
  });
}
