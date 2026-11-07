import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import type { TermoStyles } from '@/features/avaliacao/termo-consentimento.styles';
import { formatCpfInput, parseCpf } from '@/features/shared/cpf';
import { useTheme } from '@/hooks/use-theme';

export const ROTULO_CPF_RESPONSAVEL = 'CPF do responsável legal';
export const ERRO_CPF_VAZIO = 'Preencha o CPF do responsável legal.';
export const ERRO_CPF_INVALIDO = 'Informe um CPF válido.';

const CPF_COMPLETO = 14; // 000.000.000-00

type CpfResponsavelProps = {
  /** Texto como está no campo, com a máscara. */
  valor: string;
  onChange: (valor: string) => void;
  styles: TermoStyles;
};

/**
 * Mensagem de erro do CPF, ou `undefined` quando ele está válido. Um CPF vazio só
 * é cobrado depois que a pessoa sai do campo; um CPF completo e inválido é
 * apontado na hora.
 */
export function erroDoCpf(valor: string, tocado: boolean): string | undefined {
  if (parseCpf(valor)) return undefined;
  if (!valor.trim()) return tocado ? ERRO_CPF_VAZIO : undefined;
  return tocado || valor.length >= CPF_COMPLETO ? ERRO_CPF_INVALIDO : undefined;
}

/**
 * Campo obrigatório do CPF do responsável legal (#21). Só aparece quando "Responsável
 * legal" está marcado em "Quem assina". O texto digitado ganha a máscara a cada
 * toque e é validado antes de o aceite poder ser concluído.
 */
export function CpfResponsavelCampo({ valor, onChange, styles }: Readonly<CpfResponsavelProps>) {
  const theme = useTheme();
  const [tocado, setTocado] = useState(false);
  const [emFoco, setEmFoco] = useState(false);
  const erro = erroDoCpf(valor, tocado);

  return (
    <View style={styles.campoCpf}>
      <Text style={styles.campoCpfRotulo}>{ROTULO_CPF_RESPONSAVEL}</Text>
      <TextInput
        accessibilityHint={erro}
        accessibilityLabel={ROTULO_CPF_RESPONSAVEL}
        autoComplete="off"
        autoCorrect={false}
        // Dado sensível não vai para o serviço de preenchimento automático.
        importantForAutofill="no"
        keyboardType="number-pad"
        maxLength={CPF_COMPLETO}
        onBlur={() => {
          setTocado(true);
          setEmFoco(false);
        }}
        onChangeText={(texto) => onChange(formatCpfInput(texto))}
        onFocus={() => setEmFoco(true)}
        placeholder="000.000.000-00"
        placeholderTextColor={theme.placeholder}
        style={[
          styles.campoCpfEntrada,
          emFoco && styles.campoCpfEntradaFoco,
          erro ? styles.campoCpfEntradaInvalida : null,
        ]}
        value={valor}
      />
      {erro ? <FeedbackMessage kind="error" message={erro} inline /> : null}
    </View>
  );
}
