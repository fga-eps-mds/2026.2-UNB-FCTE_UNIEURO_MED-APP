import { render, renderHook, screen, act } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  SessionProvider,
  formatCrm,
  returnToLogin,
  toSessionProfessional,
  useSession,
  type SessionProfessional,
} from '@/features/auth/session';

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

describe('sessão do profissional', () => {
  it('começa sem profissional autenticado', () => {
    const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });

    expect(result.current.professional).toBeNull();
  });

  it('guarda o profissional ao entrar e o descarta ao sair', () => {
    const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });

    act(() => result.current.signIn(profissional));
    expect(result.current.professional).toEqual(profissional);

    act(() => result.current.signOut());
    expect(result.current.professional).toBeNull();
  });

  it('não guarda o CPF nem o hash da senha que vêm do banco', () => {
    const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });
    const doBanco = { ...profissional, cpf: '12345678901', passwordHash: 'pbkdf2$hash' };

    act(() => result.current.signIn(doBanco));

    expect(result.current.professional).not.toHaveProperty('cpf');
    expect(result.current.professional).not.toHaveProperty('passwordHash');
  });

  it('pode começar com um profissional já autenticado', () => {
    function Nome() {
      const { professional } = useSession();
      return <Text>{professional?.name}</Text>;
    }

    render(
      <SessionProvider initialProfessional={profissional}>
        <Nome />
      </SessionProvider>,
    );

    expect(screen.getByText('Ana Carolina Souza')).toBeOnTheScreen();
  });

  it('avisa quando a sessão é usada fora do provedor', () => {
    const consoleErro = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useSession())).toThrow(
      'useSession precisa ser usado dentro de SessionProvider.',
    );

    consoleErro.mockRestore();
  });

  it('copia só os campos da sessão', () => {
    const copia = toSessionProfessional({ ...profissional, cpf: '1' } as SessionProfessional);

    expect(Object.keys(copia).sort()).toEqual(['crmNumber', 'crmState', 'email', 'id', 'name']);
  });

  it('formata o CRM com a UF', () => {
    expect(formatCrm(profissional)).toBe('12345/DF');
  });
});

describe('volta para o login', () => {
  const roteador = (podeFechar: boolean) => ({
    canDismiss: jest.fn(() => podeFechar),
    dismissAll: jest.fn(),
    replace: jest.fn(),
  });

  it('fecha as telas empilhadas antes de abrir o login', () => {
    const router = roteador(true);

    returnToLogin(router);

    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.dismissAll.mock.invocationCallOrder[0]).toBeLessThan(
      router.replace.mock.invocationCallOrder[0],
    );
  });

  it('só troca a tela quando não há o que fechar', () => {
    const router = roteador(false);

    returnToLogin(router);

    expect(router.dismissAll).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
