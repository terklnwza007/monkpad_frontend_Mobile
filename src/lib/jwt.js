let atobFn;
try {
  atobFn = global.atob ? global.atob.bind(global) : undefined;
} catch (_) {}

function base64urlToBase64(input) {
  return input.replace(/-/g, "+").replace(/_/g, "/")
              .padEnd(Math.ceil(input.length / 4) * 4, "=");
}
function simpleAtob(b64) {
  if (atobFn) return atobFn(b64);
  try {
    if (typeof Buffer !== "undefined")
      return Buffer.from(b64, "base64").toString("binary");
  } catch (_) {}
  throw new Error("No base64 decoder available. Install 'base-64'.");
}

export function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") throw new Error("Invalid token");
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Malformed JWT");
  const payloadB64 = base64urlToBase64(parts[1]);
  const json = simpleAtob(payloadB64);
  return JSON.parse(unescape(encodeURIComponent(json)));
}

export function getUidFromToken(token) {
  const payload = decodeJwtPayload(token);
  return payload.uid;
}
