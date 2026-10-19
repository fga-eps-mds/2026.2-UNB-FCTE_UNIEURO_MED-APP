import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import type { AccountFormStyles } from '@/features/settings/account-form.styles';
import { useTheme } from '@/hooks/use-theme';

type FormFieldProps = Omit<TextInputProps, 'style'> & {
  styles: AccountFormStyles;
  label: string;
  error?: string;
};

/**
 * Campo com rótulo visível e o erro logo abaixo, com o ícone e a cor de erro do
 * FeedbackMessage, anunciado pelo leitor de tela.
 */
export function FormField({ styles, label, error, ...input }: FormFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        autoCapitalize="none"
        placeholderTextColor={theme.placeholder}
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
      {error ? <FeedbackMessage kind="error" message={error} inline /> : null}
    </View>
  );
}
