import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { render, screen } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';
import ExamStatusChip from '@/features/home/exam-status-chip';

describe('ExamStatusChip', () => {
  // Cor e ícone seguem as mensagens do guia de identidade visual: a cor nunca é a única pista.
  it.each([
    ['success', 'check-circle', Colors.light.success, Colors.light.successBg],
    ['warning', 'alert', Colors.light.warning, Colors.light.warningBg],
    ['error', 'close-circle', Colors.light.error, Colors.light.errorBg],
    ['info', 'information', Colors.light.info, Colors.light.infoBg],
  ] as const)('o tom %s mostra o ícone %s junto ao texto', (tone, icon, color, background) => {
    const { UNSAFE_getByType } = render(<ExamStatusChip tone={tone} label="Situação do exame" />);

    expect(screen.getByText('Situação do exame')).toHaveStyle({ color });
    expect(screen.getByTestId('situacao')).toHaveStyle({ backgroundColor: background });
    expect(UNSAFE_getByType(MaterialCommunityIcons).props).toEqual(
      expect.objectContaining({ name: icon, color }),
    );
  });

  it('esconde o ícone do leitor de tela, que lê só o texto da situação', () => {
    const { UNSAFE_getByType } = render(<ExamStatusChip tone="success" label="Concluído" />);

    expect(UNSAFE_getByType(MaterialCommunityIcons).props).toEqual(
      expect.objectContaining({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      }),
    );
  });
});
