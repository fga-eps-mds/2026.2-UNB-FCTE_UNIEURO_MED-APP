import { gcm } from '@noble/ciphers/aes';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';

import { PackageRefusedError } from '@/features/sincronizacao/sync-package';

/**
 * Cifra do pacote por arquivo (AES-GCM). A chave sai de um código de uso único
 * que não vai no arquivo: é mostrado num tablet e digitado no outro.
 *
 * Código: 12 caracteres de um alfabeto de 32 (60 bits), sem I e O, que se
 * confundem com 1 e 0.
 */

export type RandomBytes = (size: number) => Promise<Uint8Array>;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 12;
const CODE_GROUP = 4;

const ENVELOPE_FORMAT = 'med-sync-cifrado';
const ENVELOPE_VERSION = 1;
const KDF = 'pbkdf2-sha256';
const ITERATIONS = 100_000;
const MAX_ITERATIONS = 1_000_000;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const KEY_BYTES = 32;

type Envelope = {
  formato: typeof ENVELOPE_FORMAT;
  versao: typeof ENVELOPE_VERSION;
  kdf: typeof KDF;
  iteracoes: number;
  sal: string;
  nonce: string;
  dados: string;
};

/** Formato `ABCD-EFGH-JKLM`. */
export async function generateTransferCode(randomBytes: RandomBytes): Promise<string> {
  // 256 é múltiplo de 32: os 5 bits de baixo não favorecem nenhum caractere.
  const characters = Array.from(await randomBytes(CODE_LENGTH), (byte) => CODE_ALPHABET[byte & 31]);
  const groups = [];
  for (let start = 0; start < CODE_LENGTH; start += CODE_GROUP) {
    groups.push(characters.slice(start, start + CODE_GROUP).join(''));
  }
  return groups.join('-');
}

/** Aceita hífens, espaços e minúsculas. */
export function normalizeTransferCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((character) => CODE_ALPHABET.includes(character)) ? code : null;
}

function associatedData(iterations: number, saltHex: string) {
  return utf8ToBytes([ENVELOPE_FORMAT, ENVELOPE_VERSION, KDF, iterations, saltHex].join('|'));
}

function deriveKey(code: string, salt: Uint8Array, iterations: number) {
  return pbkdf2Async(sha256, code, salt, { c: iterations, dkLen: KEY_BYTES });
}

export async function sealPackage(
  plaintext: string,
  transferCode: string,
  randomBytes: RandomBytes,
): Promise<string> {
  const code = normalizeTransferCode(transferCode);
  if (!code) throw new Error('Código de transferência inválido.');

  const salt = await randomBytes(SALT_BYTES);
  const nonce = await randomBytes(NONCE_BYTES);
  const key = await deriveKey(code, salt, ITERATIONS);
  const saltHex = bytesToHex(salt);
  const sealed = gcm(key, nonce, associatedData(ITERATIONS, saltHex)).encrypt(
    utf8ToBytes(plaintext),
  );

  const envelope: Envelope = {
    formato: ENVELOPE_FORMAT,
    versao: ENVELOPE_VERSION,
    kdf: KDF,
    iteracoes: ITERATIONS,
    sal: saltHex,
    nonce: bytesToHex(nonce),
    dados: bytesToHex(sealed),
  };
  return JSON.stringify(envelope);
}

function readEnvelope(contents: string): Envelope {
  let value: Partial<Envelope>;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new PackageRefusedError('arquivo_invalido');
  }

  const isHex = (text: unknown, bytes?: number) =>
    typeof text === 'string' &&
    /^([0-9a-f]{2})+$/.test(text) &&
    (bytes === undefined || text.length === bytes * 2);

  const valid =
    value?.formato === ENVELOPE_FORMAT &&
    value.versao === ENVELOPE_VERSION &&
    value.kdf === KDF &&
    Number.isInteger(value.iteracoes) &&
    (value.iteracoes as number) >= ITERATIONS &&
    (value.iteracoes as number) <= MAX_ITERATIONS &&
    isHex(value.sal, SALT_BYTES) &&
    isHex(value.nonce, NONCE_BYTES) &&
    isHex(value.dados);

  if (!valid) throw new PackageRefusedError('arquivo_invalido');
  return value as Envelope;
}

/** Código errado e arquivo alterado dão o mesmo erro. */
export async function openPackage(contents: string, transferCode: string): Promise<string> {
  const envelope = readEnvelope(contents);
  const code = normalizeTransferCode(transferCode);
  if (!code) throw new PackageRefusedError('codigo_incorreto');

  const key = await deriveKey(code, hexToBytes(envelope.sal), envelope.iteracoes);
  try {
    const plaintext = gcm(
      key,
      hexToBytes(envelope.nonce),
      associatedData(envelope.iteracoes, envelope.sal),
    ).decrypt(hexToBytes(envelope.dados));
    return bytesToUtf8(plaintext);
  } catch {
    throw new PackageRefusedError('codigo_incorreto');
  }
}
