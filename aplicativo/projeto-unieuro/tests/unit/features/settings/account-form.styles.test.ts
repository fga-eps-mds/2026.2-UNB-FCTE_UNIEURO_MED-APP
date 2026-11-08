import { Colors } from '@/constants/theme';
import { createAccountFormStyles } from '@/features/settings/account-form.styles';

describe('estilos do formulário da conta', () => {
  const styles = createAccountFormStyles(Colors.light);

  it('não força altura nos campos empilhados no cartão', () => {
    expect(styles.field).not.toHaveProperty('flexBasis');
    expect(styles.field).not.toHaveProperty('flexGrow');
  });

  it('divide a linha só entre os campos lado a lado', () => {
    expect(styles.rowItem).toEqual({ flexGrow: 1, flexBasis: 200 });
  });

  it('não estica o botão que fica sozinho no cartão', () => {
    expect(styles.standaloneButton).toEqual({ flexGrow: 0, flexBasis: 'auto' });
  });
});
