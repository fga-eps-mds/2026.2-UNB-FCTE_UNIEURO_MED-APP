import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import type { ExportacaoRepository } from '@/features/exportacao/exportacao';
import type {
  EventoExportado,
  ExameExportado,
  PacienteExportado,
  TarefaExportada,
} from '@/features/exportacao/xml-exportacao';

type ExameRow = {
  id: number;
  data_hora_inicio: string;
  estado: string;
  paciente_id: number;
  data_nascimento: string;
  escolaridade_anos: number;
  sexo: 'feminino' | 'masculino' | null;
  versao_tcle: string | null;
  aceito: number | null;
  assinado_por: 'paciente' | 'responsavel_legal' | null;
  termo_data_hora: string | null;
  autoriza_imagens_pesquisa: number | null;
  autoriza_dados_pesquisa_futura: number | null;
  aplicado_por_nome: string;
  aplicado_por_crm: string;
  aplicado_por_uf: string;
  marcacao: 'teste' | 'ensino' | null;
  marcado_em: string | null;
  marcado_crm: string | null;
  marcado_uf: string | null;
};

type TarefaRow = {
  id: number;
  id_avaliacao: number;
  tipo: TarefaExportada['tipo'];
  ordem: number;
  largura: number;
  altura: number;
  data_hora_inicio: string;
  data_hora_termino: string | null;
  imagem_final: Uint8Array | null;
  data_hora_confirmacao: string | null;
};

type EventoRow = {
  id_tarefa: number;
  ordem: number;
  tipo: EventoExportado['tipo'];
  ponteiro: string | null;
  coord_x: number | null;
  coord_y: number | null;
  instante: number;
  pressao: number | null;
  inclinacao_x: number | null;
  inclinacao_y: number | null;
};

type Filtro = { sql: string; params: SQLiteBindValue[] };

// Os três SELECTs usam o mesmo filtro. Os exames excluídos (#47 e #58) continuam
// no tablet, mas não entram no arquivo, como já não entram nas listas. A marcação
// como teste ou material de ensino (#58) não esconde o exame: ele sai com a marcação.
const NAO_EXCLUIDO = 'a.excluido_em IS NULL';

// Só os exames do profissional e, se houver, só os do paciente e/ou do exame pedido.
// O exame é pedido pela tela de resultado (#22): o filtro do profissional continua
// valendo, então o exame de outro médico não sai, mesmo pedindo pelo número.
function doProfissional(profissionalId: number, pacienteId?: number, exameId?: number): Filtro {
  const condicoes = [NAO_EXCLUIDO, 'a.id_profissional = ?'];
  const params: SQLiteBindValue[] = [profissionalId];
  if (pacienteId !== undefined) {
    condicoes.push('a.id_paciente = ?');
    params.push(pacienteId);
  }
  if (exameId !== undefined) {
    condicoes.push('a.id = ?');
    params.push(exameId);
  }
  return { sql: condicoes.join(' AND '), params };
}

// Os exames de todos os profissionais (#138), com a mesma trava das consultas de
// todos (#129): para quem não é superusuário ativo, nenhuma linha, por qualquer
// caminho do código.
const deTodos = (solicitanteId: number): Filtro => ({
  sql: `${NAO_EXCLUIDO} AND EXISTS (SELECT 1 FROM profissional s
    WHERE s.id = ? AND s.perfil = 'superusuario' AND s.ativo = 1)`,
  params: [solicitanteId],
});

const SELECT_EXAMES = `SELECT a.id, a.data_hora_inicio, a.estado,
    p.id AS paciente_id, p.data_nascimento, p.escolaridade_anos, p.sexo,
    c.versao_tcle, c.aceito, c.assinado_por, c.data_hora AS termo_data_hora,
    c.autoriza_imagens_pesquisa, c.autoriza_dados_pesquisa_futura,
    ap.nome AS aplicado_por_nome, ap.crm_numero AS aplicado_por_crm,
    ap.uf_crm AS aplicado_por_uf,
    a.marcacao, a.marcado_em, mp.crm_numero AS marcado_crm, mp.uf_crm AS marcado_uf
  FROM avaliacao a
  JOIN paciente p ON p.id = a.id_paciente
  JOIN profissional ap ON ap.id = a.id_profissional
  LEFT JOIN consentimento c ON c.id_avaliacao = a.id
  LEFT JOIN profissional mp ON mp.id = a.marcado_por`;

const SELECT_TAREFAS = `SELECT t.id, t.id_avaliacao, t.tipo, t.ordem, t.largura, t.altura,
    t.data_hora_inicio, t.data_hora_termino, d.imagem_final, d.data_hora_confirmacao
  FROM tarefa t
  JOIN avaliacao a ON a.id = t.id_avaliacao
  LEFT JOIN desenho d ON d.id_tarefa = t.id`;

const SELECT_EVENTOS = `SELECT e.id_tarefa, e.ordem, e.tipo, e.ponteiro, e.coord_x, e.coord_y,
    e.instante, e.pressao, e.inclinacao_x, e.inclinacao_y
  FROM evento_tracado e
  JOIN tarefa t ON t.id = e.id_tarefa
  JOIN avaliacao a ON a.id = t.id_avaliacao`;

const booleano = (valor: number | null) => (valor === null ? null : valor === 1);

function agrupar<T, K>(itens: readonly T[], chave: (item: T) => K): Map<K, T[]> {
  const grupos = new Map<K, T[]>();
  for (const item of itens) {
    const grupo = grupos.get(chave(item));
    if (grupo) grupo.push(item);
    else grupos.set(chave(item), [item]);
  }
  return grupos;
}

const paraEvento = (row: EventoRow): EventoExportado => ({
  ordem: row.ordem,
  tipo: row.tipo,
  ponteiro: row.ponteiro,
  x: row.coord_x,
  y: row.coord_y,
  instante: row.instante,
  pressao: row.pressao,
  inclinacaoX: row.inclinacao_x,
  inclinacaoY: row.inclinacao_y,
});

function paraExame(
  row: ExameRow,
  tarefas: TarefaExportada[],
  comQuemAplicou: boolean,
): ExameExportado {
  return {
    id: row.id,
    aplicadoPor: comQuemAplicou
      ? { nome: row.aplicado_por_nome, crm: row.aplicado_por_crm, uf: row.aplicado_por_uf }
      : undefined,
    inicio: row.data_hora_inicio,
    estado: row.estado,
    termo:
      row.versao_tcle === null
        ? null
        : {
            versao: row.versao_tcle,
            aceito: row.aceito === 1,
            assinadoPor: row.assinado_por!,
            dataHora: row.termo_data_hora!,
            autorizaImagens: booleano(row.autoriza_imagens_pesquisa),
            autorizaPesquisaFutura: booleano(row.autoriza_dados_pesquisa_futura),
          },
    marcacao:
      row.marcacao === null
        ? null
        : {
            tipo: row.marcacao,
            marcadaEm: row.marcado_em!,
            crmNumero: row.marcado_crm!,
            crmUf: row.marcado_uf!,
          },
    tarefas,
  };
}

/**
 * Leitura dos exames para o XML (#22). Não lê nome, CPF nem ficha do paciente:
 * o arquivo identifica o paciente pelo `id` interno. A ordem é a do cadastro do
 * paciente e, dentro dele, a do início do exame. Na leitura de todos os
 * profissionais (#138), cada exame traz quem o aplicou.
 */
export function createExportRepository(
  open: () => Promise<SQLiteDatabase> = getDatabase,
): ExportacaoRepository {
  async function ler(
    { sql, params: valores }: Filtro,
    comQuemAplicou: boolean,
  ): Promise<PacienteExportado[]> {
    const database = await open();

    const exames = await database.getAllAsync<ExameRow>(
      `${SELECT_EXAMES} WHERE ${sql} ORDER BY p.id, a.data_hora_inicio, a.id`,
      valores,
    );
    const tarefas = await database.getAllAsync<TarefaRow>(
      `${SELECT_TAREFAS} WHERE ${sql} ORDER BY t.id_avaliacao, t.ordem`,
      valores,
    );
    const eventos = await database.getAllAsync<EventoRow>(
      `${SELECT_EVENTOS} WHERE ${sql} ORDER BY e.id_tarefa, e.ordem`,
      valores,
    );

    const eventosPorTarefa = agrupar(eventos, (evento) => evento.id_tarefa);
    const tarefasPorExame = agrupar(
      tarefas.map((row) => ({
        exame: row.id_avaliacao,
        tarefa: {
          ordem: row.ordem,
          tipo: row.tipo,
          largura: row.largura,
          altura: row.altura,
          inicio: row.data_hora_inicio,
          termino: row.data_hora_termino,
          desenho:
            row.imagem_final === null
              ? null
              : { confirmadoEm: row.data_hora_confirmacao!, png: row.imagem_final },
          eventos: (eventosPorTarefa.get(row.id) ?? []).map(paraEvento),
        } satisfies TarefaExportada,
      })),
      (item) => item.exame,
    );

    const pacientes: PacienteExportado[] = [];
    for (const [, linhas] of agrupar(exames, (row) => row.paciente_id)) {
      const [primeira] = linhas;
      pacientes.push({
        id: primeira.paciente_id,
        dataNascimento: primeira.data_nascimento,
        escolaridadeAnos: primeira.escolaridade_anos,
        sexo: primeira.sexo,
        exames: linhas.map((row) =>
          paraExame(
            row,
            (tarefasPorExame.get(row.id) ?? []).map((item) => item.tarefa),
            comQuemAplicou,
          ),
        ),
      });
    }
    return pacientes;
  }

  return {
    lerExames: (profissionalId, pacienteId, exameId) =>
      ler(doProfissional(profissionalId, pacienteId, exameId), false),
    lerExamesDeTodos: (solicitanteId) => ler(deTodos(solicitanteId), true),
  };
}

export const exportRepository = createExportRepository();
