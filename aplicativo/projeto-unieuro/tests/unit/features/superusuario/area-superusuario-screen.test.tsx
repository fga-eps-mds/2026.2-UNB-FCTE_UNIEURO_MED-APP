import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import AreaSuperusuarioScreen, {
  BOTAO_EXAMES_DE_TODOS,
  PERFIL_SUPERUSUARIO,
  SUBTITULO_AREA,
  TITULO_AREA,
} from '@/features/superusuario/area-superusuario-screen';

const medico: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};
const superusuario: SessionProfessional = {
  id: 1,
  name: 'Carlos Bernardo Tauil',
  email: 'carlos.tauil@unieuro.com.br',
  crmNumber: '12771',
  crmState: 'DF',
  superuser: true,
};

function renderizar(sessao: SessionProfessional | null, conteudo?: string) {
  render(
    <SessionProvider initialProfessional={sessao}>
      <AreaSuperusuarioScreen>{conteudo ? <Text>{conteudo}</Text> : null}</AreaSuperusuarioScreen>
    </SessionProvider>,
  );
}

const titulo = () => screen.queryByRole('header', { name: TITULO_AREA });

describe('Cenário: acesso à área administrativa', () => {
  it('o superusuário vê a área, com o perfil no topo e as funcionalidades dele', () => {
    renderizar(superusuario);

    expect(titulo()).toBeOnTheScreen();
    expect(screen.getByText(SUBTITULO_AREA)).toBeOnTheScreen();
    expect(screen.getByText('Carlos Bernardo Tauil')).toBeOnTheScreen();
    expect(screen.getByText(PERFIL_SUPERUSUARIO)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: BOTAO_EXAMES_DE_TODOS })).toBeOnTheScreen();
  });

  it('mostra o gerenciamento das contas que a rota coloca na área', () => {
    renderizar(superusuario, 'Médicos cadastrados');

    expect(screen.getByText('Médicos cadastrados')).toBeOnTheScreen();
  });

  it('"Ver exames de todos" volta à tela inicial, que lista os pacientes de todos', async () => {
    renderizar(superusuario);

    await userEvent.setup().press(screen.getByRole('button', { name: BOTAO_EXAMES_DE_TODOS }));

    expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu');
  });

  it('o topo leva ao início, às configurações e sai do aplicativo', async () => {
    renderizar(superusuario);
    const usuario = userEvent.setup();

    await usuario.press(screen.getByRole('button', { name: 'Voltar ao início' }));
    // Vai direto ao início, e não à tela anterior, que pode ser Configurações (revisão do #131).
    expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu');
    expect(useRouter().back).not.toHaveBeenCalled();

    await usuario.press(screen.getByRole('button', { name: 'Configurações' }));
    expect(useRouter().push).toHaveBeenCalledWith('/settings');

    await usuario.press(screen.getByRole('button', { name: 'Sair' }));
    expect(titulo()).toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });
});

describe('layout da área', () => {
  it('no tablet deitado, usa as margens largas da tela inicial', () => {
    renderizar(superusuario);

    fireEvent(screen.getByTestId('area-superusuario'), 'layout', {
      nativeEvent: { layout: { width: 1280, height: 800 } },
    });

    const conteudo = StyleSheet.flatten(
      screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle,
    );
    expect(conteudo.paddingHorizontal).toBe(40);
  });
});

describe('Cenário: acesso de um profissional comum', () => {
  it('impede o médico comum de abrir a área, mesmo pela rota, e volta à tela inicial', () => {
    renderizar(medico, 'Médicos cadastrados');

    expect(titulo()).toBeNull();
    expect(screen.queryByText('Médicos cadastrados')).toBeNull();
    expect(screen.queryByRole('button', { name: BOTAO_EXAMES_DE_TODOS })).toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });

  it('sem sessão, volta ao login', () => {
    renderizar(null);

    expect(titulo()).toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });
});

describe('Cenário: uso sem internet', () => {
  const fetchOriginal = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it('a área abre e funciona sem rede, porque nada nela depende de conexão', async () => {
    const semRede = jest.fn(() => Promise.reject(new Error('sem internet')));
    globalThis.fetch = semRede as unknown as typeof fetch;

    renderizar(superusuario);
    await userEvent.setup().press(screen.getByRole('button', { name: BOTAO_EXAMES_DE_TODOS }));

    expect(titulo()).toBeOnTheScreen();
    expect(screen.getByText(SUBTITULO_AREA)).toHaveTextContent(/sem internet/);
    expect(semRede).not.toHaveBeenCalled();
  });
});
