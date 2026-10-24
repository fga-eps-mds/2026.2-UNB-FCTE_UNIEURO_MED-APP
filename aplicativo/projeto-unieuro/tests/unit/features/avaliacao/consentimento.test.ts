import {
  registrarDecisaoConsentimento,
  verificarAcessoTarefas,
  type ConsentimentoRepository,
  type EstadoAvaliacao,
} from '@/features/avaliacao/consentimento';

const AGORA = new Date('2026-10-24T15:04:35.000Z');

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
          versaoTermo: '2026-09-15',
          quemAssina: 'responsavel_legal',
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
      versaoTermo: '2026-09-15',
      quemAssina: 'responsavel_legal',
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
