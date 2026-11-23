import {
  type ChamadaDeRede,
  bloquearRede,
  chamadasDeRede,
  esquecerChamadasDeRede,
  exigirSemChamadasDeRede,
} from '../../test-support/sem-rede';

/**
 * O guarda de rede vale para a suíte inteira (`jest.setup.ts`). Aqui se confere
 * que ele enxerga cada caminho de saída e que o aviso aponta o destino.
 */

// O `jest.setup.ts` reprova o teste que deixar chamada registrada. Estes casos fazem
// chamadas de propósito, então cada um confere o registro e o esvazia no fim.
function conferirEEsquecer(esperado: readonly ChamadaDeRede[]) {
  expect(chamadasDeRede()).toEqual(esperado);
  esquecerChamadasDeRede();
}

describe('guarda de rede dos testes', () => {
  it('começa sem nenhuma chamada registrada', () => {
    expect(chamadasDeRede()).toEqual([]);
    expect(() => exigirSemChamadasDeRede()).not.toThrow();
  });

  it('registra o fetch e recusa a resposta', async () => {
    await expect(fetch('https://exemplo.test/dados')).rejects.toThrow(/rede/);

    conferirEEsquecer([{ via: 'fetch', destino: 'https://exemplo.test/dados' }]);
  });

  it('registra o fetch feito com um objeto Request ou URL', async () => {
    await expect(fetch(new URL('https://exemplo.test/url'))).rejects.toThrow();
    await expect(fetch({ url: 'https://exemplo.test/request' } as Request)).rejects.toThrow();

    conferirEEsquecer([
      { via: 'fetch', destino: 'https://exemplo.test/url' },
      { via: 'fetch', destino: 'https://exemplo.test/request' },
    ]);
  });

  it('registra o XMLHttpRequest ao abrir a conexão', () => {
    const requisicao = new XMLHttpRequest();

    expect(() => requisicao.open('POST', 'https://exemplo.test/envio')).toThrow(/rede/);

    conferirEEsquecer([{ via: 'XMLHttpRequest', destino: 'https://exemplo.test/envio' }]);
  });

  it('registra o WebSocket ao abrir a conexão', () => {
    expect(() => new WebSocket('wss://exemplo.test/canal')).toThrow(/rede/);

    conferirEEsquecer([{ via: 'WebSocket', destino: 'wss://exemplo.test/canal' }]);
  });

  it('o aviso lista cada chamada para quem lê o teste que falhou', async () => {
    await fetch('https://exemplo.test/a').catch(() => undefined);
    expect(() => new WebSocket('wss://exemplo.test/b')).toThrow();

    expect(() => exigirSemChamadasDeRede()).toThrow(
      /fetch → https:\/\/exemplo\.test\/a[\s\S]*WebSocket → wss:\/\/exemplo\.test\/b/,
    );
    expect(chamadasDeRede()).toEqual([]);
  });

  it('esquecer as chamadas libera o teste seguinte', async () => {
    await fetch('https://exemplo.test/a').catch(() => undefined);

    esquecerChamadasDeRede();

    expect(chamadasDeRede()).toEqual([]);
    expect(() => exigirSemChamadasDeRede()).not.toThrow();
  });

  it('instalar de novo não empilha o bloqueio nem perde o registro', async () => {
    bloquearRede();
    bloquearRede();

    await fetch('https://exemplo.test/a').catch(() => undefined);

    expect(chamadasDeRede()).toHaveLength(1);
    esquecerChamadasDeRede();
  });
});
