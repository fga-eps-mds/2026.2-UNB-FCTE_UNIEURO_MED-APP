import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { deactivateAccount, type AccountRepository } from '@/features/auth/account';
import { createAccountFormStyles } from '@/features/settings/account-form.styles';
import { FormField } from '@/features/settings/form-field';
import { useTheme } from '@/hooks/use-theme';

type DeactivateAccountDialogProps = {
  visible: boolean;
  professionalId: number;
  repository: AccountRepository;
  onCancel: () => void;
  onDeactivated: () => void;
};

/**
 * Confirmação da desativação da conta (#5). A conta não é apagada: os exames
 * aplicados continuam no tablet para a pesquisa.
 */
export function DeactivateAccountDialog({
  visible,
  professionalId,
  repository,
  onCancel,
  onDeactivated,
}: DeactivateAccountDialogProps) {
  const theme = useTheme();
  const form = useMemo(() => createAccountFormStyles(theme), [theme]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  function cancel() {
    setPassword('');
    setError(undefined);
    onCancel();
  }

  async function confirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await deactivateAccount(professionalId, password, repository);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setPassword('');
      onDeactivated();
    } catch {
      setError('Não foi possível desativar a conta. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={cancel}>
      <View style={form.backdrop}>
        <View style={form.dialog} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={form.dialogTitle}>
            Desativar a sua conta?
          </Text>
          <Text style={form.dialogText}>
            Você não vai mais conseguir entrar com esta conta neste tablet. Os exames que você
            aplicou continuam salvos para a pesquisa.
          </Text>
          <FormField
            styles={form}
            label="CONFIRME COM A SUA SENHA"
            secureTextEntry
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
            error={error}
          />
          <Text style={form.hint}>
            A desativação fica registrada com data e horário. Para voltar a usar a conta, fale com o
            responsável pela pesquisa.
          </Text>
          <View style={form.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={cancel}
              style={({ pressed }) => [form.secondaryButton, pressed && form.disabled]}>
              <Text style={form.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Desativar conta"
              accessibilityState={{ busy: submitting, disabled: submitting }}
              disabled={submitting}
              onPress={confirm}
              style={({ pressed }) => [
                form.dangerButton,
                (pressed || submitting) && form.disabled,
              ]}>
              {submitting ? (
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
