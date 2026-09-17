import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type EncryptedEnvelope = {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
};

function getKey(): Buffer {
  const raw = process.env["INTEGRATION_CREDENTIALS_KEY"];
  if (!raw) throw new Error("Cofre de integrações não configurado");
  return Buffer.from(raw.padEnd(32, "0").slice(0, 32), "utf8");
}

export function encryptCredentials(value: Record<string, unknown>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const envelope: EncryptedEnvelope = {
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  return JSON.stringify(envelope);
}

export function decryptCredentials(payload: string): Record<string, unknown> {
  const envelope = JSON.parse(payload) as EncryptedEnvelope;
  if (envelope.version !== 1) throw new Error("Versão de credencial não suportada");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const clear = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(clear) as Record<string, unknown>;
}