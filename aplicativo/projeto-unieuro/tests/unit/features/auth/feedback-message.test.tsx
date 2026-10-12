import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { render, screen } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';
import { FeedbackMessage } from '@/features/auth/feedback-message';

describe('FeedbackMessage', () => {
  it.each([
    { kind: 'error', label: 'Erro', icon: 'close-circle', color: Colors.light.error },
    { kind: 'success', label: 'Sucesso', icon: 'check-circle', color: Colors.light.success },
    { kind: 'info', label: 'Informação', icon: 'information', color: Colors.light.info },
  ] as const)('mostra o ícone Material e o texto de $label', ({ kind, label, icon, color }) => {
    const message = 'Mensagem de teste.';
    const { UNSAFE_getByType } = render(<FeedbackMessage kind={kind} message={message} />);

    expect(screen.getByLabelText(`${label}. ${message}`)).toBeOnTheScreen();
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(UNSAFE_getByType(MaterialCommunityIcons).props).toEqual(
      expect.objectContaining({ name: icon, size: 24, color }),
    );
  });
});
