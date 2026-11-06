import {
  registrarDecisaoConsentimento,
  verificarAcessoTarefas,
  type ConsentimentoRepository,
  type EstadoAvaliacao,
} from '@/features/avaliacao/consentimento';

const AGORA = new Date('2026-10-24T15:04:35.000Z');
const ASSINATURA_PNG = new Uint8Array([137, 80, 78, 71]);

function criarRepository(estado: EstadoAvaliacao | null = 'aguardando_consentimento') {
  const repository: ConsentimentoRepository = {
    salvarDecisao: jest.fn(async () => true),
    buscarEstado: jest.fn(async () => estado),
  };
  return repository;
}

describe('registrarDecisaoConsentimento', () => {
  it('salva aceite, versão, quem aceitou e data e hora em ISO 8601', async () => {
    const repository = criarRepository();

    await expect(
      registrarDecisaoConsentimento(
        {
          atendimentoId: 12,
          aceito: true,
          assinaturaPng: ASSINATURA_PNG,
          versaoTermo: '2026-09-15',
          quemAssina: 'responsavel_legal',
          autorizaImagensPesquisa: true,
          autorizaDadosPesquisaFutura: false,
        },
        repository,
        () => AGORA,
      ),
    ).resolves.toEqual({
      sucesso: true,
      estado: 'em_andamento',
      decididoEm: '2026-10-24T15:04:35.000Z',
    });
    expect(repository.salvarDecisao).toHaveBeenCalledWith({
      atendimentoId: 12,
      aceito: true,
      assinaturaPng: ASSINATURA_PNG,
      versaoTermo: '2026-09-15',
      quemAssina: 'responsavel_legal',
      autorizaImagensPesquisa: true,
      autorizaDadosPesquisaFutura: false,
      decididoEm: '2026-10-24T15:04:35.000Z',
    });
  });

  it('informa o cancelamento depois da recusa', async () => {
    const repository = criarRepository();

    await expect(
      registrarDecisaoConsentimento(
        {
          atendimentoId: 12,
          aceito: false,
          versaoTermo: '2026-09-15',
          quemAssina: 'paciente',
        },
        repository,
        () => AGORA,
      ),
    ).resolves.toMatchObject({ sucesso: true, estado: 'cancelada' });
  });

  it('não consulta o banco com um id inválido', async () => {
    const repository = criarRepository();

    await expect(
      registrarDecisaoConsentimento(
        {
          atendimentoId: 0,
          aceito: true,
          assinaturaPng: ASSINATURA_PNG,
          versaoTermo: '2026-09-15',
          quemAssina: 'paciente',
        },
        repository,
      ),
    ).resolves.toEqual({ sucesso: false, motivo: 'atendimento_invalido' });
    expect(repository.salvarDecisao).not.toHaveBeenCalled();
  });

  it('não altera uma avaliação que já recebeu decisão', async () => {
    const repository = criarRepository();
    jest.mocked(repository.salvarDecisao).mockResolvedValue(false);

    await expect(
      registrarDecisaoConsentimento(
        {
          atendimentoId: 12,
          aceito: false,
          versaoTermo: '2026-09-15',
          quemAssina: 'paciente',
        },
        repository,
      ),
    ).resolves.toEqual({ sucesso: false, motivo: 'decisao_ja_registrada' });
  });
});

describe('autorizações dos itens 9 e 10', () => {
  const aceite = (autorizacoes: {
    autorizaImagensPesquisa?: boolean | null;
    autorizaDadosPesquisaFutura?: boolean | null;
  }) => ({
    atendimentoId: 12,
    aceito: true as const,
    assinaturaPng: ASSINATURA_PNG,
    versaoTermo: '2026-09-15',
    quemAssina: 'paciente' as const,
    ...autorizacoes,
  });

  it.each([
    ['sem nenhuma resposta', {}],
    [
      'com as duas respostas nulas',
      { autorizaImagensPesquisa: null, autorizaDadosPesquisaFutura: null },
    ],
    [
      'sem resposta no item 10',
      { autorizaImagensPesquisa: true, autorizaDadosPesquisaFutura: null },
    ],
    [
      'sem resposta no item 9',
      { autorizaImagensPesquisa: null, autorizaDadosPesquisaFutura: true },
    ],
    [
      'com o item 9 em "Não"',
      { autorizaImagensPesquisa: false, autorizaDadosPesquisaFutura: true },
    ],
    [
      'com os dois itens em "Não"',
      { autorizaImagensPesquisa: false, autorizaDadosPesquisaFutura: false },
    ],
  ])('rejeita o aceite %s, sem gravar nada', async (_caso, autorizacoes) => {
    const repository = criarRepository();

    await expect(
      registrarDecisaoConsentimento(aceite(autorizacoes), repository, () => AGORA),
    ).resolves.toEqual({ sucesso: false, motivo: 'autorizacoes_invalidas' });
    expect(repository.salvarDecisao).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'aceita com o item 9 em "Sim" e o item 10 respondido (%s)',
    async (futura) => {
      const repository = criarRepository();

      await expect(
        registrarDecisaoConsentimento(
          aceite({ autorizaImagensPesquisa: true, autorizaDadosPesquisaFutura: futura }),
          repository,
          () => AGORA,
        ),
      ).resolves.toMatchObject({ sucesso: true, estado: 'em_andamento' });
      expect(repository.salvarDecisao).toHaveBeenCalledTimes(1);
    },
  );

  it('permite recusar com os itens sem resposta', async () => {
    const repository = criarRepository();

    await expect(
      registrarDecisaoConsentimento(
        {
          atendimentoId: 12,
          aceito: false,
          versaoTermo: '2026-09-15',
          quemAssina: 'paciente',
          autorizaImagensPesquisa: null,
          autorizaDadosPesquisaFutura: null,
        },
        repository,
        () => AGORA,
      ),
    ).resolves.toMatchObject({ sucesso: true, estado: 'cancelada' });
  });

  it('confere o atendimento antes das autorizações', async () => {
    const repository = criarRepository();

    await expect(
      registrarDecisaoConsentimento({ ...aceite({}), atendimentoId: 0 }, repository),
    ).resolves.toEqual({ sucesso: false, motivo: 'atendimento_invalido' });
  });
});

describe('verificarAcessoTarefas', () => {
  it.each([
    ['em_andamento', 'liberado'],
    ['aguardando_consentimento', 'aguardando_consentimento'],
    ['cancelada', 'bloqueado'],
    ['concluida', 'bloqueado'],
    [null, 'bloqueado'],
  ] as const)('com estado %s devolve %s', async (estado, esperado) => {
    await expect(verificarAcessoTarefas(12, criarRepository(estado))).resolves.toBe(esperado);
  });

  it('bloqueia id inválido sem consultar o banco', async () => {
    const repository = criarRepository('em_andamento');

    await expect(verificarAcessoTarefas(Number.NaN, repository)).resolves.toBe('bloqueado');
    expect(repository.buscarEstado).not.toHaveBeenCalled();
  });
});
