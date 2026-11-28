import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import { createAccountFormStyles } from '@/features/settings/account-form.styles';
import type { LinhaConta } from '@/features/superusuario/contas';
import {
  desativarConta,
  type DesativacaoRepository,
} from '@/features/superusuario/desativar-conta';
import { useTheme } from '@/hooks/use-theme';

export const FALHA_AO_DESATIVAR = 'Não foi possível desativar a conta. Tente de novo.';

type DesativarContaDialogProps = {
  /** A conta a desativar. Sem conta, o diálogo fica fechado. */
  conta: LinhaConta | null;
  superusuarioId: number;
  repository: DesativacaoRepository;
  onCancel: () => void;
  onDesativada: (conta: LinhaConta) => void;
};

/**
 * Confirmação da desativação da conta de um médico pelo superusuário. O guia de
 * identidade visual pede um diálogo antes de toda ação destrutiva com título em pergunta,
 * a consequência numa frase e o botão em vinho por último.
 */
export function DesativarContaDialog({
  conta,
  superusuarioId,
  repository,
  onCancel,
  onDesativada,
}: Readonly<DesativarContaDialogProps>) {
  const theme = useTheme();
  const form = useMemo(() => createAccountFormStyles(theme), [theme]);
  const [erro, setErro] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  // O título guarda o nome enquanto o diálogo some, depois que a conta volta a ser nula.
  const [nome, setNome] = useState(conta?.nome);
  if (conta && conta.nome !== nome) setNome(conta.nome);

  function cancelar() {
    setErro(undefined);
    onCancel();
  }

  async function confirmar() {
    // Um segundo toque enquanto o banco responde não manda o pedido de novo.
    if (enviando || !conta) return;
    setEnviando(true);
    setErro(undefined);
    try {
      const resultado = await desativarConta(superusuarioId, conta.id, repository);
      if (!resultado.success) {
        setErro(resultado.message);
        return;
      }
      onDesativada(conta);
    } catch {
      setErro(FALHA_AO_DESATIVAR);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal transparent visible={conta !== null} animationType="fade" onRequestClose={cancelar}>
      <View style={form.backdrop}>
        <View style={form.dialog} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={form.dialogTitle}>
            Desativar a conta de {nome}?
          </Text>
          {/* A conta é desativada e os exames ficam. */}
          <Text style={form.dialogText}>
            Quem usa esta conta não vai mais conseguir entrar neste tablet. Os exames aplicados com
            ela continuam salvos para a pesquisa.
          </Text>
          {erro && <FeedbackMessage kind="error" message={erro} />}
          <View style={form.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={cancelar}
              style={({ pressed }) => [form.secondaryButton, pressed && form.disabled]}>
              <Text style={form.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Desativar conta"
              accessibilityState={{ busy: enviando, disabled: enviando }}
              disabled={enviando}
              onPress={confirmar}
              style={({ pressed }) => [form.dangerButton, (pressed || enviando) && form.disabled]}>
              {enviando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={form.dangerButtonText}>Desativar conta</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
