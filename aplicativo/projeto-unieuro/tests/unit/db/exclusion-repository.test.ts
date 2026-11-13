import { createAttendanceRepository } from '@/db/attendance-repository';
import { createExclusionRepository } from '@/db/exclusion-repository';
import type { ExclusaoRepository } from '@/features/avaliacao/exclusao';

import {
  BRUNO,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const AGORA = '2026-11-12T18:00:00.000Z';

let tablet: TabletComAnaEBruno;
let brunoId: number;
let repository: ExclusaoRepository;
let pacienteId: number;

const atender = async (profissionalId: number, startedAt: string) =>
  (
    await createAttendanceRepository(async () => tablet.database, cpfProtector).createAttendance({
      patient: pacienteId
        ? { id: pacienteId }
        : {
            name: 'José Alves Martins',
            cpf: '52998224725',
            birthDate: '1948-03-14',
            schoolingYears: 5,
            sex: 'masculino',
          },
      professionalId: profissionalId,
      startedAt,
    })
  ).attendanceId;

const colocarEm = (atendimentoId: number, estado: string) =>
  tablet.database.runAsync('UPDATE avaliacao SET estado = ? WHERE id = ?', [estado, atendimentoId]);

const exame = (atendimentoId: number) =>
  tablet.database.getFirstAsync<{
    estado: string;
    excluido_em: string | null;
    excluido_por: number | null;
  }>('SELECT estado, excluido_em, excluido_por FROM avaliacao WHERE id = ?', [atendimentoId]);

const registros = () =>
  tablet.database.getAllAsync<Record<string, unknown>>(
    'SELECT tipo, id_paciente, id_avaliacao, id_profissional, data_hora FROM exclusao ORDER BY id',
  );

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  brunoId = (await tablet.repository.findByEmail(BRUNO.email))!.id;
  repository = createExclusionRepository(async () => tablet.database);
  pacienteId = 0;
  const primeiro = await atender(tablet.anaId, '2026-11-10T12:00:00.000Z');
  pacienteId = (await tablet.database.getFirstAsync<{ id_paciente: number }>(
    'SELECT id_paciente FROM avaliacao WHERE id = ?',
    [primeiro],
  ))!.id_paciente;
});

afterEach(async () => {
  await tablet.fechar();
});

describe('exclusão de exame no banco (#58)', () => {
  it('marca o exame com a data e o profissional e grava o registro, sem apagar nada', async () => {
    const id = await atender(tablet.anaId, '2026-11-11T12:00:00.000Z');
    await colocarEm(id, 'em_andamento');

    await expect(repository.excluirExame(id, tablet.anaId, AGORA)).resolves.toBe(true);

    expect(await exame(id)).toEqual({
      estado: 'em_andamento',
      excluido_em: AGORA,
      excluido_por: tablet.anaId,
    });
    expect(await registros()).toEqual([
      {
        tipo: 'exame',
        id_paciente: pacienteId,
        id_avaliacao: id,
        id_profissional: tablet.anaId,
        data_hora: AGORA,
      },
    ]);
    await expect(repository.buscarExame(id, tablet.anaId)).resolves.toBeNull();
  });

  it('não exclui exame de outro profissional nem exame já excluído', async () => {
    const id = await atender(tablet.anaId, '2026-11-11T12:00:00.000Z');

    await expect(repository.excluirExame(id, brunoId, AGORA)).resolves.toBe(false);
    await expect(repository.buscarExame(id, brunoId)).resolves.toBeNull();

    await repository.excluirExame(id, tablet.anaId, AGORA);
    await expect(repository.excluirExame(id, tablet.anaId, AGORA)).resolves.toBe(false);
    expect(await registros()).toHaveLength(1);
  });

  it('não exclui exame finalizado, e o banco recusa mesmo um UPDATE direto', async () => {
    const id = await atender(tablet.anaId, '2026-11-11T12:00:00.000Z');
    await colocarEm(id, 'concluida');

    await expect(repository.buscarExame(id, tablet.anaId)).resolves.toEqual({
      estado: 'concluida',
    });
    await expect(repository.excluirExame(id, tablet.anaId, AGORA)).resolves.toBe(false);
    await expect(
      tablet.database.runAsync('UPDATE avaliacao SET excluido_em = ? WHERE id = ?', [AGORA, id]),
    ).rejects.toThrow('exame finalizado nao pode ser excluido');
    await expect(
      tablet.database.runAsync('DELETE FROM avaliacao WHERE id = ?', [id]),
    ).rejects.toThrow('exame finalizado nao pode ser apagado');
    expect(await registros()).toEqual([]);
  });

  it('a exclusão não é desfeita, o exame excluído não muda de estado e o registro é fixo', async () => {
    const id = await atender(tablet.anaId, '2026-11-11T12:00:00.000Z');
    await repository.excluirExame(id, tablet.anaId, AGORA);

    await expect(
      tablet.database.runAsync('UPDATE avaliacao SET excluido_em = NULL WHERE id = ?', [id]),
    ).rejects.toThrow('exclusao do exame nao pode ser desfeita');
    await expect(colocarEm(id, 'em_andamento')).rejects.toThrow(
      'exame excluido nao muda de estado',
    );
    await expect(tablet.database.runAsync("UPDATE exclusao SET data_hora = 'x'")).rejects.toThrow(
      'registro de exclusao nao pode ser alterado',
    );
    await expect(tablet.database.runAsync('DELETE FROM exclusao')).rejects.toThrow(
      'registro de exclusao nao pode ser apagado',
    );
  });
});

describe('exclusão de paciente no banco (#47)', () => {
  it('resume os exames do profissional que ainda valem', async () => {
    const finalizado = await atender(tablet.anaId, '2026-11-11T12:00:00.000Z');
    await colocarEm(finalizado, 'concluida');
    await atender(brunoId, '2026-11-11T13:00:00.000Z');

    await expect(repository.resumirPaciente(pacienteId, tablet.anaId)).resolves.toEqual({
      exames: 2,
      finalizados: 1,
    });
    await expect(repository.resumirPaciente(pacienteId + 99, tablet.anaId)).resolves.toEqual({
      exames: 0,
      finalizados: 0,
    });
  });

  it('marca só os exames do profissional e grava um registro do paciente', async () => {
    const segundo = await atender(tablet.anaId, '2026-11-11T12:00:00.000Z');
    const deBruno = await atender(brunoId, '2026-11-11T13:00:00.000Z');

    await expect(repository.excluirPaciente(pacienteId, tablet.anaId, AGORA)).resolves.toBe(true);

    expect((await exame(segundo))?.excluido_em).toBe(AGORA);
    expect((await exame(deBruno))?.excluido_em).toBeNull();
    expect(await registros()).toEqual([
      {
        tipo: 'paciente',
        id_paciente: pacienteId,
        id_avaliacao: null,
        id_profissional: tablet.anaId,
        data_hora: AGORA,
      },
    ]);
    await expect(repository.resumirPaciente(pacienteId, tablet.anaId)).resolves.toEqual({
      exames: 0,
      finalizados: 0,
    });
  });

  it('não exclui paciente com exame finalizado nem paciente sem exame do profissional', async () => {
    const finalizado = await atender(tablet.anaId, '2026-11-11T12:00:00.000Z');
    await colocarEm(finalizado, 'erro_inferencia');

    await expect(repository.excluirPaciente(pacienteId, tablet.anaId, AGORA)).resolves.toBe(false);
    await expect(repository.excluirPaciente(pacienteId, brunoId, AGORA)).resolves.toBe(false);
    expect(await registros()).toEqual([]);
    expect(
      await tablet.database.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM avaliacao WHERE excluido_em IS NOT NULL',
      ),
    ).toEqual({ n: 0 });
  });
});
