import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import type { SyncStyles } from '@/features/sincronizacao/sync.styles';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  styles: SyncStyles;
  /** `outline` para ações secundárias. */
  variant?: 'primary' | 'outline';
  busy?: boolean;
};

export function ActionButton({
  label,
  onPress,
  styles,
  variant = 'primary',
  busy = false,
}: ActionButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        primary ? styles.primaryButton : styles.outlineButton,
        busy && styles.disabledButton,
        pressed && styles.pressed,
      ]}>
      <Text style={primary ? styles.primaryButtonText : styles.outlineButtonText}>{label}</Text>
    </Pressable>
  );
}

type LabeledInputProps = Pick<
  TextInputProps,
  'value' | 'onChangeText' | 'placeholder' | 'secureTextEntry' | 'autoCapitalize'
> & {
  label: string;
  /** Precisa ser único: a tela tem mais de um campo de senha. */
  accessibilityLabel: string;
  placeholderColor: string;
  styles: SyncStyles;
};

export function LabeledInput({
  label,
  accessibilityLabel,
  placeholderColor,
  styles,
  ...input
}: LabeledInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={accessibilityLabel}
        autoCorrect={false}
        placeholderTextColor={placeholderColor}
        style={styles.input}
      />
    </View>
  );
}
