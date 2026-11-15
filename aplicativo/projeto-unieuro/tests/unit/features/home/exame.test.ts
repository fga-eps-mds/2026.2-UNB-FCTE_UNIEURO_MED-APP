import {
  RESULTADO_INDISPONIVEL,
  SEM_ANALISE,
  SITUACAO_EM_ANDAMENTO,
  formatarHora,
  lerAtendimento,
  paraBase64,
  paraConsulta,
  pngParaDataUri,
  situacaoDoExame,
  type DesenhoGravado,
  type ExameGravado,
} from '@/features/home/exame';

import { loadBuiltin } from '../../../test-support/real-sqlite';

// Datas montadas no horário do tablet, para o teste valer em qualquer fuso.
const INICIO = new Date(2026, 9, 5, 14, 32).toISOString();
const CONFIRMADO = new Date(2026, 9, 5, 14, 35).toISOString();

const desenho = (ordem: 1 | 2 | 3, bytes: number[] = [1, 2, 3]): DesenhoGravado => ({
  tipo: (['relogio', 'cubo', 'trilhas'] as const)[ordem - 1],
  ordem,
  confirmadoEm: CONFIRMADO,
  imagemPng: new Uint8Array(bytes),
});

const exame = (dados: Partial<ExameGravado> = {}): ExameGravado => ({
  id: 12,
  iniciadoEm: INICIO,
  estado: 'concluida',
  pacienteNome: 'José Alves Martins',
  numeroFicha: '2026-0184',
  profissionalNome: 'Ana Carolina Souza',
  desenhos: [desenho(1), desenho(2), desenho(3)],
  ...dados,
});

const { Buffer } = loadBuiltin<{
  Buffer: { from(bytes: number[]): { toString(encoding: 'base64'): string } };
}>('node:buffer');

const base64DoNode = (bytes: number[]) => Buffer.from(bytes).toString('base64');

describe('imagem do desenho em base64', () => {
  it.each([
    ['vazia', []],
    ['com 1 byte', [0x89]],
    ['com 2 bytes', [0x89, 0x50]],
    ['com 3 bytes', [0x89, 0x50, 0x4e]],
    ['com todos os valores de byte', Array.from({ length: 256 }, (_, i) => i)],
  ])('codifica a imagem %s igual ao Node', (_, bytes) => {
    expect(paraBase64(new Uint8Array(bytes))).toBe(base64DoNode(bytes));
  });

  it('monta o endereço de imagem PNG que o React Native aceita', () => {
    expect(pngParaDataUri(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(
      'data:image/png;base64,iVBORw==',
    );
  });
});

describe('hora do exame', () => {
  it('mostra horas e minutos no horário do tablet, com dois dígitos', () => {
    expect(formatarHora(new Date(2026, 9, 5, 9, 5).toISOString())).toBe('09:05');
    expect(formatarHora(INICIO)).toBe('14:32');
  });
});

describe('situação do exame', () => {
  it.each([
    ['concluida', 'concluido', 'Concluído'],
    ['interrompida', 'interrompido', 'Interrompido'],
    ['cancelada', 'recusado', 'Recusou o termo'],
  ])('mostra o exame %s com o mesmo selo da lista de pacientes', (estado, situacao, texto) => {
    expect(situacaoDoExame(estado)).toEqual({ situacao, texto });
  });

  it.each(['aguardando_consentimento', 'em_andamento', 'processando_resultado'])(
    'mostra o estado %s como em andamento',
    (estado) => {
      expect(situacaoDoExame(estado)).toEqual({ situacao: null, texto: SITUACAO_EM_ANDAMENTO });
    },
  );
});

describe('Cenário: consultar uma avaliação salva', () => {
  it('mostra os dados do exame, com a data e a hora no horário do tablet', () => {
    expect(paraConsulta(exame())).toMatchObject({
      id: 12,
      pacienteNome: 'José Alves Martins',
      numeroFicha: '2026-0184',
      profissionalNome: 'Ana Carolina Souza',
      data: '05/10/2026',
      hora: '14:32',
      situacao: 'concluido',
      situacaoTexto: 'Concluído',
    });
  });

  it('mostra os três desenhos na ordem do exame, com o nome da tarefa e a imagem', () => {
    const consulta = paraConsulta(exame());

    expect(consulta.desenhos).toEqual([
      expect.objectContaining({ ordem: 1, tipo: 'relogio', nome: 'Relógio' }),
      expect.objectContaining({ ordem: 2, tipo: 'cubo', nome: 'Cubo' }),
      expect.objectContaining({ ordem: 3, tipo: 'trilhas', nome: 'Trilhas' }),
    ]);
    expect(consulta.desenhos[0]).toMatchObject({
      imagemUri: `data:image/png;base64,${base64DoNode([1, 2, 3])}`,
      confirmadoAs: '14:35',
    });
    expect(consulta.desenhosGravados).toBe(3);
  });

  it('põe cada imagem na sua tarefa, mesmo que venham fora de ordem', () => {
    const consulta = paraConsulta(
      exame({ desenhos: [desenho(3, [3]), desenho(1, [1]), desenho(2, [2])] }),
    );

    expect(consulta.desenhos.map((item) => item.imagemUri)).toEqual([
      pngParaDataUri(new Uint8Array([1])),
      pngParaDataUri(new Uint8Array([2])),
      pngParaDataUri(new Uint8Array([3])),
    ]);
  });

  it('com os três desenhos, avisa que o resultado do modelo ainda não está disponível', () => {
    expect(paraConsulta(exame()).resultado).toBe(RESULTADO_INDISPONIVEL);
  });

  it('no exame interrompido, mostra as tarefas sem desenho e que não há análise', () => {
    const consulta = paraConsulta(exame({ estado: 'interrompida', desenhos: [desenho(1)] }));

    expect(consulta.situacaoTexto).toBe('Interrompido');
    expect(consulta.desenhosGravados).toBe(1);
    expect(consulta.desenhos.slice(1)).toEqual([
      expect.objectContaining({ nome: 'Cubo', imagemUri: null, confirmadoAs: null }),
      expect.objectContaining({ nome: 'Trilhas', imagemUri: null, confirmadoAs: null }),
    ]);
    expect(consulta.resultado).toBe(SEM_ANALISE);
  });

  it('no exame sem nenhum desenho, mostra as três tarefas vazias', () => {
    const consulta = paraConsulta(exame({ estado: 'cancelada', desenhos: [] }));

    expect(consulta.desenhosGravados).toBe(0);
    expect(consulta.desenhos.every((item) => item.imagemUri === null)).toBe(true);
    expect(consulta.situacaoTexto).toBe('Recusou o termo');
  });
});

describe('atendimento indicado na rota', () => {
  it.each([
    ['12', 12],
    ['1', 1],
  ])('aceita o id %s', (valor, id) => {
    expect(lerAtendimento(valor)).toBe(id);
  });

  it('usa o primeiro valor quando o parâmetro vem repetido', () => {
    expect(lerAtendimento(['7', '8'])).toBe(7);
  });

  it.each([undefined, '', '0', '-3', '07', '1.5', ' 7', 'abc', '99999999999999999999'])(
    'recusa o valor %p',
    (valor) => {
      expect(lerAtendimento(valor)).toBeNull();
    },
  );
});
