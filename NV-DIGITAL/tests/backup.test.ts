import test from "node:test";
import assert from "node:assert/strict";
import {
  encryptBackup,
  decryptBackup,
} from "../scripts/operations/backup-crypto.mjs";
test("encrypted backup round trip rejects wrong keys and tampered archives", () => {
  const raw = Buffer.from(
      "Ficheiro fictício para teste de cifragem, sem dados clínicos.",
    ),
    pass = "test-only-backup-passphrase-at-least-32";
  const encrypted = encryptBackup(raw, pass);
  assert.ok(!encrypted.includes(raw));
  assert.deepEqual(decryptBackup(encrypted, pass), raw);
  assert.throws(() =>
    decryptBackup(encrypted, "a-different-test-passphrase-at-least-32"),
  );
  const altered = Buffer.from(encrypted);
  altered[altered.length - 1] ^= 1;
  assert.throws(() => decryptBackup(altered, pass));
  assert.throws(() => encryptBackup(raw, "short"));
});
