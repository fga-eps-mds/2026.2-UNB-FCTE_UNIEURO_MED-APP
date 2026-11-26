import type { SessionProfessional } from '@/features/auth/session';
import {
  gerarXmlDeExportacao,
  type CabecalhoExportacao,
  type PacienteExportado,
} from '@/features/exportacao/xml-exportacao';

export type ExportacaoRepository = {
  /** Pacientes e exames que o profissional aplicou; filtra por paciente e/ou exame se informado. */
  lerExames(
    profissionalId: number,
    pacienteId?: number,
    exameId?: number,
  ): Promise<PacienteExportado[]>;
  /**
   * Pacientes e exames de todos os profissionais do tablet, com quem aplicou cada
   * exame (#138). Só responde ao superusuário ativo; para outro, vem vazio.
   */
  lerExamesDeTodos(solicitanteId: number): Promise<PacienteExportado[]>;
};

/** Grava o arquivo onde o profissional escolher. `false` quando ele desiste. */
export type SalvarArquivo = (nome: string, conteudo: string) => Promise<boolean>;

export type PedidoDeExportacao = {
  profissional: SessionProfessional;
  /**
   * Sem paciente nem exame, exporta todos os que o profissional atendeu; para o
   * responsável pela pesquisa (superusuário), a coleta inteira do tablet (#49 e #138).
   */
  pacienteId?: number;
  /** Quando informado, exporta só este exame (tem precedência sobre `pacienteId` e sobre a coleta). */
  exameId?: number;
  agora: Date;
  versaoAplicativo: string;
};

export type ResultadoExportacao =
  | { estado: 'salvo'; arquivo: string; pacientes: number; exames: number }
  | { estado: 'cancelado' }
  | { estado: 'vazio' };

const doisDigitos = (n: number) => String(n).padStart(2, '0');

export type EscopoDaExportacao = CabecalhoExportacao['escopo'];

/**
 * O exame específico vence o paciente. Sem nenhum dos dois, o responsável pela
 * pesquisa exporta a coleta inteira e o médico comum, todos os exames dele.
 */
function escopoDoPedido(
  profissional: SessionProfessional,
  pacienteId?: number,
  exameId?: number,
): EscopoDaExportacao {
  if (exameId !== undefined) return 'exame';
  if (pacienteId !== undefined) return 'paciente';
  return profissional.superuser === true ? 'coleta' : 'todos';
}

/**
 * Nome com data e hora locais, como `exames_2026-11-12_1430.xml`. A exportação de um
 * exame leva o número dele (`exame_7_2026-11-12_1430.xml`), para dois exames salvos
 * no mesmo minuto na mesma pasta não terem o mesmo nome.
 */
export function nomeDoArquivo(agora: Date, escopo: EscopoDaExportacao, exameId?: number): string {
  const data = `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
  const hora = `${doisDigitos(agora.getHours())}${doisDigitos(agora.getMinutes())}`;
  const prefixos: Record<EscopoDaExportacao, string> = {
    todos: 'exames',
    paciente: 'exames_paciente',
    exame: exameId === undefined ? 'exame' : `exame_${exameId}`,
    coleta: 'coleta',
  };
  return `${prefixos[escopo]}_${data}_${hora}.xml`;
}

/**
 * Exportação em XML (#22). Só roda por comando do profissional autenticado e
 * só lê os exames que ele aplicou; o responsável pela pesquisa exporta a coleta
 * inteira, com quem aplicou cada exame (#138). O arquivo fica no aparelho, na pasta que ele
 * escolher: a transferência para o REDCap é manual.
 */
export async function exportarExames(
  { profissional, pacienteId, exameId, agora, versaoAplicativo }: PedidoDeExportacao,
  repository: ExportacaoRepository,
  salvar: SalvarArquivo,
): Promise<ResultadoExportacao> {
  const escopo = escopoDoPedido(profissional, pacienteId, exameId);
  const pacientes =
    escopo === 'coleta'
      ? await repository.lerExamesDeTodos(profissional.id)
      : await repository.lerExames(profissional.id, pacienteId, exameId);
  const exames = pacientes.reduce((total, paciente) => total + paciente.exames.length, 0);
  if (exames === 0) return { estado: 'vazio' };

  const xml = gerarXmlDeExportacao(pacientes, {
    geradaEm: agora.toISOString(),
    versaoAplicativo,
    escopo,
    profissional: { crmNumero: profissional.crmNumber, crmUf: profissional.crmState },
  });
  const arquivo = nomeDoArquivo(agora, escopo, exameId);
  if (!(await salvar(arquivo, xml))) return { estado: 'cancelado' };
  return { estado: 'salvo', arquivo, pacientes: pacientes.length, exames };
}
