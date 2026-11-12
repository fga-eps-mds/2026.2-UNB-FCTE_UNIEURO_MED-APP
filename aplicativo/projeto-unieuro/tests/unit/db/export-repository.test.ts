import { createExportRepository } from '@/db/export-repository';

import { PNG_DO_RELOGIO, gravarExamesParaExportar } from '../../test-support/exames-para-exportar';
import { abrirTabletComAnaEBruno, type TabletComAnaEBruno } from '../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let tablet: TabletComAnaEBruno;
let ids: Awaited<ReturnType<typeof gravarExamesParaExportar>>;

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  ids = await gravarExamesParaExportar(tablet);
});

afterEach(async () => {
  await tablet.fechar();
});

const repository = () => createExportRepository(async () => tablet.database);

describe('createExportRepository', () => {
  it('lê só os pacientes e exames do profissional, na ordem do cadastro e do início', async () => {
    const pacientes = await repository().lerExames(tablet.anaId);

    expect(pacientes).toHaveLength(2);
    expect(pacientes.map((p) => p.exames.map((e) => e.inicio))).toEqual([
      ['2026-10-06T12:00:00.000Z', '2026-10-13T12:00:00.000Z'],
      ['2026-10-12T12:00:00.000Z'],
    ]);
    expect(pacientes.map((p) => p.dataNascimento)).toEqual(['1948-10-07', '1950-01-20']);
  });

  it('usa o número interno do paciente e do exame, sem nome, CPF nem ficha', async () => {
    const [jose] = await repository().lerExames(tablet.anaId);

    expect(jose.id).toBe(ids.jose.id);
    expect(jose.exames.map((exame) => exame.id)).toEqual([1, 2]);
    expect(JSON.stringify(jose)).not.toMatch(/José|12345678909|2026-0001/);
  });

  it('traz o termo, a tarefa, o traçado em ordem e a imagem do desenho', async () => {
    const [jose] = await repository().lerExames(tablet.anaId);
    const [aceito, recusado] = jose.exames;

    expect(aceito.estado).toBe('em_andamento');
    expect(aceito.termo).toEqual({
      versao: 'TCLE v1.0',
      aceito: true,
      assinadoPor: 'paciente',
      dataHora: '2026-10-06T12:02:00.000Z',
      autorizaImagens: true,
      autorizaPesquisaFutura: false,
    });
    expect(aceito.tarefas).toHaveLength(1);
    const [relogio] = aceito.tarefas;
    expect(relogio).toMatchObject({
      ordem: 1,
      tipo: 'relogio',
      largura: 800,
      altura: 600,
      inicio: '2026-10-06T12:03:00.000Z',
      termino: '2026-10-06T12:05:00.000Z',
    });
    expect(relogio.desenho?.confirmadoEm).toBe('2026-10-06T12:05:00.000Z');
    expect(Array.from(relogio.desenho!.png)).toEqual(Array.from(PNG_DO_RELOGIO));
    expect(relogio.eventos).toEqual([
      {
        ordem: 1,
        tipo: 'inicio',
        ponteiro: 'caneta',
        x: 10,
        y: 20,
        instante: 0,
        pressao: 0.5,
        inclinacaoX: null,
        inclinacaoY: null,
      },
      expect.objectContaining({ ordem: 2, tipo: 'ponto', pressao: null }),
      expect.objectContaining({ ordem: 3, tipo: 'desfazer', ponteiro: null, x: null }),
    ]);

    expect(recusado).toMatchObject({ estado: 'cancelada', tarefas: [] });
    expect(recusado.termo).toMatchObject({ aceito: false, autorizaImagens: null });
  });

  it('exame que ainda espera o termo vem sem termo', async () => {
    const [, antonio] = await repository().lerExames(tablet.anaId);

    expect(antonio.exames).toEqual([
      expect.objectContaining({ estado: 'aguardando_consentimento', termo: null, tarefas: [] }),
    ]);
  });

  it('com o paciente, lê só os exames dele', async () => {
    const pacientes = await repository().lerExames(tablet.anaId, ids.antonio.id);

    expect(pacientes).toHaveLength(1);
    expect(pacientes[0].dataNascimento).toBe('1950-01-20');
  });

  it('não lê paciente de outro profissional, mesmo pedindo pelo id', async () => {
    await expect(repository().lerExames(tablet.anaId + 99)).resolves.toEqual([]);
    const maria = await tablet.database.getFirstAsync<{ id: number }>(
      "SELECT id FROM paciente WHERE data_nascimento = '1945-05-05'",
    );
    await expect(repository().lerExames(tablet.anaId, maria!.id)).resolves.toEqual([]);
  });
});
