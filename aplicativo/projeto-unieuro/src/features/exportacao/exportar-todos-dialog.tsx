import { ExportarXmlDialog } from '@/features/exportacao/exportar-xml-dialog';
import type { ResultadoExportacao } from '@/features/exportacao/exportacao';

export { FALHA_AO_EXPORTAR, NADA_A_EXPORTAR } from '@/features/exportacao/exportar-xml-dialog';
export const NADA_NA_COLETA = 'O tablet ainda não tem exames para exportar.';

type ExportarTodosDialogProps = {
  visible: boolean;
  pacientes: number;
  exames: number;
  /** Responsável pela pesquisa: o arquivo traz a coleta inteira do tablet (#138). */
  todosOsProfissionais?: boolean;
  exportar: () => Promise<ResultadoExportacao>;
  onCancelar: () => void;
  onSalvo: (arquivo: string) => void;
};

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/** Confirmação da exportação de todos os exames (#22) ou da coleta inteira (#138). */
export function ExportarTodosDialog({
  pacientes,
  exames,
  todosOsProfissionais = false,
  ...resto
}: Readonly<ExportarTodosDialogProps>) {
  const deQuem = todosOsProfissionais
    ? 'de todos os profissionais deste tablet, com quem aplicou cada exame'
    : 'que você atendeu';
  return (
    <ExportarXmlDialog
      {...resto}
      titulo="Exportar todos os exames"
      descricao={`O arquivo XML reúne ${exames === 1 ? 'o' : 'os'} ${plural(exames, 'exame', 'exames')} ${pacientes === 1 ? 'do' : 'dos'} ${plural(pacientes, 'paciente', 'pacientes')} ${deQuem}: termo, desenhos, traçados e situação de cada exame. O paciente aparece só por um código, sem nome, CPF ou ficha.`}
      mensagemVazio={todosOsProfissionais ? NADA_NA_COLETA : undefined}
    />
  );
}
