/**
 * Preparo comum a todos os testes.
 *
 * Substitui as dependências que só funcionam dentro do aplicativo em execução:
 * navegação, fontes e tela de abertura. Nenhum teste pode depender de rede, de
 * aparelho físico ou de dado real de paciente, conforme o `CONTRIBUTING.md`.
 */

// Rotas e navegação. As funções são compartilhadas entre `useRouter` e
// `router`, para que um teste possa afirmar sobre a navegação de qualquer uma
// das duas formas. O nome precisa começar com `mock`: o Jest içá as chamadas de
// `jest.mock` para o topo do arquivo e só libera o factory a referenciar
// variáveis externas com esse prefixo.
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  router: mockRouter,
  Stack: 'Stack',
  Link: 'Link',
}));

// As fontes do Inter são carregadas de forma assíncrona no aplicativo. Nos
// testes elas já entram como carregadas, senão o layout raiz não renderiza.
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// A área segura depende de medidas do aparelho. O próprio pacote fornece um
// substituto para testes. Ele usa `export default`, então é o `.default` que
// carrega os componentes; sem isso o `SafeAreaView` chega indefinido às telas.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

afterEach(() => {
  jest.clearAllMocks();
});
