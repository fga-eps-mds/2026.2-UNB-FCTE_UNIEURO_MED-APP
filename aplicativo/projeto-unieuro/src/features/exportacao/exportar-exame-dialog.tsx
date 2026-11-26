import { ExportarXmlDialog } from '@/features/exportacao/exportar-xml-dialog';
import type { ResultadoExportacao } from '@/features/exportacao/exportacao';

type ExportarExameDialogProps = {
  visible: boolean;
  exportar: () => Promise<ResultadoExportacao>;
  onCancelar: () => void;
  onSalvo: (arquivo: string) => void;
};

/** Confirmação da exportação de um único exame em XML (#22). */
export function ExportarExameDialog(props: Readonly<ExportarExameDialogProps>) {
  return (
    <ExportarXmlDialog
      {...props}
      titulo="Exportar este exame"
      descricao="O arquivo XML reúne apenas este exame: termo, desenhos, traçados e situação. O paciente aparece só por um código, sem nome, CPF ou ficha."
    />
  );
}
