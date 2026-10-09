import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

/**
 * Cifra autenticada AES-GCM. A chave tem 32 bytes e o resultado de `seal` traz
 * nonce, texto cifrado e etiqueta de autenticação juntos.
 */
export type AesGcm = {
  seal(key: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array>;
  open(key: Uint8Array, sealed: Uint8Array): Promise<Uint8Array>;
};

export type CpfProtector = {
  /** Identificador fixo do CPF neste tablet, para buscar e impedir duplicidade. */
  blindIndex(cpf: string): Promise<string>;
  /** Cifra o CPF para gravá-lo no banco. A mesma entrada gera saídas diferentes. */
  encrypt(cpf: string): Promise<string>;
  /** Recupera o CPF a partir do que `encrypt` devolveu. */
  decrypt(stored: string): Promise<string>;
};

const FORMAT = 'aes-gcm';
const VERSION = '1';

// Duas chaves independentes saem da chave-mestra do tablet. Assim, conhecer o
// índice de busca não ajuda a abrir a cifra, e vice-versa.
const ENCRYPTION_KEY_LABEL = utf8ToBytes('med/cpf/cifra/v1');
const INDEX_KEY_LABEL = utf8ToBytes('med/cpf/indice/v1');

/**
 * Protege o CPF do profissional no banco do tablet.
 *
 * O CPF precisa continuar recuperável, porque a sincronização entre tablets o
 * envia e o usa para reconhecer o mesmo profissional, e também consultável, para
 * recusar cadastro repetido. Por isso ele é guardado de duas formas: cifrado
 * (AES-GCM) e como índice cego (HMAC-SHA256 com chave própria). Um hash comum não
 * serviria: um CPF tem cerca de 10^9 combinações e seria descoberto em minutos.
 *
 * As chaves são do tablet. O índice e a cifra de um tablet não valem em outro,
 * então na sincronização só o CPF em si deve viajar, nunca o que está no banco.
 */
export function createCpfProtector(
  loadMasterKey: () => Promise<Uint8Array>,
  cipher: AesGcm,
): CpfProtector {
  let keys: Promise<{ encryption: Uint8Array; index: Uint8Array }> | null = null;

  const getKeys = () => {
    keys ??= loadMasterKey()
      .then((master) => ({
        encryption: hmac(sha256, master, ENCRYPTION_KEY_LABEL),
        index: hmac(sha256, master, INDEX_KEY_LABEL),
      }))
      .catch((error: unknown) => {
        keys = null;
        throw error;
      });
    return keys;
  };

  return {
    async blindIndex(cpf) {
      const { index } = await getKeys();
      return bytesToHex(hmac(sha256, index, utf8ToBytes(cpf)));
    },

    async encrypt(cpf) {
      const { encryption } = await getKeys();
      const sealed = await cipher.seal(encryption, utf8ToBytes(cpf));
      return [FORMAT, VERSION, bytesToHex(sealed)].join('$');
    },

    async decrypt(stored) {
      const [format, version, sealedHex] = stored.split('$');
      if (format !== FORMAT || version !== VERSION || !sealedHex) {
        throw new Error('CPF gravado em formato desconhecido.');
      }

      const { encryption } = await getKeys();
      const plaintext = await cipher.open(encryption, hexToBytes(sealedHex));
      // O CPF tem só dígitos (ASCII), então cada byte é um caractere.
      return Array.from(plaintext, (byte) => String.fromCharCode(byte)).join('');
    },
  };
}
