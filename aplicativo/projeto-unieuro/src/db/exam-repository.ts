import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import type { TaskType } from '@/db/drawing-repository';

// Espelham os tipos de `features/home/exame.ts`, já que o banco, segundo a
// arquitetura, não importa a camada de aplicação, e a `composition.ts` confere que os dois batem.

export type ExamDrawingRecord = {
  tipo: TaskType;
  ordem: number;
  confirmadoEm: string;
  imagemPng: Uint8Array;
};

export type ExamRecord = {
  id: number;
  iniciadoEm: string;
  // Valor cru da coluna `avaliacao.estado`
  estado: string;
  pacienteNome: string;
  numeroFicha: string;
  profissionalNome: string;
  desenhos: ExamDrawingRecord[];
};

// Linhas como o SQLite devolve, com os nomes das colunas. O repositório converte
// para os tipos acima, que são os que a feature conhece.
type ExamRow = {
  id: number;
  data_hora_inicio: string;
  estado: string;
  paciente_nome: string;
  numero_ficha: string;
  profissional_nome: string;
};

type DrawingRow = {
  tipo: TaskType;
  ordem: number;
  data_hora_confirmacao: string;
  imagem_final: Uint8Array;
};

// Um médico não vê o exame que outro aplicou no mesmo tablet.
// Para o outro médico, o exame simplesmente não existe.

const FIND_EXAM = `SELECT a.id, a.data_hora_inicio, a.estado,
    p.nome AS paciente_nome, p.numero_ficha,
    pr.nome AS profissional_nome
  FROM avaliacao a
  JOIN paciente p ON p.id = a.id_paciente
  JOIN profissional pr ON pr.id = a.id_profissional
  WHERE a.id = ? AND a.id_profissional = ?
  LIMIT 1`;

// Consulta os desenhos das tarefas realizadas a partir de uma avaliação/exame
// Num exame interrompido, vêm só as que o paciente confirmou.
const LIST_DRAWINGS = `SELECT t.tipo, t.ordem, d.data_hora_confirmacao, d.imagem_final
  FROM tarefa t
  JOIN desenho d ON d.id_tarefa = t.id
  WHERE t.id_avaliacao = ?
  ORDER BY t.ordem`;

/** Leitura do exame salvo para ser utilizado na camada de aplicação "Ver exame"
 *  Não lê o CPF do paciente, que a tela não mostra.
 */
export function createExamRepository(open: () => Promise<SQLiteDatabase> = getDatabase) {
  return {
    async buscarExame(profissionalId: number, atendimentoId: number): Promise<ExamRecord | null> {
      const database = await open();
      const exame = await database.getFirstAsync<ExamRow>(FIND_EXAM, [
        atendimentoId,
        profissionalId,
      ]);
      if (!exame) return null;

      const desenhos = await database.getAllAsync<DrawingRow>(LIST_DRAWINGS, [exame.id]);
      return {
        id: exame.id,
        iniciadoEm: exame.data_hora_inicio,
        estado: exame.estado,
        pacienteNome: exame.paciente_nome,
        numeroFicha: exame.numero_ficha,
        profissionalNome: exame.profissional_nome,
        desenhos: desenhos.map((desenho) => ({
          tipo: desenho.tipo,
          ordem: desenho.ordem,
          confirmadoEm: desenho.data_hora_confirmacao,
          imagemPng: desenho.imagem_final,
        })),
      };
    },
  };
}

export type SqliteExamRepository = ReturnType<typeof createExamRepository>;

export const examRepository = createExamRepository();
