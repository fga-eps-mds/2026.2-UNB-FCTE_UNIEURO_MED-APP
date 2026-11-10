import { Modal, Pressable, Text, View } from 'react-native';

import type { DrawingTaskStyles } from '@/features/avaliacao/drawing-task.styles';

export const TITULO_APAGAR = 'Apagar o desenho?';
export const TEXTO_APAGAR =
  'Tudo o que foi desenhado nesta tarefa será apagado e o paciente pode desenhar de novo.';
export const REGISTRO_APAGAR = 'Apagamento registrado nesta tarefa, com o horário.';

type ConfirmarApagarDesenhoProps = {
  visible: boolean;
  onCancelar: () => void;
  onApagar: () => void;
  styles: DrawingTaskStyles;
};

/**
 * Confirmação do "Apagar tudo" (#23), como no protótipo: o paciente confirma antes de
 * perder o desenho. Apagar não tira nada dos dados da coleta: o apagamento vira um
 * evento `limpar` no traçado, com o horário (Atas 06 e 07).
 */
export function ConfirmarApagarDesenho({
  visible,
  onCancelar,
  onApagar,
  styles,
}: Readonly<ConfirmarApagarDesenhoProps>) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancelar}>
      <View style={styles.fundoDialogo}>
        <View style={styles.dialogo} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.dialogoTitulo}>
            {TITULO_APAGAR}
          </Text>
          <Text style={styles.dialogoTexto}>{TEXTO_APAGAR}</Text>
          <View style={styles.dialogoRegistro}>
            <Text style={styles.dialogoRegistroRotulo}>REGISTRADO</Text>
            <Text style={styles.dialogoRegistroTexto}>{REGISTRO_APAGAR}</Text>
          </View>
          <View style={styles.dialogoBotoes}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancelar}
              style={({ pressed }) => [
                styles.botaoCancelar,
                pressed && styles.botaoAcaoPressionado,
              ]}>
              <Text style={styles.textoAcao}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onApagar}
              style={({ pressed }) => [
                styles.botaoApagar,
                pressed && styles.botaoApagarPressionado,
              ]}>
              <Text style={styles.textoApagar}>Apagar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
