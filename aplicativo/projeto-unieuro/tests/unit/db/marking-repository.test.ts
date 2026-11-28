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
const CPF_PACIENTE = '52998224725';

let tablet: TabletComAnaEBruno;
let brunoId: number;
let repository: MarcacaoRepository;
let exameDaAna: number;

const atender = async (profissionalId: number, pacienteExistenteId?: number) =>
  (
    await createAttendanceRepository(async () => tablet.database, cpfProtector).createAttendance({
      patient:
        pacienteExistenteId === undefined
          ? {
              name: 'José Alves Martins',
              cpf: CPF_PACIENTE,
              birthDate: '1948-03-14',
              schoolingYears: 5,
              sex: 'masculino',
            }
          : { id: pacienteExistenteId },
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

describe('marcação do paciente no banco (#47)', () => {
  let joseId: number;
  let segundoExameDaAna: number;
  let exameDoBruno: number;

  beforeEach(async () => {
    const attendances = createAttendanceRepository(async () => tablet.database, cpfProtector);
    joseId = (await attendances.findPatientByCpf(CPF_PACIENTE))!.id;
    segundoExameDaAna = await atender(tablet.anaId, joseId);
    exameDoBruno = await atender(brunoId, joseId);
    await tablet.database.runAsync("UPDATE avaliacao SET estado = 'concluida' WHERE id = ?", [
      exameDaAna,
    ]);
  });

  it('marca todos os exames que a médica aplicou no paciente, sem tocar nos de outro médico', async () => {
    await expect(repository.buscarPaciente(joseId, tablet.anaId)).resolves.toEqual({
      marcacoes: [null, null],
    });

    await expect(repository.marcarPaciente(joseId, tablet.anaId, 'ensino', AGORA)).resolves.toBe(
      true,
    );

    await expect(exame(exameDaAna)).resolves.toEqual({
      estado: 'concluida',
      marcacao: 'ensino',
      marcado_em: AGORA,
      marcado_por: tablet.anaId,
    });
    await expect(exame(segundoExameDaAna)).resolves.toEqual({
      estado: 'aguardando_consentimento',
      marcacao: 'ensino',
      marcado_em: AGORA,
      marcado_por: tablet.anaId,
    });
    // O exame do Bruno no mesmo paciente continua sem marcação.
    await expect(exame(exameDoBruno)).resolves.toMatchObject({
      marcacao: null,
      marcado_em: null,
      marcado_por: null,
    });
    await expect(historico()).resolves.toEqual([
      {
        id_avaliacao: exameDaAna,
        acao: 'marcar',
        tipo: 'ensino',
        id_profissional: tablet.anaId,
        data_hora: AGORA,
      },
      {
        id_avaliacao: segundoExameDaAna,
        acao: 'marcar',
        tipo: 'ensino',
        id_profissional: tablet.anaId,
        data_hora: AGORA,
      },
    ]);
  });

  it('marca só os exames sem marcação e não sobrescreve os que já tinham outra', async () => {
    await repository.marcarExame(exameDaAna, tablet.anaId, 'ensino', AGORA);

    await expect(repository.marcarPaciente(joseId, tablet.anaId, 'teste', DEPOIS)).resolves.toBe(
      true,
    );

    // O exame já marcado como ensino continua assim, com a data e o histórico de antes.
    await expect(exame(exameDaAna)).resolves.toMatchObject({
      marcacao: 'ensino',
      marcado_em: AGORA,
    });
    await expect(exame(segundoExameDaAna)).resolves.toMatchObject({
      marcacao: 'teste',
      marcado_em: DEPOIS,
    });
    await expect(historico()).resolves.toEqual([
      expect.objectContaining({ id_avaliacao: exameDaAna, acao: 'marcar', tipo: 'ensino' }),
      expect.objectContaining({ id_avaliacao: segundoExameDaAna, acao: 'marcar', tipo: 'teste' }),
    ]);
  });

  it('não marca nada quando todos os exames do médico já têm marcação, mesmo de outro tipo', async () => {
    await repository.marcarPaciente(joseId, tablet.anaId, 'ensino', AGORA);

    await expect(repository.marcarPaciente(joseId, tablet.anaId, 'teste', DEPOIS)).resolves.toBe(
      false,
    );
    await expect(exame(exameDaAna)).resolves.toMatchObject({ marcacao: 'ensino' });
    await expect(historico()).resolves.toHaveLength(2);
  });

  it('não marca de novo quando todos os exames do médico já têm a mesma marcação', async () => {
    await repository.marcarPaciente(joseId, tablet.anaId, 'teste', AGORA);

    await expect(repository.marcarPaciente(joseId, tablet.anaId, 'teste', DEPOIS)).resolves.toBe(
      false,
    );
    await expect(historico()).resolves.toHaveLength(2);
  });

  it('ignora exames excluídos pela versão 11 ao buscar e marcar o paciente', async () => {
    await tablet.database.runAsync('UPDATE avaliacao SET excluido_em = ? WHERE id = ?', [
      AGORA,
      segundoExameDaAna,
    ]);

    await expect(repository.buscarPaciente(joseId, tablet.anaId)).resolves.toEqual({
      marcacoes: [null],
    });
    await expect(repository.marcarPaciente(joseId, tablet.anaId, 'teste', AGORA)).resolves.toBe(
      true,
    );

    await expect(exame(exameDaAna)).resolves.toMatchObject({ marcacao: 'teste' });
    await expect(exame(segundoExameDaAna)).resolves.toMatchObject({ marcacao: null });
    await expect(historico()).resolves.toHaveLength(1);
  });

  it('não encontra nem marca paciente atendido só por outro médico', async () => {
    const outroAtendimento = (
      await createAttendanceRepository(async () => tablet.database, cpfProtector).createAttendance({
        patient: {
          name: 'Maria das Dores',
          cpf: '11144477735',
          birthDate: '1952-07-01',
          schoolingYears: 4,
          sex: 'feminino',
        },
        professionalId: brunoId,
        startedAt: '2026-11-20T14:00:00.000Z',
      })
    ).attendanceId;
    const mariaId = (await tablet.database.getFirstAsync<{ id_paciente: number }>(
      'SELECT id_paciente FROM avaliacao WHERE id = ?',
      [outroAtendimento],
    ))!.id_paciente;

    await expect(repository.buscarPaciente(mariaId, tablet.anaId)).resolves.toBeNull();
    await expect(repository.marcarPaciente(mariaId, tablet.anaId, 'teste', AGORA)).resolves.toBe(
      false,
    );
  });

  it('desfaz a marcação dos exames do médico no paciente e mantém o histórico', async () => {
    await repository.marcarPaciente(joseId, tablet.anaId, 'teste', AGORA);
    await repository.marcarExame(exameDoBruno, brunoId, 'ensino', AGORA);

    await expect(repository.desmarcarPaciente(joseId, tablet.anaId, DEPOIS)).resolves.toBe(true);

    await expect(exame(exameDaAna)).resolves.toMatchObject({ marcacao: null, marcado_por: null });
    await expect(exame(segundoExameDaAna)).resolves.toMatchObject({
      marcacao: null,
      marcado_por: null,
    });
    // Marcação do Bruno continua intacta.
    await expect(exame(exameDoBruno)).resolves.toMatchObject({ marcacao: 'ensino' });
    await expect(repository.desmarcarPaciente(joseId, tablet.anaId, DEPOIS)).resolves.toBe(false);
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
      // Sem o registro do histórico, o gatilho do histórico recusa antes do de quem aplicou.
    ).rejects.toThrow(/so quem aplicou|sem registro no historico/);
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
        `INSERT INTO marcacao (id_avaliacao, acao, tipo, id_profissional, data_hora)
         VALUES (?, 'marcar', 'duplicado', ?, ?)`,
        [exameDaAna, tablet.anaId, AGORA],
      ),
    ).rejects.toThrow(/CHECK/);
    await expect(
      tablet.database.runAsync(
        "UPDATE avaliacao SET marcacao = 'duplicado', marcado_por = ? WHERE id = ?",
        [tablet.anaId, exameDaAna],
      ),
    ).rejects.toThrow(/CHECK|sem registro no historico/);
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

  it('a marcação não muda por fora sem um registro no histórico', async () => {
    const porFora = (marcacao: string | null, em: string | null, por: number | null) =>
      tablet.database.runAsync(
        'UPDATE avaliacao SET marcacao = ?, marcado_em = ?, marcado_por = ? WHERE id = ?',
        [marcacao, em, por, exameDaAna],
      );

    // Marcar sem registro.
    await expect(porFora('teste', AGORA, tablet.anaId)).rejects.toThrow(
      /sem registro no historico/,
    );

    // Trocar o tipo ou desmarcar sem registro, depois de uma marcação feita pelo repositório.
    await repository.marcarExame(exameDaAna, tablet.anaId, 'teste', AGORA);
    await expect(porFora('ensino', AGORA, tablet.anaId)).rejects.toThrow(
      /sem registro no historico/,
    );
    await expect(porFora(null, null, null)).rejects.toThrow(/sem registro no historico/);
    await expect(exame(exameDaAna)).resolves.toMatchObject({ marcacao: 'teste' });
  });

  it('aceita a mudança por fora quando o registro do histórico vem antes', async () => {
    await tablet.database.runAsync(
      `INSERT INTO marcacao (id_avaliacao, acao, tipo, id_profissional, data_hora)
       VALUES (?, 'marcar', 'ensino', ?, ?)`,
      [exameDaAna, tablet.anaId, DEPOIS],
    );

    await tablet.database.runAsync(
      'UPDATE avaliacao SET marcacao = ?, marcado_em = ?, marcado_por = ? WHERE id = ?',
      ['ensino', DEPOIS, tablet.anaId, exameDaAna],
    );

    await expect(exame(exameDaAna)).resolves.toMatchObject({ marcacao: 'ensino' });
  });

  it('o histórico tem índice pelo exame, para a exportação consultar', async () => {
    await expect(
      tablet.database.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_marcacao_avaliacao'",
      ),
    ).resolves.toEqual({ name: 'idx_marcacao_avaliacao' });
  });
});
