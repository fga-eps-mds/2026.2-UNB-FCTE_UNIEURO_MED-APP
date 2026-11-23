import type { SessionProfessional } from '@/features/auth/session';
import { gerarXmlDeExportacao, type PacienteExportado } from '@/features/exportacao/xml-exportacao';

export type ExportacaoRepository = {
  /** Pacientes e exames que o profissional aplicou; com `pacienteId`, só os desse paciente. */
  lerExames(profissionalId: number, pacienteId?: number): Promise<PacienteExportado[]>;
};

/** Grava o arquivo onde o profissional escolher. `false` quando ele desiste. */
export type SalvarArquivo = (nome: string, conteudo: string) => Promise<boolean>;

export type PedidoDeExportacao = {
  profissional: SessionProfessional;
  /** Sem paciente, exporta todos os que o profissional atendeu. */
  pacienteId?: number;
  agora: Date;
  versaoAplicativo: string;
};

export type ResultadoExportacao =
  | { estado: 'salvo'; arquivo: string; pacientes: number; exames: number }
  | { estado: 'cancelado' }
  | { estado: 'vazio' };

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** Nome com data e hora locais, como `exames_2026-11-12_1430.xml`. */
export function nomeDoArquivo(agora: Date, escopo: 'todos' | 'paciente'): string {
  const data = `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
  const hora = `${doisDigitos(agora.getHours())}${doisDigitos(agora.getMinutes())}`;
  const prefixo = escopo === 'todos' ? 'exames' : 'exames_paciente';
  return `${prefixo}_${data}_${hora}.xml`;
}

/**
 * Exportação em XML (#22). Só roda por comando do profissional autenticado e
 * só lê os exames que ele aplicou. O arquivo fica no aparelho, na pasta que ele
 * escolher: a transferência para o REDCap é manual.
 */
export async function exportarExames(
  { profissional, pacienteId, agora, versaoAplicativo }: PedidoDeExportacao,
  repository: ExportacaoRepository,
  salvar: SalvarArquivo,
): Promise<ResultadoExportacao> {
  const escopo = pacienteId === undefined ? 'todos' : 'paciente';
  const pacientes = await repository.lerExames(profissional.id, pacienteId);
  const exames = pacientes.reduce((total, paciente) => total + paciente.exames.length, 0);
  if (exames === 0) return { estado: 'vazio' };

  const xml = gerarXmlDeExportacao(pacientes, {
    geradaEm: agora.toISOString(),
    versaoAplicativo,
    escopo,
    profissional: { crmNumero: profissional.crmNumber, crmUf: profissional.crmState },
  });
  const arquivo = nomeDoArquivo(agora, escopo);
  if (!(await salvar(arquivo, xml))) return { estado: 'cancelado' };
  return { estado: 'salvo', arquivo, pacientes: pacientes.length, exames };
}
