import { render, screen, userEvent } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';
import { QuemAssinaEscolha } from '@/features/avaliacao/quem-assina';
import { createTermoStyles } from '@/features/avaliacao/termo-consentimento.styles';
import type { QuemAssina } from '@/features/avaliacao/termo-tcle';

const styles = createTermoStyles(Colors.light);

function renderizar(valor: QuemAssina, onChange = jest.fn()) {
  render(<QuemAssinaEscolha onChange={onChange} styles={styles} valor={valor} />);
  return onChange;
}

describe('QuemAssinaEscolha', () => {
  it('aceite pelo paciente: marca "Paciente" quando ele é quem assina', () => {
    renderizar('paciente');

    expect(screen.getByRole('radio', { name: 'Paciente' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Responsável legal' })).not.toBeChecked();
  });

  it('aceite pelo responsável legal: avisa a troca quando o profissional marca "Responsável legal"', async () => {
    const user = userEvent.setup();
    const onChange = renderizar('paciente');

    await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));

    expect(onChange).toHaveBeenCalledWith('responsavel_legal');
  });

  it('mostra o rótulo "Quem assina" e a opção marcada', () => {
    renderizar('responsavel_legal');

    expect(screen.getByText('Quem assina')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Responsável legal' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Paciente' })).not.toBeChecked();
  });
});
