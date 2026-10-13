import type { AesGcm } from '@/db/cpf-protection';

const IV_BYTES = 12;

const subtle = globalThis.crypto.subtle;

const importKey = (key: Uint8Array) =>
  subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);

/**
 * AES-256-GCM de verdade, feito com o Web Crypto que já vem no ambiente de testes.
 * É usado no lugar da cifra nativa do `expo-crypto`, que só existe dentro do
 * aplicativo. O resultado segue o mesmo formato: nonce seguido do texto cifrado
 * com a etiqueta de autenticação.
 */
export const webCryptoAesGcm: AesGcm = {
  async seal(key, plaintext) {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const body = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      await importKey(key),
      plaintext as BufferSource,
    );
    const sealed = new Uint8Array(IV_BYTES + body.byteLength);
    sealed.set(iv);
    sealed.set(new Uint8Array(body), IV_BYTES);
    return sealed;
  },

  async open(key, sealed) {
    const body = await subtle.decrypt(
      { name: 'AES-GCM', iv: sealed.slice(0, IV_BYTES) },
      await importKey(key),
      sealed.slice(IV_BYTES) as BufferSource,
    );
    return new Uint8Array(body);
  },
};
