import { Modal, Pressable, Text, View } from 'react-native';

import type { DecisaoStyles } from '@/features/avaliacao/consent-decision.styles';

type ConfirmarRecusaProps = {
  visible: boolean;
  ocupado: boolean;
  onVoltar: () => void;
  onConfirmar: () => void;
  aviso?: string | null;
  styles: DecisaoStyles;
};

export function ConfirmarRecusa({
  visible,
  ocupado,
  onVoltar,
  onConfirmar,
  aviso,
  styles,
}: ConfirmarRecusaProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onVoltar}>
      <View style={styles.fundoDialogo}>
        <View style={styles.dialogo} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.dialogoTitulo}>
            Recusar a participação?
          </Text>
          <Text style={styles.dialogoTexto}>
            O exame será cancelado antes de qualquer desenho. O paciente pode mudar de ideia e
            voltar ao termo.
          </Text>
          <View style={styles.dialogoRegistro}>
            <Text style={styles.dialogoRegistroRotulo}>REGISTRADO</Text>
            <Text style={styles.dialogoRegistroTexto}>
              A recusa fica registrada com data e horário.
            </Text>
          </View>
          {aviso && (
            <Text accessibilityRole="alert" style={styles.aviso}>
              {aviso}
            </Text>
          )}
          <View style={styles.dialogoBotoes}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: ocupado }}
              disabled={ocupado}
              onPress={onVoltar}
              style={({ pressed }) => [
                styles.botaoVoltar,
                pressed && styles.botaoPressionado,
                ocupado && styles.botaoOcupado,
              ]}>
              <Text style={styles.botaoRecusarTexto}>Voltar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: ocupado, disabled: ocupado }}
              disabled={ocupado}
              onPress={onConfirmar}
              style={({ pressed }) => [
                styles.botaoPrincipal,
                pressed && styles.botaoPrincipalPressionado,
                ocupado && styles.botaoOcupado,
              ]}>
              <Text style={styles.botaoPrincipalTexto}>Confirmar recusa</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
