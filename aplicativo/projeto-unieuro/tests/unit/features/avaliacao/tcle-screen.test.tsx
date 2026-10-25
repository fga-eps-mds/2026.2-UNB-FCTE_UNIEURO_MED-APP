import { render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import TcleScreen from '@/features/avaliacao/tcle-screen';
import { TERMO_TCLE, descreverVersao } from '@/features/avaliacao/termo-tcle';
import { useConsentGate } from '@/features/avaliacao/use-consent-gate';

jest.mock('@/features/avaliacao/use-consent-gate', () => ({
  useConsentGate: jest.fn(() => 'aguardando_consentimento'),
}));

// O aceite e a recusa, com o banco de verdade, estão em tcle.integration.test.tsx.
// Aqui fica o que a tela faz com cada estado da avaliação.

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const registrar = jest.fn();
const versao = descreverVersao(TERMO_TCLE);

function renderizar() {
  render(
    <SessionProvider initialProfessional={profissional}>
      <TcleScreen atendimento="12" registrar={registrar} />
    </SessionProvider>,
  );
}

afterEach(() => {
  jest.mocked(useConsentGate).mockReturnValue('aguardando_consentimento');
});

describe('TcleScreen', () => {
  it('apresentação do termo: mostra o termo e a versão, e não abre nenhuma tarefa', () => {
    renderizar();

    expect(screen.getByText(versao)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Assinar e iniciar' })).toBeDisabled();
    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(useRouter().dismissTo).not.toHaveBeenCalled();
  });

  it('enquanto confere a avaliação, não mostra o termo nem muda de tela', () => {
    jest.mocked(useConsentGate).mockReturnValue('carregando');
    renderizar();

    expect(screen.queryByText(versao)).toBeNull();
    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(useRouter().dismissTo).not.toHaveBeenCalled();
  });

  it('com o aceite já gravado, segue para a instrução da primeira tarefa', () => {
    jest.mocked(useConsentGate).mockReturnValue('liberado');
    renderizar();

    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '1' },
    });
    expect(screen.queryByText(versao)).toBeNull();
    expect(registrar).not.toHaveBeenCalled();
  });

  it('com a recusa já gravada, ou sem atendimento, volta ao início', () => {
    jest.mocked(useConsentGate).mockReturnValue('bloqueado');
    renderizar();

    expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu');
    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(screen.queryByText(versao)).toBeNull();
  });
});
