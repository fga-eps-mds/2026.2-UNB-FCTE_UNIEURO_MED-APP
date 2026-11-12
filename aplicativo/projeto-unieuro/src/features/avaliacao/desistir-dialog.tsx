import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import { MOTIVOS_DESISTENCIA, type MotivoDesistencia } from '@/features/avaliacao/interrupcao';
import { createInterrupcaoStyles } from '@/features/avaliacao/interrupcao.styles';

export const FALHA_AO_DESISTIR = 'Não foi possível registrar a desistência. Tente de novo.';

type DesistirDialogProps = {
  visible: boolean;
  /** Tarefa em que o exame para, como "Tarefa 2 de 3 · Copie este cubo". */
  parouEm: string;
  onContinuar: () => void;
  /** Grava a desistência. Se a promessa falhar, o diálogo avisa e continua aberto. */
  onDesistir: (motivo: MotivoDesistencia | null) => Promise<void>;
};

/**
 * Confirmação da desistência (#25): a tarefa atual vira o ponto de parada, os
 * desenhos já feitos ficam salvos, e o motivo é opcional. "Continuar o exame" é
 * o botão principal, para um toque sem querer não encerrar o exame.
 */
export function DesistirDialog({
  visible,
  parouEm,
  onContinuar,
  onDesistir,
}: Readonly<DesistirDialogProps>) {
  const styles = useMemo(() => createInterrupcaoStyles(), []);
  const [motivo, setMotivo] = useState<MotivoDesistencia | null>(null);
  const [gravando, setGravando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  function continuar() {
    setMotivo(null);
    setFalhou(false);
    onContinuar();
  }

  async function desistir() {
    if (gravando) return;
    setGravando(true);
    setFalhou(false);
    try {
      await onDesistir(motivo);
    } catch {
      setFalhou(true);
    } finally {
      setGravando(false);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={continuar}>
      <ScrollView style={styles.fundo} contentContainerStyle={styles.fundoConteudo}>
        <View style={styles.dialogo} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.titulo}>
            Desistir do exame?
          </Text>
          <Text style={styles.texto}>
            O exame será encerrado agora. Os desenhos já feitos ficam salvos.
          </Text>
          <View style={styles.parada}>
            <Text style={styles.paradaRotulo}>PAROU EM</Text>
            <Text style={styles.paradaTexto}>{parouEm}</Text>
          </View>

          <Text style={styles.rotulo}>MOTIVO (OPCIONAL)</Text>
          <View style={styles.motivos}>
            {MOTIVOS_DESISTENCIA.map(({ id, rotulo }) => {
              const escolhido = motivo === id;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: escolhido }}
                  onPress={() => setMotivo(escolhido ? null : id)}
                  style={[styles.motivo, escolhido && styles.motivoEscolhido]}>
                  <Text style={[styles.motivoTexto, escolhido && styles.motivoTextoEscolhido]}>
                    {rotulo}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {falhou && <FeedbackMessage kind="error" message={FALHA_AO_DESISTIR} />}

          <View style={styles.acoes}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sim, desistir"
              accessibilityState={{ busy: gravando, disabled: gravando }}
              disabled={gravando}
              onPress={desistir}
              style={({ pressed }) => [
                styles.botaoSecundario,
                (pressed || gravando) && styles.pressionado,
              ]}>
              {gravando ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.botaoSecundarioTexto}>Sim, desistir</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={continuar}
              style={({ pressed }) => [styles.botaoPrincipal, pressed && styles.pressionado]}>
              <Text style={styles.botaoPrincipalTexto}>Continuar o exame</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}
