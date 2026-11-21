import { createAttendanceRepository } from '@/db/attendance-repository';
import { createMarkingRepository } from '@/db/marking-repository';
import type { MarcacaoRepository } from '@/features/avaliacao/marcacao';

import {
  BRUNO,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const AGORA = '2026-11-21T18:00:00.000Z';
const DEPOIS = '2026-11-21T19:00:00.000Z';

let tablet: TabletComAnaEBruno;
let brunoId: number;
let repository: MarcacaoRepository;
let exameDaAna: number;

const atender = async (profissionalId: number) =>
  (
    await createAttendanceRepository(async () => tablet.database, cpfProtector).createAttendance({
      patient: {
        name: 'José Alves Martins',
        cpf: '52998224725',
        birthDate: '1948-03-14',
        schoolingYears: 5,
        sex: 'masculino',
      },
      professionalId: profissionalId,
      startedAt: '2026-11-20T12:00:00.000Z',
    })
  ).attendanceId;

const exame = (id: number) =>
  tablet.database.getFirstAsync<{
    estado: string;
    marcacao: string | null;
    marcado_em: string | null;
    marcado_por: number | null;
  }>('SELECT estado, marcacao, marcado_em, marcado_por FROM avaliacao WHERE id = ?', [id]);

const historico = () =>
  tablet.database.getAllAsync<Record<string, unknown>>(
    'SELECT id_avaliacao, acao, tipo, id_profissional, data_hora FROM marcacao ORDER BY id',
  );

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  brunoId = (await tablet.repository.findByEmail(BRUNO.email))!.id;
  repository = createMarkingRepository(async () => tablet.database);
  exameDaAna = await atender(tablet.anaId);
});

afterEach(async () => {
  await tablet.fechar();
});

describe('marcação do exame no banco (#58)', () => {
  it('marca o exame com o tipo, a hora e o profissional e grava o histórico, sem apagar nada', async () => {
    await expect(repository.marcarExame(exameDaAna, tablet.anaId, 'teste', AGORA)).resolves.toBe(
      true,
    );

    await expect(exame(exameDaAna)).resolves.toEqual({
      estado: 'aguardando_consentimento',
      marcacao: 'teste',
      marcado_em: AGORA,
      marcado_por: tablet.anaId,
    });
    await expect(historico()).resolves.toEqual([
      {
        id_avaliacao: exameDaAna,
        acao: 'marcar',
        tipo: 'teste',
        id_profissional: tablet.anaId,
        data_hora: AGORA,
      },
    ]);
    await expect(repository.buscarExame(exameDaAna, tablet.anaId)).resolves.toEqual({
      marcacao: 'teste',
    });
  });

  it('marca também o exame finalizado, que continua com o estado de antes', async () => {
    await tablet.database.runAsync("UPDATE avaliacao SET estado = 'concluida' WHERE id = ?", [
      exameDaAna,
    ]);

    await expect(repository.marcarExame(exameDaAna, tablet.anaId, 'ensino', AGORA)).resolves.toBe(
      true,
    );
    await expect(exame(exameDaAna)).resolves.toMatchObject({
      estado: 'concluida',
      marcacao: 'ensino',
    });
  });

  it('não marca o exame de outro médico nem o encontra para ele', async () => {
    await expect(repository.buscarExame(exameDaAna, brunoId)).resolves.toBeNull();
    await expect(repository.marcarExame(exameDaAna, brunoId, 'teste', AGORA)).resolves.toBe(false);
    await expect(exame(exameDaAna)).resolves.toMatchObject({ marcacao: null });
    await expect(historico()).resolves.toEqual([]);
  });

  it('não marca duas vezes o mesmo exame', async () => {
    await repository.marcarExame(exameDaAna, tablet.anaId, 'teste', AGORA);

    await expect(repository.marcarExame(exameDaAna, tablet.anaId, 'ensino', DEPOIS)).resolves.toBe(
      false,
    );
    await expect(exame(exameDaAna)).resolves.toMatchObject({
      marcacao: 'teste',
      marcado_em: AGORA,
    });
    await expect(historico()).resolves.toHaveLength(1);
  });

  it('ignora o exame excluído pela versão 11', async () => {
    await tablet.database.runAsync('UPDATE avaliacao SET excluido_em = ? WHERE id = ?', [
      AGORA,
      exameDaAna,
    ]);

    await expect(repository.buscarExame(exameDaAna, tablet.anaId)).resolves.toBeNull();
    await expect(repository.marcarExame(exameDaAna, tablet.anaId, 'teste', AGORA)).resolves.toBe(
      false,
    );
  });

  it('desfaz a marcação e registra quem desfez, mantendo o histórico', async () => {
    await repository.marcarExame(exameDaAna, tablet.anaId, 'teste', AGORA);

    await expect(repository.desmarcarExame(exameDaAna, tablet.anaId, DEPOIS)).resolves.toBe(true);

    await expect(exame(exameDaAna)).resolves.toMatchObject({
      marcacao: null,
      marcado_em: null,
      marcado_por: null,
    });
    await expect(historico()).resolves.toEqual([
      expect.objectContaining({ acao: 'marcar', tipo: 'teste' }),
      {
        id_avaliacao: exameDaAna,
        acao: 'desmarcar',
        tipo: null,
        id_profissional: tablet.anaId,
        data_hora: DEPOIS,
      },
    ]);
  });

  it('não desmarca o exame sem marcação nem o de outro médico', async () => {
    await expect(repository.desmarcarExame(exameDaAna, tablet.anaId, AGORA)).resolves.toBe(false);

    await repository.marcarExame(exameDaAna, tablet.anaId, 'teste', AGORA);
    await expect(repository.desmarcarExame(exameDaAna, brunoId, DEPOIS)).resolves.toBe(false);
    await expect(exame(exameDaAna)).resolves.toMatchObject({ marcacao: 'teste' });
  });
});

describe('regras da marcação nos gatilhos da versão 12 (#58)', () => {
  it('o histórico não pode ser alterado nem apagado', async () => {
    await repository.marcarExame(exameDaAna, tablet.anaId, 'teste', AGORA);

    await expect(tablet.database.runAsync("UPDATE marcacao SET tipo = 'ensino'")).rejects.toThrow(
      /nao pode ser alterado/,
    );
    await expect(tablet.database.runAsync('DELETE FROM marcacao')).rejects.toThrow(
      /nao pode ser apagado/,
    );
  });

  it('outro médico não marca o exame por fora do repositório', async () => {
    await expect(
      tablet.database.runAsync(
        "UPDATE avaliacao SET marcacao = 'teste', marcado_em = ?, marcado_por = ? WHERE id = ?",
        [AGORA, brunoId, exameDaAna],
      ),
    ).rejects.toThrow(/so quem aplicou/);
    await expect(
      tablet.database.runAsync(
        `INSERT INTO marcacao (id_avaliacao, acao, tipo, id_profissional, data_hora)
         VALUES (?, 'marcar', 'teste', ?, ?)`,
        [exameDaAna, brunoId, AGORA],
      ),
    ).rejects.toThrow(/so quem aplicou/);
  });

  it('o banco só aceita os dois tipos de marcação', async () => {
    await expect(
      tablet.database.runAsync(
        "UPDATE avaliacao SET marcacao = 'duplicado', marcado_por = ? WHERE id = ?",
        [tablet.anaId, exameDaAna],
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('o registro de marcar exige o tipo, e o de desmarcar não o aceita', async () => {
    await expect(
      tablet.database.runAsync(
        `INSERT INTO marcacao (id_avaliacao, acao, tipo, id_profissional, data_hora)
         VALUES (?, 'marcar', NULL, ?, ?)`,
        [exameDaAna, tablet.anaId, AGORA],
      ),
    ).rejects.toThrow(/CHECK/);
    await expect(
      tablet.database.runAsync(
        `INSERT INTO marcacao (id_avaliacao, acao, tipo, id_profissional, data_hora)
         VALUES (?, 'desmarcar', 'teste', ?, ?)`,
        [exameDaAna, tablet.anaId, AGORA],
      ),
    ).rejects.toThrow(/CHECK/);
  });
});
