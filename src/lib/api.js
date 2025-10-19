// src/lib/api.js

// ✅ อ่านจาก env ก่อน (Expo) แล้ว fallback
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "https://monkpad-backend.onrender.com";

// ---------- utils ----------
const buildQuery = (params) => {
  if (!params) return "";
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

// timeout ด้วย AbortController
async function withTimeout(promise, ms, controller) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      controller.abort();
      reject(new Error("Network timeout"));
    }, ms);
    promise.then((v) => { clearTimeout(t); resolve(v); })
           .catch((e) => { clearTimeout(t); reject(e); });
  });
}

// ---------- core request ----------
async function req(path, { method = "GET", token, body, query, timeout = 15000 } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${BASE_URL}${path}${buildQuery(query)}`;
  const controller = new AbortController();

  let res;
  try {
    res = await withTimeout(
      fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      }),
      timeout,
      controller
    );
  } catch (err) {
    throw new Error(err?.message || "Network error");
  }

  // parse JSON ถ้าไม่มี body ให้เป็น {}
  let data = {};
  const text = await res.text().catch(() => "");
  if (text) {
    try { data = JSON.parse(text); } catch { /* keep {} */ }
  }

  if (!res.ok) {
    const detail = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return data;
}

// ---------- short-hands ----------
export const authedGet   = (path, token, query) => req(path, { token, query });
export const authedPost  = (path, token, body)  => req(path, { method: "POST",   token, body });
export const authedPut   = (path, token, body)  => req(path, { method: "PUT",    token, body });
export const authedPatch = (path, token, body)  => req(path, { method: "PATCH",  token, body });
export const authedDel   = (path, token)        => req(path, { method: "DELETE", token });

/* --------------- Auth --------------- */
export const loginRequest = (username, password) =>
  req("/auth/login", { method: "POST", body: { username, password } });

/* --------------- Users --------------- */
// โปรไฟล์ของ user ตาม id (ต้องส่ง token)
export const getUserById = (token, userId) =>
  authedGet(`/users/${userId}`, token);

// เปลี่ยนรหัสผ่านของตัวเอง
// Body: { old_password, new_password }
export const changeMyPassword = (token, { old_password, new_password }) =>
  authedPatch("/users/me/password", token, { old_password, new_password });

// เปลี่ยน username ของตัวเอง
// Body: { new_username, password }
export const changeMyUsername = (token, { new_username, password }) =>
  authedPatch("/users/me/username", token, { new_username, password });

// เปลี่ยน email ของตัวเอง
// Body: { new_email, password }
export const changeMyEmail = (token, { new_email, password }) =>
  authedPatch("/users/me/email", token, { new_email, password });

// สมัครสมาชิก
export const registerUser = ({ username, email, password }) =>
  req("/users/add/", { method: "POST", body: { username, email, password } });

/* --------------- Transactions --------------- */
export const addTransaction = (token, payload) =>
  authedPost("/transactions/add/", token, payload);

export const updateTransaction = (token, id, partial) => {
  if (!id) throw new Error("Missing transaction id");
  return authedPut(`/transactions/update/${id}`, token, partial);
};

export const deleteTransaction = (token, id) => {
  if (!id) throw new Error("Missing transaction id");
  return authedDel(`/transactions/delete/${id}`, token);
};

export const getTransactions = (token, uid, { q, type, from, to } = {}) => {
  if (!uid) throw new Error("Missing uid");
  return authedGet(`/transactions/${uid}`, token, { q, type, from, to });
};

/* ------------------ Tags -------------------- */
export const addTag = (token, payload) =>
  authedPost("/tags/add/", token, payload);

export const deleteTag = (token, id) => {
  if (!id) throw new Error("Missing tag id");
  return authedDel(`/tags/delete/${id}`, token);
};

export const getTags = (token, uid, { q } = {}) => {
  if (!uid) throw new Error("Missing uid");
  return authedGet(`/tags/${uid}`, token, { q });
};

// ดึง month_results ของทั้งปี
export const getMonthResultsByYear = (token, uid, year) =>
  authedGet(`/month_results/${uid}/${year}`, token);

// -------- generic exports --------
export { req };
