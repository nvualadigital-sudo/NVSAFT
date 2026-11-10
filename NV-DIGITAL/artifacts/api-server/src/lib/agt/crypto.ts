import {
  createPrivateKey,
  createPublicKey,
  createHash,
  sign,
  verify,
  constants,
} from "node:crypto";

export function canonical(value: any): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  throw new Error("O conteúdo da assinatura contém valores inválidos.");
}
export const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export function publicPem(privatePem: string) {
  return createPublicKey(privatePem)
    .export({ format: "pem", type: "spki" })
    .toString();
}
export function fingerprint(pem: string) {
  return sha256(createPublicKey(pem).export({ type: "spki", format: "der" }));
}
export function rsaPrivate(pem: string, bits = 2048) {
  const key = createPrivateKey(pem);
  if (
    key.asymmetricKeyType !== "rsa" ||
    (key.asymmetricKeyDetails?.modulusLength || 0) < bits
  )
    throw new Error(
      "A facturação electrónica exige uma chave RSA de pelo menos 2048 bits.",
    );
  return key;
}
export function jws(payload: any, pem: string) {
  const header = Buffer.from(canonical({ alg: "RS256", typ: "JOSE" })).toString(
    "base64url",
  );
  const data =
    header + "." + Buffer.from(canonical(payload)).toString("base64url");
  return (
    data +
    "." +
    sign("RSA-SHA256", Buffer.from(data), {
      key: rsaPrivate(pem),
      padding: constants.RSA_PKCS1_PADDING,
    }).toString("base64url")
  );
}
export function verifyJws(token: string, expected: any, pem: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p)))
      return false;
    if (
      Buffer.from(parts[0], "base64url").toString() !==
        canonical({ alg: "RS256", typ: "JOSE" }) ||
      Buffer.from(parts[1], "base64url").toString() !== canonical(expected)
    )
      return false;
    const key = createPublicKey(pem);
    return (
      key.asymmetricKeyType === "rsa" &&
      (key.asymmetricKeyDetails?.modulusLength || 0) >= 2048 &&
      verify(
        "RSA-SHA256",
        Buffer.from(parts[0] + "." + parts[1]),
        { key, padding: constants.RSA_PKCS1_PADDING },
        Buffer.from(parts[2], "base64url"),
      )
    );
  } catch {
    return false;
  }
}
export function legacySignature(
  data: {
    date: string;
    entryDate: string;
    number: string;
    gross: number;
    previous: string;
  },
  pem: string,
) {
  const key = createPrivateKey(pem);
  if (
    key.asymmetricKeyType !== "rsa" ||
    key.asymmetricKeyDetails?.modulusLength !== 1024
  )
    throw new Error(
      "A assinatura SAF-T 1.01_01 usa a chave própria de 1024 bits, distinta da chave FE.",
    );
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(data.entryDate) ||
    /[;\r\n]/.test(data.number) ||
    !Number.isFinite(data.gross)
  )
    throw new Error("Dados inválidos para assinatura SAF-T.");
  const input = [
    data.date,
    data.entryDate,
    data.number,
    Math.abs(data.gross).toFixed(2),
    data.previous,
  ].join(";");
  return {
    hash: sign("RSA-SHA1", Buffer.from(input, "utf8"), {
      key,
      padding: constants.RSA_PKCS1_PADDING,
    }).toString("base64"),
    input,
  };
}
