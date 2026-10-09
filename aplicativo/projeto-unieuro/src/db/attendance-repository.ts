import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { CpfProtector } from '@/db/cpf-protection';
import { cpfProtector } from '@/db/cpf-runtime';
import { getDatabase } from '@/db/database';

/**
 * Paciente pronto para gravar. Espelha o `NewPatient` da regra do atendimento:
 * o banco não importa tipos da camada de aplicação, e a `composition.ts` da
 * feature confere, pelo tipo, que este repositório atende ao contrato dela.
 */
export type PatientRecord = {
  name: string;
  /** Só os 11 dígitos. O repositório grava a cifra e o índice, nunca o texto. */
  cpf: string;
  recordNumber: string;
  /** AAAA-MM-DD. */
  birthDate: string;
  schoolingYears: number;
  sex: 'feminino' | 'masculino' | null;
};

export type AttendanceRecord = {
  /** Paciente novo, ou o `id` de um paciente que já foi atendido. */
  patient: PatientRecord | { id: number };
  professionalId: number;
  /** Data e hora de início, em ISO 8601, pelo relógio do tablet. */
  startedAt: string;
};

const INSERT_PATIENT = `INSERT INTO paciente
  (nome, cpf_cifrado, cpf_indice, numero_ficha, data_nascimento, escolaridade_anos, sexo, criacao, last_update)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/** Paciente já cadastrado, pelo `id`, ou os valores do paciente novo a inserir. */
type PatientToSave = { id: number } | { params: SQLiteBindValue[] };

const isNewPatient = (patient: AttendanceRecord['patient']): patient is PatientRecord =>
  'cpf' in patient;

/**
 * Grava o paciente e o atendimento (tabelas `paciente` e `avaliacao`). Atende ao
 * `AttendanceRepository` da regra do atendimento (#7), ligado a ela pela
 * `features/avaliacao/composition.ts`.
 *
 * A conexão e o protetor de CPF são recebidos como parâmetro, como no
 * repositório do profissional, para que os testes usem banco real e chave fixa.
 * O CPF do paciente segue o padrão da #42: o banco guarda a cifra e o índice de
 * busca, e a busca pelo paciente que volta usa o índice.
 */
export function createAttendanceRepository(
  open: () => Promise<SQLiteDatabase> = getDatabase,
  protector: CpfProtector = cpfProtector,
) {
  const newPatientParams = async (
    patient: PatientRecord,
    savedAt: string,
  ): Promise<SQLiteBindValue[]> => {
    const [cpfCifrado, cpfIndice] = await Promise.all([
      protector.encrypt(patient.cpf),
      protector.blindIndex(patient.cpf),
    ]);
    return [
      patient.name,
      cpfCifrado,
      cpfIndice,
      patient.recordNumber,
      patient.birthDate,
      patient.schoolingYears,
      patient.sex,
      savedAt,
      savedAt,
    ];
  };

  return {
    async findPatientByCpf(cpf: string): Promise<{ id: number } | null> {
      const database = await open();
      const row = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM paciente WHERE cpf_indice = ? LIMIT 1',
        [await protector.blindIndex(cpf)],
      );
      return row ? { id: row.id } : null;
    },

    async createAttendance({
      patient,
      professionalId,
      startedAt,
    }: AttendanceRecord): Promise<{ attendanceId: number }> {
      const database = await open();

      // A cifra é calculada antes da transação, para que uma falha nela não
      // deixe a transação aberta à espera do Keystore.
      const patientToSave: PatientToSave = isNewPatient(patient)
        ? { params: await newPatientParams(patient, startedAt) }
        : { id: patient.id };

      let attendanceId = 0;

      // Paciente e atendimento entram juntos: se o atendimento falhar (por
      // exemplo, médico inexistente), o paciente novo também não fica gravado.
      await database.withTransactionAsync(async () => {
        const patientId =
          'id' in patientToSave
            ? patientToSave.id
            : (await database.runAsync(INSERT_PATIENT, patientToSave.params)).lastInsertRowId;

        const attendance = await database.runAsync(
          `INSERT INTO avaliacao (id_profissional, id_paciente, data_hora_inicio, last_update)
           VALUES (?, ?, ?, ?)`,
          [professionalId, patientId, startedAt, startedAt],
        );
        attendanceId = attendance.lastInsertRowId;
      });

      return { attendanceId };
    },
  };
}

export type SqliteAttendanceRepository = ReturnType<typeof createAttendanceRepository>;

export const attendanceRepository = createAttendanceRepository();
