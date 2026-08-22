import { createHash, timingSafeEqual } from "node:crypto";

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function json(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}

function clientKey(request) {
  const forwarded = request.headers?.["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || request.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

function rateLimited(key, now = Date.now()) {
  const recent = (attempts.get(key) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  attempts.set(key, recent);
  return recent.length >= MAX_ATTEMPTS;
}

function recordFailure(key, now = Date.now()) {
  attempts.set(key, [...(attempts.get(key) || []), now]);
}

async function readBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body);
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1024) throw new Error("payload_too_large");
  }
  return raw ? JSON.parse(raw) : {};
}

function secureEqual(candidate, expected) {
  if (!/^[a-f\d]{64}$/i.test(candidate || "") || !/^[a-f\d]{64}$/i.test(expected || "")) return false;
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(expected, "hex"));
}

function passwordDigest(password) {
  return createHash("sha256").update(String(password), "utf8").digest("hex");
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Método não permitido" });
  }

  const expectedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedHash) return json(response, 503, { error: "Autenticação administrativa não configurada" });

  const key = clientKey(request);
  if (rateLimited(key)) {
    response.setHeader("Retry-After", String(WINDOW_MS / 1000));
    return json(response, 429, { error: "Muitas tentativas. Aguarde alguns minutos." });
  }

  try {
    const { password } = await readBody(request);
    if (typeof password !== "string" || password.length < 1 || password.length > 256 || !secureEqual(passwordDigest(password), expectedHash)) {
      recordFailure(key);
      return json(response, 401, { error: "Senha incorreta" });
    }
    attempts.delete(key);
    return json(response, 200, { authenticated: true });
  } catch {
    recordFailure(key);
    return json(response, 400, { error: "Requisição inválida" });
  }
}

export const __test = { passwordDigest, secureEqual };
