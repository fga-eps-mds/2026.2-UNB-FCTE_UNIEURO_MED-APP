import { createAttendanceRepository } from '@/db/attendance-repository';
import { createExclusionRepository } from '@/db/exclusion-repository';
import { createInterruptionRepository } from '@/db/interruption-repository';
import type { SessionProfessional } from '@/features/auth/session';
import {
  PACIENTE_COM_EXAME_FINALIZADO,
  PACIENTE_NAO_ENCONTRADO,
  EXAME_NAO_ENCONTRADO,
  SENHA_NAO_CONFERE,
  excluirExame,
  excluirPaciente,
} from '@/features/avaliacao/exclusao';

import {
  ANA,
  BRUNO,
  SENHA_DE_TESTE,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

// Exclusão de exame (#58) e de paciente (#47) de ponta a ponta: a regra, a senha
// conferida como no login e o SQLite de verdade. A tela entra com a do paciente (#59).

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let tablet: TabletComAnaEBruno;
let ana: SessionProfessional;
let bruno: SessionProfessional;
let atendimentos: ReturnType<typeof createAttendanceRepository>;
let pacienteId: number;
let exameId: number;

const sessao = async (email: string): Promise<SessionProfessional> => {
  const salvo = (await tablet.repository.findByEmail(email))!;
  return {
    id: salvo.id,
    name: salvo.name,
    email: salvo.email,
    crmNumber: salvo.crmNumber,
    crmState: salvo.crmState,
  };
};

const exclusoes = () => createExclusionRepository(async () => tablet.database);
const pacientesDe = (profissional: SessionProfessional) =>
  atendimentos.listAttendedPatients(profissional.id);
const registros = () =>
  tablet.database.getAllAsync<{ tipo: string; id_profissional: number; data_hora: string }>(
    'SELECT tipo, id_profissional, data_hora FROM exclusao',
  );
const finalizar = (id: number) =>
  tablet.database.runAsync("UPDATE avaliacao SET estado = 'concluida' WHERE id = ?", [id]);

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  ana = await sessao(ANA.email);
  bruno = await sessao(BRUNO.email);
  atendimentos = createAttendanceRepository(async () => tablet.database, cpfProtector);
  ({ attendanceId: exameId } = await atendimentos.createAttendance({
    patient: {
      name: 'José Alves Martins',
      cpf: '52998224725',
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'masculino',
    },
    professionalId: ana.id,
    startedAt: '2026-11-12T12:00:00.000Z',
  }));
  pacienteId = (await atendimentos.findPatientByCpf('52998224725'))!.id;
});

afterEach(async () => {
  await tablet.fechar();
});

describe('excluir um exame em andamento (#58)', () => {
  it('exclusão de exame em andamento: sai da lista e fica registrada', async () => {
    const segundo = (
      await atendimentos.createAttendance({
        patient: { id: pacienteId },
        professionalId: ana.id,
        startedAt: '2026-11-12T13:00:00.000Z',
      })
    ).attendanceId;

    await expect(
      excluirExame(
        { atendimentoId: segundo, profissional: ana, senha: SENHA_DE_TESTE },
        exclusoes(),
        tablet.repository,
      ),
    ).resolves.toEqual({ excluido: true });

    expect((await pacientesDe(ana))[0].attendanceCount).toBe(1);
    expect(await registros()).toEqual([
      { tipo: 'exame', id_profissional: ana.id, data_hora: expect.any(String) },
    ]);
  });

  it('senha incorreta: informa que a senha não confere e nada é apagado', async () => {
    await expect(
      excluirExame(
        { atendimentoId: exameId, profissional: ana, senha: 'errada' },
        exclusoes(),
        tablet.repository,
      ),
    ).resolves.toEqual({ excluido: false, mensagem: SENHA_NAO_CONFERE });

    expect((await pacientesDe(ana))[0].attendanceCount).toBe(1);
    expect(await registros()).toEqual([]);
  });

  it('exame de outro médico: não pode ser excluído por ele', async () => {
    await expect(
      excluirExame(
        { atendimentoId: exameId, profissional: bruno, senha: SENHA_DE_TESTE },
        exclusoes(),
        tablet.repository,
      ),
    ).resolves.toEqual({ excluido: false, mensagem: EXAME_NAO_ENCONTRADO });
  });
});

describe('excluir um paciente com confirmação (#47)', () => {
  it('paciente sem exame finalizado: sai da lista e a exclusão fica registrada', async () => {
    await expect(
      excluirPaciente(
        { pacienteId, profissional: ana, senha: SENHA_DE_TESTE },
        exclusoes(),
        tablet.repository,
      ),
    ).resolves.toEqual({ excluido: true });

    expect(await pacientesDe(ana)).toEqual([]);
    expect(await registros()).toEqual([
      { tipo: 'paciente', id_profissional: ana.id, data_hora: expect.any(String) },
    ]);
  });

  it('paciente com exame finalizado: a exclusão não é permitida e nada é apagado', async () => {
    await finalizar(exameId);

    await expect(
      excluirPaciente(
        { pacienteId, profissional: ana, senha: SENHA_DE_TESTE },
        exclusoes(),
        tablet.repository,
      ),
    ).resolves.toEqual({ excluido: false, mensagem: PACIENTE_COM_EXAME_FINALIZADO });

    expect(await pacientesDe(ana)).toHaveLength(1);
    expect(await registros()).toEqual([]);
  });

  it('senha incorreta: informa que a senha não confere e nada é apagado', async () => {
    await expect(
      excluirPaciente(
        { pacienteId, profissional: ana, senha: 'errada' },
        exclusoes(),
        tablet.repository,
      ),
    ).resolves.toEqual({ excluido: false, mensagem: SENHA_NAO_CONFERE });

    expect(await pacientesDe(ana)).toHaveLength(1);
  });

  it('paciente de outro médico: não aparece para ele e não pode ser excluído por ele', async () => {
    expect(await pacientesDe(bruno)).toEqual([]);

    await expect(
      excluirPaciente(
        { pacienteId, profissional: bruno, senha: SENHA_DE_TESTE },
        exclusoes(),
        tablet.repository,
      ),
    ).resolves.toEqual({ excluido: false, mensagem: PACIENTE_NAO_ENCONTRADO });
    expect(await pacientesDe(ana)).toHaveLength(1);
  });

  it('a exclusão por um médico não tira o paciente da lista de outro que também o atendeu', async () => {
    await atendimentos.createAttendance({
      patient: { id: pacienteId },
      professionalId: bruno.id,
      startedAt: '2026-11-12T14:00:00.000Z',
    });

    await excluirPaciente(
      { pacienteId, profissional: ana, senha: SENHA_DE_TESTE },
      exclusoes(),
      tablet.repository,
    );

    expect(await pacientesDe(ana)).toEqual([]);
    expect(await pacientesDe(bruno)).toHaveLength(1);
  });
});

describe('o exame excluído sai das outras consultas', () => {
  const excluir = (atendimentoId: number) =>
    excluirExame(
      { atendimentoId, profissional: ana, senha: SENHA_DE_TESTE },
      exclusoes(),
      tablet.repository,
    );
  const colocarEm = (id: number, estado: string) =>
    tablet.database.runAsync('UPDATE avaliacao SET estado = ? WHERE id = ?', [estado, id]);

  async function segundoExame() {
    return (
      await atendimentos.createAttendance({
        patient: { id: pacienteId },
        professionalId: ana.id,
        startedAt: '2026-11-12T13:00:00.000Z',
      })
    ).attendanceId;
  }

  async function criarSuperusuario() {
    await tablet.repository.insertSuperuser(
      {
        name: 'Carlos Bernardo Tauil',
        email: 'tauil@unieuro.com.br',
        crmNumber: '12771',
        crmState: 'DF',
        cpf: '39053344705',
        passwordHash: 'hash-da-senha',
        createdAt: '2026-11-12T10:00:00.000Z',
      },
      null,
    );
    return (await tablet.repository.findByEmail('tauil@unieuro.com.br'))!.id;
  }

  it('a tela do paciente não mostra o exame excluído (#59)', async () => {
    const segundo = await segundoExame();
    await excluir(segundo);

    const paciente = await atendimentos.findPatientWithExams(ana.id, pacienteId);

    expect(paciente?.exams.map((exame) => exame.id)).toEqual([exameId]);
  });

  it('o paciente só com exames excluídos não abre para o médico (#59)', async () => {
    await excluir(exameId);

    await expect(atendimentos.findPatientWithExams(ana.id, pacienteId)).resolves.toBeNull();
  });

  it('as consultas do superusuário também ignoram o exame excluído (#49)', async () => {
    const superusuario = await criarSuperusuario();
    const segundo = await segundoExame();
    await excluir(segundo);

    const [paciente] = await atendimentos.listAllAttendedPatients(superusuario);
    const detalhe = await atendimentos.findAnyPatientWithExams(superusuario, pacienteId);

    expect(paciente).toMatchObject({
      attendanceCount: 1,
      lastStartedAt: '2026-11-12T12:00:00.000Z',
    });
    expect(detalhe?.exams.map((exame) => exame.id)).toEqual([exameId]);
  });

  it('o paciente só com exames excluídos sai das listas e da busca do superusuário (#49)', async () => {
    const superusuario = await criarSuperusuario();
    await excluir(exameId);

    await expect(atendimentos.listAllAttendedPatients(superusuario)).resolves.toEqual([]);
    await expect(atendimentos.listAllAttendedPatientCpfs(superusuario)).resolves.toEqual([]);
    await expect(
      atendimentos.findAnyPatientWithExams(superusuario, pacienteId),
    ).resolves.toBeNull();
  });

  it('não se desiste de um exame excluído (#25)', async () => {
    await colocarEm(exameId, 'em_andamento');
    await excluir(exameId);

    await expect(
      createInterruptionRepository(async () => tablet.database).interromper({
        atendimentoId: exameId,
        profissionalId: ana.id,
        tarefa: 1,
        motivo: null,
        interrompidoEm: '2026-11-12T12:05:00.000Z',
      }),
    ).resolves.toBe(false);
  });

  it('o exame interrompido e excluído não abre nem é retomado (#25)', async () => {
    await colocarEm(exameId, 'interrompida');
    await excluir(exameId);
    const interrupcoes = createInterruptionRepository(async () => tablet.database);

    await expect(interrupcoes.buscarInterrompido(exameId, ana.id)).resolves.toBeNull();
    await expect(interrupcoes.retomar(exameId, ana.id, '2026-11-12T12:10:00.000Z')).resolves.toBe(
      false,
    );
  });
});
