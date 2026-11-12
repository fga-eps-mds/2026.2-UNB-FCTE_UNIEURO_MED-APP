import type { VersionVector } from '@/db/sync-repository';
import { isUuid, isVector } from '@/features/sincronizacao/sync-package';

/**
 * Protocolo da troca pelo Nearby (a conexão já é cifrada):
 * 1. cada lado manda `ola` com o seu vetor;
 * 2. responde com `pacote`, só com o que falta ao outro;
 * 3. depois de aplicar, manda `concluido`.
 */
export const PROTOCOL_FORMAT = 'med-sync-p2p';
export const PROTOCOL_VERSION = 1;

export type HelloMessage = {
  tipo: 'ola';
  formato: typeof PROTOCOL_FORMAT;
  versao: typeof PROTOCOL_VERSION;
  dispositivo: string;
  versao_esquema: number;
  vetor: VersionVector;
};

export type ProtocolMessage =
  | HelloMessage
  | { tipo: 'pacote'; pacote: string }
  | { tipo: 'concluido' }
  | { tipo: 'erro'; motivo: string };

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

// Limite do Nearby: 32 KB. 8000 caracteres de até 3 bytes cabem.
export const CHUNK_SIZE = 8000;

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;

/** Partes `id|índice|total|texto`, sem cortar um par UTF-16 ao meio. */
export function frameMessage(
  message: ProtocolMessage,
  id: string,
  chunkSize = CHUNK_SIZE,
): string[] {
  const text = JSON.stringify(message);
  const pieces: string[] = [];
  let start = 0;
  do {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length && isHighSurrogate(text.charCodeAt(end - 1))) {
      // Recua um; se a parte ficaria vazia, leva o par inteiro.
      end = end - 1 > start ? end - 1 : end + 1;
    }
    pieces.push(text.slice(start, end));
    start = end;
  } while (start < text.length);

  return pieces.map((piece, index) => `${id}|${index}|${pieces.length}|${piece}`);
}

const FRAME_PATTERN = /^([^|]+)\|(\d+)\|(\d+)\|/;

/** Devolve a mensagem quando todas as partes chegam. */
export function createAssembler() {
  const pending = new Map<string, string[]>();

  return {
    push(frame: string): ProtocolMessage | null {
      const header = FRAME_PATTERN.exec(frame);
      if (!header) throw new ProtocolError('Parte de mensagem sem cabeçalho.');

      const [prefix, id, indexText, totalText] = header;
      const index = Number(indexText);
      const total = Number(totalText);
      if (total < 1 || index >= total) throw new ProtocolError('Parte de mensagem fora de ordem.');

      const parts = pending.get(id) ?? new Array<string>(total);
      parts[index] = frame.slice(prefix.length);
      pending.set(id, parts);

      for (let i = 0; i < total; i += 1) if (parts[i] === undefined) return null;
      pending.delete(id);
      return parseMessage(parts.join(''));
    },
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseMessage(text: string): ProtocolMessage {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ProtocolError('Mensagem que não é JSON.');
  }
  if (!isObject(value)) throw new ProtocolError('Mensagem sem tipo.');

  switch (value.tipo) {
    case 'ola':
      if (
        value.formato === PROTOCOL_FORMAT &&
        value.versao === PROTOCOL_VERSION &&
        isUuid(value.dispositivo) &&
        Number.isInteger(value.versao_esquema) &&
        isVector(value.vetor)
      ) {
        return value as HelloMessage;
      }
      throw new ProtocolError('Apresentação inválida.');
    case 'pacote':
      if (typeof value.pacote === 'string') return { tipo: 'pacote', pacote: value.pacote };
      throw new ProtocolError('Pacote inválido.');
    case 'concluido':
      return { tipo: 'concluido' };
    case 'erro':
      return { tipo: 'erro', motivo: typeof value.motivo === 'string' ? value.motivo : 'erro' };
    default:
      throw new ProtocolError('Tipo de mensagem desconhecido.');
  }
}
