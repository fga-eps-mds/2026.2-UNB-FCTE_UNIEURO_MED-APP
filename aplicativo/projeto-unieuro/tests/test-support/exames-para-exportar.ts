import { createAttendanceRepository, type PatientRecord } from '@/db/attendance-repository';
import { createConsentRepository } from '@/db/consent-repository';
import { createDrawingRepository } from '@/db/drawing-repository';

import { BRUNO, cpfProtector, type TabletComAnaEBruno } from './tablet';

export const PNG_DO_RELOGIO = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

const paciente = (name: string, cpf: string, birthDate: string): PatientRecord => ({
  name,
  cpf,
  birthDate,
  schoolingYears: 5,
  sex: 'masculino',
});

/**
 * Exames do tablet de teste para a exportação (#22):
 *
 * - Ana atendeu José duas vezes: no primeiro exame ele aceitou o TCLE e desenhou o
 *   relógio; no segundo recusou o termo.
 * - Ana atendeu Antônio, que ainda não decidiu o termo.
 * - Bruno atendeu Maria, que aceitou o termo.
 */
export async function gravarExamesParaExportar(tablet: TabletComAnaEBruno) {
  const open = async () => tablet.database;
  const atendimentos = createAttendanceRepository(open, cpfProtector);
  const termos = createConsentRepository(open, cpfProtector);
  const desenhos = createDrawingRepository(open);
  const bruno = (await tablet.repository.findByEmail(BRUNO.email))!;

  const aceitar = (atendimentoId: number, decididoEm: string) =>
    termos.salvarDecisao({
      atendimentoId,
      versaoTermo: 'TCLE v1.0',
      quemAssina: 'paciente',
      aceito: true,
      assinaturaPng: new Uint8Array([1]),
      autorizaImagensPesquisa: true,
      autorizaDadosPesquisaFutura: false,
      decididoEm,
    });

  const primeiro = await atendimentos.createAttendance({
    patient: paciente('José Alves Martins', '12345678909', '1948-10-07'),
    professionalId: tablet.anaId,
    startedAt: '2026-10-06T12:00:00.000Z',
  });
  await aceitar(primeiro.attendanceId, '2026-10-06T12:02:00.000Z');
  await desenhos.salvarDesenho({
    atendimentoId: primeiro.attendanceId,
    ordem: 1,
    tipo: 'relogio',
    largura: 800,
    altura: 600,
    iniciadoEm: '2026-10-06T12:03:00.000Z',
    confirmadoEm: '2026-10-06T12:05:00.000Z',
    eventos: [
      { tipo: 'inicio', ordem: 1, instante: 0, x: 10, y: 20, ponteiro: 'caneta', pressao: 0.5 },
      { tipo: 'ponto', ordem: 2, instante: 16, x: 11, y: 21, ponteiro: 'caneta' },
      { tipo: 'desfazer', ordem: 3, instante: 900 },
    ],
    imagemPng: PNG_DO_RELOGIO,
  });

  const jose = (await atendimentos.findPatientByCpf('12345678909'))!;
  const segundo = await atendimentos.createAttendance({
    patient: jose,
    professionalId: tablet.anaId,
    startedAt: '2026-10-13T12:00:00.000Z',
  });
  await termos.salvarDecisao({
    atendimentoId: segundo.attendanceId,
    versaoTermo: 'TCLE v1.0',
    quemAssina: 'paciente',
    aceito: false,
    decididoEm: '2026-10-13T12:01:00.000Z',
  });

  await atendimentos.createAttendance({
    patient: paciente('Antônio Carlos Ferreira', '98765432100', '1950-01-20'),
    professionalId: tablet.anaId,
    startedAt: '2026-10-12T12:00:00.000Z',
  });
  const antonio = (await atendimentos.findPatientByCpf('98765432100'))!;

  const deBruno = await atendimentos.createAttendance({
    patient: paciente('Maria das Dores', '39053344705', '1945-05-05'),
    professionalId: bruno.id,
    startedAt: '2026-10-13T15:00:00.000Z',
  });
  await aceitar(deBruno.attendanceId, '2026-10-13T15:01:00.000Z');

  return { jose, antonio };
}
