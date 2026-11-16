import { render, screen } from '@testing-library/react-native';

import { syncFailure } from '@/features/sincronizacao/error-codes';
import { FailureMessage } from '@/features/sincronizacao/failure-message';

describe('FailureMessage', () => {
  it('mostra o título com o código e, embaixo, o que fazer', () => {
    render(<FailureMessage failure={syncFailure(202)} />);

    expect(screen.getByText('Senha incorreta (Cód. de Erro: 202)')).toBeOnTheScreen();
    expect(screen.getByText('Digite a senha com que você entrou no aplicativo.')).toBeOnTheScreen();
  });

  it('o leitor de tela lê o código por extenso, sem a abreviação', () => {
    render(<FailureMessage failure={syncFailure(201, { nearby: 8011 })} />);

    expect(
      screen.getByLabelText(
        'Erro. Falha ao conectar ao outro tablet. Código de erro 201, código do Nearby 8011. Confira se o outro tablet está perto e com a tela de sincronização aberta.',
      ),
    ).toBeOnTheScreen();
  });

  it('o aviso aparece como informação, com "Cód.:"', () => {
    render(<FailureMessage failure={syncFailure(340)} />);

    expect(screen.getByText('A conexão caiu antes do fim da troca (Cód.: 340)')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Informação\. /)).toBeOnTheScreen();
  });

  it('sem ação, mostra só a causa', () => {
    render(<FailureMessage failure={syncFailure(116)} />);

    expect(
      screen.getByLabelText(
        'Erro. O Google Play Services deste tablet está desatualizado. Código de erro 116.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'O Google Play Services deste tablet está desatualizado (Cód. de Erro: 116)',
      ),
    ).toBeOnTheScreen();
  });
});
