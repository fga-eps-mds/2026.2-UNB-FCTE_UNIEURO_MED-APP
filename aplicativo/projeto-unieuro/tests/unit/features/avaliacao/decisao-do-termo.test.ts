import type { RegistrarDecisaoInput, ResultadoDecisao } from '@/features/avaliacao/consentimento';
import {
  DECISAO_SEM_CONTEXTO,
  aceitarTermo,
  recusarTermo,
} from '@/features/avaliacao/decisao-do-termo';
import { TERMO_TCLE } from '@/features/avaliacao/termo-tcle';
import { gerarImagemDesenho } from '@/features/captura/imagem-desenho';

// O Skia não gera PNG no Jest; a imagem tem o próprio teste (imagem-desenho.test.ts).
jest.mock('@/features/captura/imagem-desenho', () => ({
  gerarImagemDesenho: jest.fn(() => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
}));

const ATENDIMENTO = 12;
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const ASSINATURA = {
  tracos: [
    [
      { x: 20, y: 80, instante: 0 },
      { x: 90, y: 40, instante: 16 },
    ],
  ],
  dimensoes: { largura: 520, altura: 160 },
};
const PELO_PACIENTE = { quemAssina: 'paciente', versaoTermo: TERMO_TCLE.versao } as const;
const PELO_RESPONSAVEL = {
  quemAssina: 'responsavel_legal',
  versaoTermo: TERMO_TCLE.versao,
} as const;

const gravada = (estado: 'em_andamento' | 'cancelada'): ResultadoDecisao => ({
  sucesso: true,
  estado,
  decididoEm: '2026-10-25T13:00:00.000Z',
});

function registrador(resultado: ResultadoDecisao) {
  return jest.fn(async (_input: RegistrarDecisaoInput) => resultado);
}

describe('aceitarTermo', () => {
  it('aceite: grava a imagem da assinatura com quem assina e a versão, e segue para as tarefas', async () => {
    const registrar = registrador(gravada('em_andamento'));

    await expect(aceitarTermo(ATENDIMENTO, ASSINATURA, PELO_RESPONSAVEL, registrar)).resolves.toBe(
      'tarefas',
    );

    expect(gerarImagemDesenho).toHaveBeenCalledWith(ASSINATURA.tracos, ASSINATURA.dimensoes);
    expect(registrar).toHaveBeenCalledWith({
      atendimentoId: ATENDIMENTO,
      versaoTermo: TERMO_TCLE.versao,
      quemAssina: 'responsavel_legal',
      aceito: true,
      assinaturaPng: PNG,
    });
  });

  it('assinatura que não vira imagem: não grava o aceite', async () => {
    jest.mocked(gerarImagemDesenho).mockImplementationOnce(() => {
      throw new Error('Quadro sem tamanho para gerar a imagem do desenho.');
    });
    const registrar = registrador(gravada('em_andamento'));

    await expect(aceitarTermo(ATENDIMENTO, ASSINATURA, PELO_PACIENTE, registrar)).rejects.toThrow(
      'Quadro sem tamanho',
    );
    expect(registrar).not.toHaveBeenCalled();
  });
});

describe('recusarTermo', () => {
  it('recusa: grava a decisão sem assinatura e volta ao início', async () => {
    const registrar = registrador(gravada('cancelada'));

    await expect(recusarTermo(ATENDIMENTO, PELO_PACIENTE, registrar)).resolves.toBe('inicio');

    expect(registrar).toHaveBeenCalledWith({
      atendimentoId: ATENDIMENTO,
      versaoTermo: TERMO_TCLE.versao,
      quemAssina: 'paciente',
      aceito: false,
    });
    expect(gerarImagemDesenho).not.toHaveBeenCalled();
  });
});

describe('decisão que não foi gravada agora', () => {
  it('decisão já gravada: segue para as tarefas, e o portão delas confere o estado', async () => {
    const registrar = registrador({ sucesso: false, motivo: 'decisao_ja_registrada' });

    await expect(aceitarTermo(ATENDIMENTO, ASSINATURA, PELO_PACIENTE, registrar)).resolves.toBe(
      'tarefas',
    );
    await expect(recusarTermo(ATENDIMENTO, PELO_PACIENTE, registrar)).resolves.toBe('tarefas');
  });

  it('atendimento inválido: volta ao início', async () => {
    const registrar = registrador({ sucesso: false, motivo: 'atendimento_invalido' });

    await expect(aceitarTermo(0, ASSINATURA, PELO_PACIENTE, registrar)).resolves.toBe('inicio');
    await expect(recusarTermo(0, PELO_PACIENTE, registrar)).resolves.toBe('inicio');
  });

  it('sem a versão do termo e quem assina, não grava nada', async () => {
    const registrar = registrador(gravada('em_andamento'));

    await expect(aceitarTermo(ATENDIMENTO, ASSINATURA, undefined, registrar)).rejects.toThrow(
      DECISAO_SEM_CONTEXTO,
    );
    await expect(recusarTermo(ATENDIMENTO, undefined, registrar)).rejects.toThrow(
      DECISAO_SEM_CONTEXTO,
    );
    expect(registrar).not.toHaveBeenCalled();
    expect(gerarImagemDesenho).not.toHaveBeenCalled();
  });
});
