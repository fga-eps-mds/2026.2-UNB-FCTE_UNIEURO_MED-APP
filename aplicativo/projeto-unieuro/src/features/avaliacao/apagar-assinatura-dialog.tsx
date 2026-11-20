import { Modal, Pressable, Text, View } from 'react-native';

import type { DecisaoStyles } from '@/features/avaliacao/consent-decision.styles';

export const TITULO_APAGAR_ASSINATURA = 'Apagar a assinatura?';
export const TEXTO_APAGAR_ASSINATURA =
  'O que foi assinado sai da área, e é preciso assinar de novo antes de continuar.';
export const BOTAO_MANTER_ASSINATURA = 'Manter assinatura';
export const BOTAO_APAGAR_ASSINATURA = 'Apagar e assinar de novo';

type ConfirmarApagarAssinaturaProps = {
  visible: boolean;
  onManter: () => void;
  onApagar: () => void;
  styles: DecisaoStyles;
};

/**
 * Confirmação antes de apagar a assinatura do termo (#139). Na validação, o PO viu que
 * o botão podia ser tocado sem querer com a caneta perto, e o toque apagava o que o
 * paciente assinou. "Manter" é a primeira opção e o voltar do Android também mantém.
 */
export function ConfirmarApagarAssinatura({
  visible,
  onManter,
  onApagar,
  styles,
}: Readonly<ConfirmarApagarAssinaturaProps>) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onManter}>
      <View style={styles.fundoDialogo}>
        <View style={styles.dialogo} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.dialogoTitulo}>
            {TITULO_APAGAR_ASSINATURA}
          </Text>
          <Text style={styles.dialogoTexto}>{TEXTO_APAGAR_ASSINATURA}</Text>
          <View style={styles.dialogoBotoes}>
            <Pressable
              accessibilityRole="button"
              onPress={onManter}
              style={({ pressed }) => [styles.botaoVoltar, pressed && styles.botaoPressionado]}>
              <Text style={styles.botaoRecusarTexto}>{BOTAO_MANTER_ASSINATURA}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onApagar}
              style={({ pressed }) => [
                styles.botaoPrincipal,
                pressed && styles.botaoPrincipalPressionado,
              ]}>
              <Text style={styles.botaoPrincipalTexto}>{BOTAO_APAGAR_ASSINATURA}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
