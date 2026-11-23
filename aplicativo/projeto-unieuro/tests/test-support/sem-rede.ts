/**
 * Guarda de rede dos testes (#16): nenhum dado sai do tablet.
 *
 * Instalado em `jest.setup.ts`, vale para todos os testes. Os três caminhos de
 * saída que o aplicativo teria em JavaScript (`fetch`, `XMLHttpRequest` e
 * `WebSocket`) passam a registrar a chamada e recusá-la. Ao fim de cada teste,
 * `exigirSemChamadasDeRede` reprova se houve alguma, mesmo que o código do
 * aplicativo tenha engolido o erro. Assim os testes de sistema, que percorrem
 * o fluxo do cadastro ao resultado, também provam que ele não usa a rede.
 *
 * O que sai por código nativo (uma biblioteca com envio próprio) não passa por
 * aqui. Esse caminho é fechado de outro modo: o teste de `sem-rede.test.ts`, em
 * `tests/unit/config`, confere as dependências, e o APK de entrega sai sem a
 * permissão de internet (`app.config.js`).
 */

export type ChamadaDeRede = {
  via: 'fetch' | 'XMLHttpRequest' | 'WebSocket';
  destino: string;
};

const chamadas: ChamadaDeRede[] = [];
let instalado = false;

function descrever(destino: unknown): string {
  if (typeof destino === 'string') return destino;
  if (destino instanceof URL) return destino.href;
  if (destino && typeof destino === 'object' && 'url' in destino) {
    return String((destino as { url: unknown }).url);
  }
  return String(destino);
}

function recusar(via: ChamadaDeRede['via'], destino: unknown): Error {
  const chamada = { via, destino: descrever(destino) };
  chamadas.push(chamada);
  return new Error(`O aplicativo não pode usar a rede (#16): ${chamada.via} → ${chamada.destino}`);
}

export function bloquearRede(): void {
  if (instalado) return;
  instalado = true;

  const alvo = globalThis as Record<string, unknown>;

  alvo.fetch = (destino: unknown) => Promise.reject(recusar('fetch', destino));

  alvo.XMLHttpRequest = class XMLHttpRequestBloqueado {
    open(_metodo: string, destino: unknown): never {
      throw recusar('XMLHttpRequest', destino);
    }
  };

  alvo.WebSocket = class WebSocketBloqueado {
    constructor(destino: unknown) {
      throw recusar('WebSocket', destino);
    }
  };
}

export function chamadasDeRede(): readonly ChamadaDeRede[] {
  return [...chamadas];
}

export function esquecerChamadasDeRede(): void {
  chamadas.length = 0;
}

export function exigirSemChamadasDeRede(): void {
  if (chamadas.length === 0) return;

  const lista = chamadas.map((chamada) => `  ${chamada.via} → ${chamada.destino}`).join('\n');
  esquecerChamadasDeRede();
  throw new Error(`O teste fez chamada de rede, e o aplicativo não pode (#16):\n${lista}`);
}
