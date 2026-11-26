import { createExportRepository } from '@/db/export-repository';
import { createMarkingRepository } from '@/db/marking-repository';

import { PNG_DO_RELOGIO, gravarExamesParaExportar } from '../../test-support/exames-para-exportar';
import {
  BRUNO,
  abrirTabletComAnaEBruno,
  hashDaSenhaDeTeste,
  type TabletComAnaEBruno,
} from '../../test-support/tablet';

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

  it('cada exame do profissional vem sem quem aplicou: o arquivo já traz o CRM dele', async () => {
    const pacientes = await repository().lerExames(tablet.anaId);

    expect(pacientes.flatMap((p) => p.exames).every((e) => e.aplicadoPor === undefined)).toBe(true);
  });

  describe('exclusão lógica (#58, #47)', () => {
    const excluir = (atendimentoId: number) =>
      tablet.database.runAsync(
        "UPDATE avaliacao SET excluido_em = '2026-11-01T10:00:00.000Z' WHERE id = ?",
        [atendimentoId],
      );

    it('não lê o exame excluído, nem os desenhos e traçados dele', async () => {
      const [jose] = await repository().lerExames(tablet.anaId, ids.jose.id);
      const [comDesenho] = jose.exames;
      expect(comDesenho.tarefas).toHaveLength(1);

      await excluir(comDesenho.id);
      const [depois] = await repository().lerExames(tablet.anaId, ids.jose.id);

      expect(depois.exames.map((exame) => exame.id)).not.toContain(comDesenho.id);
      expect(depois.exames).toHaveLength(1);
      expect(depois.exames.flatMap((exame) => exame.tarefas)).toEqual([]);
    });

    it('o paciente com todos os exames excluídos não sai no arquivo', async () => {
      const [antonio] = await repository().lerExames(tablet.anaId, ids.antonio.id);
      await excluir(antonio.exames[0].id);

      await expect(repository().lerExames(tablet.anaId, ids.antonio.id)).resolves.toEqual([]);
      const todos = await repository().lerExames(tablet.anaId);
      expect(todos.map((p) => p.id)).toEqual([ids.jose.id]);
    });
  });

  describe('marcação como teste ou material de ensino (#58)', () => {
    const marcacoes = () => createMarkingRepository(async () => tablet.database);

    it('lê o tipo, a data e a hora e o CRM de quem marcou, e o exame continua no arquivo', async () => {
      await marcacoes().marcarExame(1, tablet.anaId, 'teste', '2026-10-20T09:15:00.000Z');

      const [jose] = await repository().lerExames(tablet.anaId, ids.jose.id);

      expect(jose.exames.map((exame) => exame.id)).toEqual([1, 2]);
      expect(jose.exames[0].marcacao).toEqual({
        tipo: 'teste',
        marcadaEm: '2026-10-20T09:15:00.000Z',
        crmNumero: '12345',
        crmUf: 'DF',
      });
      expect(jose.exames[0].tarefas).toHaveLength(1);
      expect(jose.exames[1].marcacao).toBeNull();
    });

    it('o material de ensino sai com o seu tipo', async () => {
      await marcacoes().marcarExame(2, tablet.anaId, 'ensino', '2026-10-21T10:00:00.000Z');

      const [jose] = await repository().lerExames(tablet.anaId, ids.jose.id);

      expect(jose.exames[1].marcacao?.tipo).toBe('ensino');
    });

    it('o exame desmarcado volta a sair sem marcação', async () => {
      await marcacoes().marcarExame(1, tablet.anaId, 'teste', '2026-10-20T09:15:00.000Z');
      await marcacoes().desmarcarExame(1, tablet.anaId, '2026-10-22T08:00:00.000Z');

      const [jose] = await repository().lerExames(tablet.anaId, ids.jose.id);

      expect(jose.exames[0].marcacao).toBeNull();
    });

    it('a marcação não esconde o exame da exportação de todos', async () => {
      await marcacoes().marcarExame(3, tablet.anaId, 'teste', '2026-10-20T09:15:00.000Z');

      const pacientes = await repository().lerExames(tablet.anaId);

      expect(pacientes.flatMap((p) => p.exames).map((exame) => exame.id)).toEqual([1, 2, 3]);
    });
  });

  describe('exportação de um exame específico (#22)', () => {
    it('com o exame, lê só ele, mesmo que o paciente tenha outros exames', async () => {
      const pacientes = await repository().lerExames(tablet.anaId, undefined, 1);
      expect(pacientes).toHaveLength(1);
      expect(pacientes[0].id).toBe(ids.jose.id);
      expect(pacientes[0].exames.map((exame) => exame.id)).toEqual([1]);
      expect(pacientes[0].exames[0].tarefas).toHaveLength(1);
    });

    it('o superusuário não lê o exame de outro médico por aqui: a exportação é só do que o profissional aplicou', async () => {
      await tablet.repository.insertSuperuser(
        {
          name: 'Carlos Bernardo Tauil',
          email: 'carlos.tauil@unieuro.com.br',
          crmNumber: '12771',
          crmState: 'DF',
          cpf: '39053344705',
          passwordHash: await hashDaSenhaDeTeste(),
          createdAt: '2026-10-01T00:00:00.000Z',
        },
        null,
      );
      const carlos = (await tablet.repository.findByEmail('carlos.tauil@unieuro.com.br'))!;

      await expect(repository().lerExames(carlos.id, undefined, 1)).resolves.toEqual([]);
    });

    it('não lê exame de outro profissional nem exame excluído', async () => {
      // Exame 4 pertence ao Bruno na fixture gravarExamesParaExportar
      await expect(repository().lerExames(tablet.anaId, undefined, 4)).resolves.toEqual([]);

      await tablet.database.runAsync(
        "UPDATE avaliacao SET excluido_em = '2026-11-01T10:00:00.000Z' WHERE id = 1",
      );
      await expect(repository().lerExames(tablet.anaId, undefined, 1)).resolves.toEqual([]);
    });
  });
});

async function excluirOExameDoAntonio() {
  await tablet.database.runAsync(
    'UPDATE avaliacao SET excluido_em = ?, excluido_por = ? WHERE id_paciente = ?',
    ['2026-10-20T12:00:00.000Z', tablet.anaId, ids.antonio.id],
  );
}

describe('lerExamesDeTodos (#138)', () => {
  const tornarSuperusuario = (id: number) =>
    tablet.database.runAsync("UPDATE profissional SET perfil = 'superusuario' WHERE id = ?", [id]);

  it('o superusuário lê os exames de todos os profissionais, com quem aplicou cada um', async () => {
    await tornarSuperusuario(tablet.anaId);

    const pacientes = await repository().lerExamesDeTodos(tablet.anaId);

    expect(pacientes.map((p) => p.dataNascimento)).toEqual([
      '1948-10-07',
      '1950-01-20',
      '1945-05-05',
    ]);
    expect(pacientes.map((p) => p.exames.map((e) => e.aplicadoPor))).toEqual([
      [
        { nome: 'Ana Carolina Souza', crm: '12345', uf: 'DF' },
        { nome: 'Ana Carolina Souza', crm: '12345', uf: 'DF' },
      ],
      [{ nome: 'Ana Carolina Souza', crm: '12345', uf: 'DF' }],
      [{ nome: BRUNO.name, crm: BRUNO.crmNumber, uf: BRUNO.crmState }],
    ]);
  });

  it('traz os mesmos exames que cada profissional lê, sem nome, CPF nem ficha do paciente', async () => {
    await tornarSuperusuario(tablet.anaId);
    const bruno = (await tablet.repository.findByEmail(BRUNO.email))!;

    const todos = await repository().lerExamesDeTodos(tablet.anaId);
    const semQuemAplicou = todos.map((p) => ({
      ...p,
      exames: p.exames.map(({ aplicadoPor: _, ...exame }) => exame),
    }));

    expect(semQuemAplicou).toEqual([
      ...(await repository().lerExames(tablet.anaId)),
      ...(await repository().lerExames(bruno.id)),
    ]);
    expect(JSON.stringify(todos)).not.toMatch(/José|Maria|12345678909|2026-000\d/);
  });

  it('o médico comum não lê os exames de todos, nem chamando direto', async () => {
    await expect(repository().lerExamesDeTodos(tablet.anaId)).resolves.toEqual([]);
  });

  it('não lê para um superusuário com a conta desativada nem para quem não existe', async () => {
    await tornarSuperusuario(tablet.anaId);
    await tablet.database.runAsync('UPDATE profissional SET ativo = 0 WHERE id = ?', [
      tablet.anaId,
    ]);

    await expect(repository().lerExamesDeTodos(tablet.anaId)).resolves.toEqual([]);
    await expect(repository().lerExamesDeTodos(tablet.anaId + 99)).resolves.toEqual([]);
  });

  it('não lê os exames excluídos', async () => {
    await tornarSuperusuario(tablet.anaId);
    await excluirOExameDoAntonio();

    const pacientes = await repository().lerExamesDeTodos(tablet.anaId);

    expect(pacientes.map((p) => p.dataNascimento)).toEqual(['1948-10-07', '1945-05-05']);
  });
});
