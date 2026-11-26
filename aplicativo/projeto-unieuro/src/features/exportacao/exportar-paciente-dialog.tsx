import { ExportarXmlDialog } from '@/features/exportacao/exportar-xml-dialog';
import type { ResultadoExportacao } from '@/features/exportacao/exportacao';

type ExportarPacienteDialogProps = {
  visible: boolean;
  exportar: () => Promise<ResultadoExportacao>;
  onCancelar: () => void;
  onSalvo: (arquivo: string) => void;
};

/**
 * Confirmação da exportação de um paciente (#22). Não promete contagem de exames:
 * a tela de um superusuário lista exames de outros médicos, e o arquivo leva só os
 * do profissional autenticado.
 */
export function ExportarPacienteDialog(props: Readonly<ExportarPacienteDialogProps>) {
  return (
    <ExportarXmlDialog
      {...props}
      titulo="Exportar exames do paciente"
      descricao="O arquivo XML reúne os exames deste paciente que você aplicou: termo, desenhos, traçados e situação de cada exame. O paciente aparece só por um código, sem nome, CPF ou ficha."
    />
  );
}
