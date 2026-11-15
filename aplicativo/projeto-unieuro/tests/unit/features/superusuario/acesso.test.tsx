import { render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { ehSuperusuario, useSomenteSuperusuario } from '@/features/superusuario/acesso';

const medico: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};
const superusuario: SessionProfessional = { ...medico, id: 1, superuser: true };

function Protegida() {
  const profissional = useSomenteSuperusuario();
  return profissional ? <Text>{`liberado para ${profissional.name}`}</Text> : null;
}

function renderizar(sessao: SessionProfessional | null) {
  render(
    <SessionProvider initialProfessional={sessao}>
      <Protegida />
    </SessionProvider>,
  );
}

describe('ehSuperusuario', () => {
  it('só o perfil de superusuário passa', () => {
    expect(ehSuperusuario(superusuario)).toBe(true);
    expect(ehSuperusuario(medico)).toBe(false);
    expect(ehSuperusuario({ ...medico, superuser: false })).toBe(false);
    expect(ehSuperusuario(null)).toBe(false);
    expect(ehSuperusuario(undefined)).toBe(false);
  });
});

describe('useSomenteSuperusuario', () => {
  it('libera a tela para o superusuário, sem redirecionar', () => {
    renderizar(superusuario);

    expect(screen.getByText('liberado para Ana Carolina Souza')).toBeOnTheScreen();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('manda o médico comum de volta à tela inicial, sem mostrar a tela', () => {
    renderizar(medico);

    expect(screen.queryByText(/liberado/)).toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });

  it('sem sessão, volta ao login', () => {
    renderizar(null);

    expect(screen.queryByText(/liberado/)).toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });
});
