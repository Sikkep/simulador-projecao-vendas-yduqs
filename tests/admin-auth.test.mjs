import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import handler, { __test } from "../api/admin-auth.js";

function responseMock() {
  return {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.payload = JSON.parse(value); },
  };
}

async function invoke({ method = "POST", body = {}, address = "test" } = {}) {
  const response = responseMock();
  await handler({ method, body, headers: {}, socket: { remoteAddress: address } }, response);
  return response;
}

test("senha é transformada e comparada somente no servidor", () => {
  const hash = createHash("sha256").update("segredo-de-teste").digest("hex");
  assert.equal(__test.passwordDigest("segredo-de-teste"), hash);
  assert.equal(__test.secureEqual(hash, hash), true);
  assert.equal(__test.secureEqual("invalido", hash), false);
});

test("endpoint falha fechado quando variável de ambiente não existe", async () => {
  const previous = process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_PASSWORD_HASH;
  const response = await invoke({ address: "missing-env" });
  assert.equal(response.statusCode, 503);
  if (previous) process.env.ADMIN_PASSWORD_HASH = previous;
});

test("endpoint autentica a senha contra o hash armazenado apenas no ambiente", async () => {
  const expected = createHash("sha256").update("segredo-de-teste").digest("hex");
  process.env.ADMIN_PASSWORD_HASH = expected;
  const denied = await invoke({ body: { password: "incorreta" }, address: "denied" });
  const replayDenied = await invoke({ body: { password: expected }, address: "replay-denied" });
  const allowed = await invoke({ body: { password: "segredo-de-teste" }, address: "allowed" });
  assert.equal(denied.statusCode, 401);
  assert.equal(replayDenied.statusCode, 401);
  assert.equal(allowed.statusCode, 200);
  assert.deepEqual(allowed.payload, { authenticated: true });
  delete process.env.ADMIN_PASSWORD_HASH;
});
