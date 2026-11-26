import { Modal, Pressable, Text, View } from 'react-native';

import type { ExistingPatient } from '@/features/avaliacao/attendance';
import type { NewAttendanceStyles } from '@/features/avaliacao/new-attendance.styles';

export const TITULO_CPF_JA_CADASTRADO = 'CPF já cadastrado';
export const BOTAO_REVISAR = 'Voltar e revisar';
export const BOTAO_CONTINUAR_NA_FICHA = 'Continuar com esta ficha';

export const textoCpfJaCadastrado = ({ name, recordNumber }: ExistingPatient) => {
  const aviso =
    name === null || recordNumber === null
      ? 'Este CPF já está cadastrado no tablet.'
      : `Este CPF já é do paciente ${name}, ficha ${recordNumber}.`;

  return (
    `${aviso} O novo exame entra na ficha existente, com os dados do cadastro. ` +
    'O nome, a data de nascimento, a escolaridade e o sexo digitados não serão salvos.'
  );
};

type CpfJaCadastradoProps = {
  patient: ExistingPatient | null;
  onRevisar: () => void;
  onContinuar: () => void;
  styles: NewAttendanceStyles;
};

/**
 * Aviso do CPF já cadastrado (#140). O paciente é identificado pelo CPF: com um CPF
 * que já existe, o exame entra na ficha existente e os dados digitados não mudam o
 * cadastro. "Voltar e revisar" vem primeiro, e o voltar do Android também revisa.
 */
export function CpfJaCadastrado({ patient, onRevisar, onContinuar, styles }: CpfJaCadastradoProps) {
  return (
    <Modal animationType="fade" onRequestClose={onRevisar} transparent visible={patient !== null}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.modalTitle}>
            {TITULO_CPF_JA_CADASTRADO}
          </Text>
          {patient ? <Text style={styles.modalText}>{textoCpfJaCadastrado(patient)}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={onRevisar}
            style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
            <Text style={styles.submitText}>{BOTAO_REVISAR}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onContinuar}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <Text style={styles.optionText}>{BOTAO_CONTINUAR_NA_FICHA}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
