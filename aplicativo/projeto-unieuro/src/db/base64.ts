/**
 * BLOB do banco (desenho, assinatura) em texto, para viajar no pacote JSON da
 * sincronização. Usa o `btoa` e o `atob` do Hermes e do Node.
 */

// Blocos menores que o limite de argumentos do `String.fromCharCode`.
const CHUNK = 0x8000;

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Base64 válido e não vazio. */
export const isBase64 = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && BASE64_PATTERN.test(value);
