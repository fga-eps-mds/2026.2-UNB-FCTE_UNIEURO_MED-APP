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
  canDismiss: jest.fn(() => false),
  dismissAll: jest.fn(),
  dismissTo: jest.fn(),
};

// O `useFocusEffect` roda o efeito como um `useEffect`. Para simular a volta do
// foco, o teste chama de novo o último efeito recebido pelo mock.
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  router: mockRouter,
  useFocusEffect: jest.fn((effect: () => void | (() => void)) =>
    require('react').useEffect(effect, [effect]),
  ),
  // Nenhum parâmetro por padrão. O teste de uma rota define os dele com
  // `jest.mocked(useLocalSearchParams).mockReturnValue(...)`.
  useLocalSearchParams: jest.fn(() => ({})),
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
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Gestos, animações e desenho do quadro (#9). O Gesture Handler, o Reanimated e o
// Worklets dependem de módulos nativos; os substitutos que os próprios pacotes
// oferecem rodam os worklets na mesma thread do teste, então o descompasso entre
// as threads do aparelho não aparece aqui.
require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));

// O Skia desenha em código nativo, que não existe no Jest. O substituto
// renderiza o quadro sem pixels e só chama a montagem do caminho na
// renderização, quando ainda não há ponto em andamento: o traço em andamento só
// é verificado no aparelho. Um teste que precise de mais do Skia, como a geração
// da imagem do desenho, declara o próprio `jest.mock` no arquivo.
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Circle: 'Circle',
  Group: 'Group',
  Path: 'Path',
  Text: 'SkiaText',
  matchFont: jest.fn(() => ({
    measureText: jest.fn(() => ({ x: 0, y: -14, width: 12, height: 14 })),
  })),
  Skia: { Path: { MakeFromSVGString: jest.fn((svg: string) => ({ svg })) } },
  usePathValue: (montar: (construtor: unknown) => void) => {
    const construtor = { moveTo: jest.fn(), lineTo: jest.fn() };
    montar(construtor);
    return { value: construtor };
  },
}));

afterEach(() => {
  jest.clearAllMocks();
});
