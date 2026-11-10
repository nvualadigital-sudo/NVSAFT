import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
const magic = Buffer.from("NVBK1");
function passphrase(s) {
  if (typeof s !== "string" || s.length < 32)
    throw new Error("BACKUP_PASSPHRASE deve ter pelo menos 32 caracteres.");
  return s;
}
export function encryptBackup(bytes, secret) {
  const salt = randomBytes(32),
    iv = randomBytes(12),
    key = scryptSync(passphrase(secret), salt, 32),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([magic, salt, iv, cipher.getAuthTag(), encrypted]);
}
export function decryptBackup(bytes, secret) {
  if (bytes.length < 65 || !bytes.subarray(0, 5).equals(magic))
    throw new Error("Formato de cópia inválido.");
  const key = scryptSync(passphrase(secret), bytes.subarray(5, 37), 32),
    decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(37, 49));
  decipher.setAAD(magic);
  decipher.setAuthTag(bytes.subarray(49, 65));
  return Buffer.concat([decipher.update(bytes.subarray(65)), decipher.final()]);
}
