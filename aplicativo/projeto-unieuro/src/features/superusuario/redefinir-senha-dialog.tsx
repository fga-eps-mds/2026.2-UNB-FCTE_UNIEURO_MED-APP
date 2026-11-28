import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import { createAccountFormStyles } from '@/features/settings/account-form.styles';
import { FormField } from '@/features/settings/form-field';
import type { LinhaConta } from '@/features/superusuario/contas';
import {
  redefinirSenha,
  type RedefinicaoErros,
  type RedefinicaoInput,
  type RedefinicaoRepository,
} from '@/features/superusuario/redefinir-senha';
import { useTheme } from '@/hooks/use-theme';

export const FALHA_AO_REDEFINIR = 'Não foi possível redefinir a senha. Tente de novo.';

// Com o teclado aberto, os campos podem não caber na tela: o conteúdo rola.
const local = StyleSheet.create({
  dialogo: { maxHeight: '90%', padding: 0 },
  conteudo: { gap: 16, padding: 32 },
});

const vazio: RedefinicaoInput = { novaSenha: '', confirmacao: '' };

type RedefinirSenhaDialogProps = {
  /** A conta cuja senha muda. Sem conta, o diálogo fica fechado. */
  conta: LinhaConta | null;
  superusuarioId: number;
  repository: RedefinicaoRepository;
  onCancel: () => void;
  onRedefinida: (conta: LinhaConta) => void;
};

/**
 * Redefinição da senha de um médico pelo superusuário (#119), para quando o médico a
 * esquece (cliente, 16/11). O superusuário não vê a senha antiga, só grava uma nova.
 * Os campos e as regras são os do "Trocar a senha" das configurações.
 */
export function RedefinirSenhaDialog({
  conta,
  superusuarioId,
  repository,
  onCancel,
  onRedefinida,
}: Readonly<RedefinirSenhaDialogProps>) {
  const theme = useTheme();
  const form = useMemo(() => createAccountFormStyles(theme), [theme]);
  const [valores, setValores] = useState(vazio);
  const [erros, setErros] = useState<RedefinicaoErros>({});
  const [enviando, setEnviando] = useState(false);
  // O título guarda o nome enquanto o diálogo some, depois que a conta volta a ser nula.
  const [nome, setNome] = useState(conta?.nome);
  if (conta && conta.nome !== nome) setNome(conta.nome);

  const editar = (campo: keyof RedefinicaoInput) => (texto: string) =>
    setValores((atual) => ({ ...atual, [campo]: texto }));

  // Ao fechar, a senha digitada não fica guardada para a próxima conta aberta.
  function limpar() {
    setValores(vazio);
    setErros({});
  }

  function cancelar() {
    limpar();
    onCancel();
  }

  async function confirmar() {
    // Um segundo toque enquanto o banco responde não manda o pedido de novo.
    if (enviando || !conta) return;
    setEnviando(true);
    try {
      const resultado = await redefinirSenha(superusuarioId, conta.id, valores, repository);
      if (!resultado.success) {
        setErros(resultado.errors);
        return;
      }
      limpar();
      onRedefinida(conta);
    } catch {
      setErros({ geral: FALHA_AO_REDEFINIR });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal transparent visible={conta !== null} animationType="fade" onRequestClose={cancelar}>
      <View style={form.backdrop}>
        <View style={[form.dialog, local.dialogo]} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={local.conteudo} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={form.dialogTitle}>
              Redefinir a senha de {nome}?
            </Text>
            <Text style={form.dialogText}>
              Use quando a senha for esquecida. Combine a nova senha com quem usa a conta: ela já
              vale no próximo acesso.
            </Text>
            <FormField
              styles={form}
              label="NOVA SENHA"
              secureTextEntry
              autoComplete="new-password"
              value={valores.novaSenha}
              onChangeText={editar('novaSenha')}
              error={erros.novaSenha}
            />
            <FormField
              styles={form}
              label="CONFIRMAR NOVA SENHA"
              secureTextEntry
              autoComplete="new-password"
              value={valores.confirmacao}
              onChangeText={editar('confirmacao')}
              error={erros.confirmacao}
            />
            {erros.geral && <FeedbackMessage kind="error" message={erros.geral} />}
            <View style={form.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={cancelar}
                style={({ pressed }) => [form.secondaryButton, pressed && form.disabled]}>
                <Text style={form.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Salvar nova senha"
                accessibilityState={{ busy: enviando, disabled: enviando }}
                disabled={enviando}
                onPress={confirmar}
                style={({ pressed }) => [
                  form.primaryButton,
                  (pressed || enviando) && form.disabled,
                ]}>
                {enviando ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <Text style={form.primaryButtonText}>Salvar nova senha</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
