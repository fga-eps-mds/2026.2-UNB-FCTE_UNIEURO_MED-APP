import {
  describeFailure,
  nearbyStatus,
  startFailure,
  SYNC_ERRORS,
  syncFailure,
  type SyncErrorCode,
} from '@/features/sincronizacao/error-codes';
import { FILE_ERROR_CODES, NEARBY_ERROR_CODES } from '@/features/sincronizacao/sync-service';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const codes = Object.keys(SYNC_ERRORS).map(Number) as SyncErrorCode[];

describe('catálogo de códigos', () => {
  it('fica nas faixas da sincronização, de 100 a 499', () => {
    expect(codes.every((code) => code >= 100 && code <= 499)).toBe(true);
  });

  it('cada código tem um título próprio dentro da sua faixa', () => {
    const byRange = new Map<number, Set<string>>();
    for (const code of codes) {
      const range = Math.floor(code / 100);
      const titles = byRange.get(range) ?? new Set<string>();
      expect(titles.has(SYNC_ERRORS[code].title)).toBe(false);
      titles.add(SYNC_ERRORS[code].title);
      byRange.set(range, titles);
    }
  });

  it('cada recusa do arquivo fica na faixa 4xx e cada recusa do Nearby na 3xx', () => {
    expect(Object.values(FILE_ERROR_CODES).every((code) => code >= 400 && code < 500)).toBe(true);
    expect(Object.values(NEARBY_ERROR_CODES).every((code) => code >= 300 && code < 400)).toBe(true);
  });
});

describe('describeFailure', () => {
  it('mostra o título com o código e, embaixo, o que fazer', () => {
    expect(describeFailure(syncFailure(202))).toEqual({
      headline: 'Senha incorreta (Cód. de Erro: 202)',
      action: 'Digite a senha com que você entrou no aplicativo.',
      spoken:
        'Senha incorreta. Código de erro 202. Digite a senha com que você entrou no aplicativo.',
      warning: false,
    });
  });

  it('acrescenta o código do Nearby quando a falha veio dele', () => {
    const text = describeFailure(syncFailure(201, { nearby: 8011 }));

    expect(text.headline).toBe(
      'Falha ao conectar ao outro tablet (Cód. de Erro: 201 · Nearby 8011)',
    );
    expect(text.spoken).toContain('Código de erro 201, código do Nearby 8011.');
  });

  it('o aviso usa "Cód.:", sem a palavra erro', () => {
    const text = describeFailure(syncFailure(340));

    expect(text.headline).toBe('A conexão caiu antes do fim da troca (Cód.: 340)');
    expect(text.spoken).toContain('Código 340.');
    expect(text.warning).toBe(true);
  });

  it('avisa antes da ação que os lotes já gravados ficaram', () => {
    expect(describeFailure(syncFailure(313, { kept: true })).action).toBe(
      'Os dados recebidos até ali foram salvos. Tente de novo. Se continuar, informe este código ao suporte do MED.',
    );
  });

  it.each([116, 117] as const)('o código %i só informa a causa', (code) => {
    const text = describeFailure(syncFailure(code));

    expect(text.action).toBeNull();
    expect(text.spoken).toBe(`${SYNC_ERRORS[code].title}. Código de erro ${code}.`);
  });
});

describe('nearbyStatus', () => {
  it('lê o código do erro do módulo nativo', () => {
    expect(nearbyStatus({ code: 'ERR_NEARBY_8034' })).toBe(8034);
    expect(nearbyStatus({ code: 'ERR_NEARBY_-1' })).toBe(-1);
  });

  it('devolve null quando o erro não veio do Nearby', () => {
    expect(nearbyStatus(new Error('outro'))).toBeNull();
    expect(nearbyStatus({ code: 'ERR_OUTRO' })).toBeNull();
    expect(nearbyStatus(null)).toBeNull();
  });
});

describe('startFailure', () => {
  it.each([
    [8031, 110],
    [8034, 111],
    [8025, 112],
    [8007, 113],
    [8032, 114],
    [8050, 115],
    [2, 116],
    [3, 117],
  ])('o código %i do Nearby vira o código %i', (status, code) => {
    expect(startFailure(status)).toEqual(syncFailure(code as SyncErrorCode, { nearby: status }));
  });

  it('código desconhecido vira 119, com o código do Nearby', () => {
    expect(startFailure(9999)).toEqual(syncFailure(119, { nearby: 9999 }));
  });

  it('sem código do Nearby, vira 119 sem ele', () => {
    expect(startFailure(null)).toEqual(syncFailure(119));
  });
});
