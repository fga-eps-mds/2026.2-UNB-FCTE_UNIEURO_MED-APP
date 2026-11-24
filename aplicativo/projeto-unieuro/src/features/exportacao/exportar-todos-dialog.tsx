import { ExportarXmlDialog } from '@/features/exportacao/exportar-xml-dialog';
import type { ResultadoExportacao } from '@/features/exportacao/exportacao';

export { FALHA_AO_EXPORTAR, NADA_A_EXPORTAR } from '@/features/exportacao/exportar-xml-dialog';

type ExportarTodosDialogProps = {
  visible: boolean;
  pacientes: number;
  exames: number;
  exportar: () => Promise<ResultadoExportacao>;
  onCancelar: () => void;
  onSalvo: (arquivo: string) => void;
};

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/** Confirmação da exportação de todos os exames (#22). */
export function ExportarTodosDialog({
  pacientes,
  exames,
  ...resto
}: Readonly<ExportarTodosDialogProps>) {
  return (
    <ExportarXmlDialog
      {...resto}
      titulo="Exportar todos os exames"
      descricao={`O arquivo XML reúne ${exames === 1 ? 'o' : 'os'} ${plural(exames, 'exame', 'exames')} ${pacientes === 1 ? 'do' : 'dos'} ${plural(pacientes, 'paciente', 'pacientes')} que você atendeu: termo, desenhos, traçados e situação de cada exame. O paciente aparece só por um código, sem nome, CPF ou ficha.`}
    />
  );
}
