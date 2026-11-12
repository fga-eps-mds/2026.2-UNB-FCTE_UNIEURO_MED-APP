import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import type { ResultadoExportacao } from '@/features/exportacao/exportacao';
import { createExportacaoStyles } from '@/features/exportacao/exportacao.styles';
import { useTheme } from '@/hooks/use-theme';

export const FALHA_AO_EXPORTAR = 'Não foi possível salvar o arquivo. Tente de novo.';
export const NADA_A_EXPORTAR = 'Você ainda não tem exames para exportar.';

type ExportarTodosDialogProps = {
  visible: boolean;
  pacientes: number;
  exames: number;
  exportar: () => Promise<ResultadoExportacao>;
  onCancelar: () => void;
  onSalvo: (arquivo: string) => void;
};

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/**
 * Confirmação da exportação de todos os exames (#22). Desistir do seletor de
 * pastas deixa o diálogo aberto, sem erro, para escolher outra vez.
 */
export function ExportarTodosDialog({
  visible,
  pacientes,
  exames,
  exportar,
  onCancelar,
  onSalvo,
}: Readonly<ExportarTodosDialogProps>) {
  const theme = useTheme();
  const styles = useMemo(() => createExportacaoStyles(theme), [theme]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function cancelar() {
    if (salvando) return;
    setErro(null);
    onCancelar();
  }

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await exportar();
      if (resultado.estado === 'salvo') onSalvo(resultado.arquivo);
      else if (resultado.estado === 'vazio') setErro(NADA_A_EXPORTAR);
    } catch {
      setErro(FALHA_AO_EXPORTAR);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={cancelar}>
      <ScrollView style={styles.backdrop} contentContainerStyle={styles.backdropContent}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>
            Exportar todos os exames
          </Text>
          <Text style={styles.text}>
            O arquivo XML reúne {exames === 1 ? 'o' : 'os'} {plural(exames, 'exame', 'exames')}{' '}
            {pacientes === 1 ? 'do' : 'dos'} {plural(pacientes, 'paciente', 'pacientes')} que você
            atendeu: termo, desenhos, traçados e situação de cada exame. O paciente aparece só por
            um código, sem nome, CPF ou ficha.
          </Text>
          <View style={styles.destination}>
            <Text style={styles.destinationLabel}>DESTINO</Text>
            <Text style={styles.destinationText}>A pasta que você escolher no tablet</Text>
          </View>
          {erro && <FeedbackMessage kind="error" message={erro} />}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={cancelar}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Salvar arquivo"
              accessibilityState={{ busy: salvando, disabled: salvando }}
              disabled={salvando}
              onPress={salvar}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || salvando) && styles.pressed,
              ]}>
              {salvando ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Salvar arquivo</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}
