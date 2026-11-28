import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import type { TaskType } from '@/db/drawing-repository';

/**
 * Exame com os desenhos gravados, para a tela de resultado (#14). O escore e o que
 * influenciou o resultado ainda não ficam no banco (#12 e #13): por enquanto, o
 * exame vem com o cabeçalho e os três desenhos.
 */
export type ExamResultRecord = {
  id: number;
  professionalId: number;
  startedAt: string;
  state: string;
  patientName: string;
  recordNumber: string;
  appliedBy: string;
  drawings: { tipo: TaskType; ordem: number; imagemPng: Uint8Array }[];
};

type ExamRow = {
  id: number;
  id_profissional: number;
  data_hora_inicio: string;
  estado: string;
  nome_paciente: string;
  numero_ficha: string;
  aplicado_por: string;
};

type DrawingRow = { tipo: TaskType; ordem: number; imagem_final: Uint8Array };

// O médico vê só o exame que ele aplicou. O superusuário com a conta ativa vê o de
// qualquer médico, como na tela do paciente (#49). A trava fica na consulta, e não só
// na tela: para qualquer outro profissional ela não devolve linha nenhuma.
const FIND_EXAM = `SELECT a.id, a.id_profissional, a.data_hora_inicio, a.estado, p.nome AS nome_paciente,
    p.numero_ficha, m.nome AS aplicado_por
  FROM avaliacao a
  JOIN paciente p ON p.id = a.id_paciente
  JOIN profissional m ON m.id = a.id_profissional
  WHERE a.id = ?
    AND (a.id_profissional = ?
      OR EXISTS (SELECT 1 FROM profissional s
        WHERE s.id = ? AND s.perfil = 'superusuario' AND s.ativo = 1))`;

const LIST_DRAWINGS = `SELECT t.tipo, t.ordem, d.imagem_final
  FROM tarefa t
  JOIN desenho d ON d.id_tarefa = t.id
  WHERE t.id_avaliacao = ?
  ORDER BY t.ordem`;

export function createExamResultRepository(open: () => Promise<SQLiteDatabase> = getDatabase) {
  return {
    /** Devolve `null` se o exame não existe ou se quem pede não pode vê-lo. */
    async findExamResult(requesterId: number, examId: number): Promise<ExamResultRecord | null> {
      const database = await open();
      const exam = await database.getFirstAsync<ExamRow>(FIND_EXAM, [
        examId,
        requesterId,
        requesterId,
      ]);
      if (!exam) return null;

      const drawings = await database.getAllAsync<DrawingRow>(LIST_DRAWINGS, [examId]);
      return {
        id: exam.id,
        professionalId: exam.id_profissional,
        startedAt: exam.data_hora_inicio,
        state: exam.estado,
        patientName: exam.nome_paciente,
        recordNumber: exam.numero_ficha,
        appliedBy: exam.aplicado_por,
        drawings: drawings.map((drawing) => ({
          tipo: drawing.tipo,
          ordem: drawing.ordem,
          imagemPng: drawing.imagem_final,
        })),
      };
    },
  };
}

export type SqliteExamResultRepository = ReturnType<typeof createExamResultRepository>;

export const examResultRepository = createExamResultRepository();
