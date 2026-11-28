import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { montarResultado, type ExameComDesenhos } from '@/features/resultado/resultado';
import { FALHA_AO_EXPORTAR } from '@/features/exportacao/exportar-xml-dialog';
import { ONDE_PESOU } from '@/features/resultado/mapa-sobre-o-desenho';
import ResultadoScreen, {
  CARREGANDO,
  FALHA_AO_CARREGAR,
  MODELO_INDISPONIVEL,
  NAO_ENCONTRADO,
  SEM_DESENHO,
  TITULO_MODELO,
  TITULO_RESULTADO,
} from '@/features/resultado/resultado-screen';
import {
  AGUARDANDO_CALCULO,
  CALCULAR_RESULTADO,
  ERRO_ANTERIOR,
  NAO_E_DIAGNOSTICO,
  PESO_NO_ESCORE,
  TEXTO_DO_RASTREIO,
} from '@/features/resultado/resultado-do-modelo';

const ana: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

const exame = (drawings: ExameComDesenhos['drawings']): ExameComDesenhos => ({
  id: 12,
  professionalId: 7,
  startedAt: '2026-11-03T14:00:00',
  state: 'concluida',
  patientName: 'José Alves Martins',
  recordNumber: '2026-0184',
  appliedBy: 'Ana Carolina Souza',
  drawings,
});

const TODOS = exame([
  { tipo: 'relogio', ordem: 1, imagemPng: PNG },
  { tipo: 'cubo', ordem: 2, imagemPng: PNG },
  { tipo: 'trilhas', ordem: 3, imagemPng: PNG },
]);

type Props = Partial<Parameters<typeof ResultadoScreen>[0]>;

function renderizar(props: Props = {}, sessao: SessionProfessional | null = ana) {
  render(
    <SessionProvider initialProfessional={sessao}>
      <ResultadoScreen
        resultado={montarResultado(TODOS)}
        carregando={false}
        falhou={false}
        naoEncontrado={false}
        {...props}
      />
    </SessionProvider>,
  );
}

describe('Cenário: resultado completo', () => {
  it('cada desenho aparece com o seu título, na ordem das tarefas', () => {
    renderizar();

    expect(screen.getByRole('header', { name: TITULO_RESULTADO })).toBeOnTheScreen();
    const imagens = screen.getAllByRole('image');
    expect(imagens.map((imagem) => imagem.props.accessibilityLabel)).toEqual([
      'Desenho: Relógio',
      'Desenho: Cubo',
      'Desenho: Trilhas',
    ]);
    expect(imagens[0].props.source.uri.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('mostra o paciente, a ficha, a data e quem aplicou', () => {
    renderizar();

    expect(screen.getByText('José Alves Martins · Ficha 2026-0184')).toBeOnTheScreen();
    expect(screen.getByText(/Aplicado por Ana Carolina Souza/)).toBeOnTheScreen();
  });

  it('o resultado do modelo fica num lugar só, para o exame inteiro', () => {
    renderizar({ modelo: <Text>Probabilidade de CCL: 30%</Text> });

    expect(screen.getByRole('header', { name: TITULO_MODELO })).toBeOnTheScreen();
    expect(screen.getByText('Probabilidade de CCL: 30%')).toBeOnTheScreen();
    expect(screen.queryByText(MODELO_INDISPONIVEL)).toBeNull();
  });

  it('enquanto o modelo não grava o resultado, avisa que ele ainda não está disponível', () => {
    renderizar();

    expect(screen.getByText(MODELO_INDISPONIVEL)).toBeOnTheScreen();
  });

  it('cada desenho tem o espaço do que mais pesou na pontuação', () => {
    renderizar({ influencia: (desenho) => <Text>{`Influência: ${desenho.titulo}`}</Text> });

    for (const titulo of ['Relógio', 'Cubo', 'Trilhas']) {
      expect(screen.getByText(`Influência: ${titulo}`)).toBeOnTheScreen();
    }
  });

  it('um desenho que não foi gravado aparece como tal, sem quebrar a tela', () => {
    renderizar({
      resultado: montarResultado(exame([{ tipo: 'relogio', ordem: 1, imagemPng: PNG }])),
    });

    expect(screen.getAllByRole('image')).toHaveLength(1);
    expect(screen.getAllByText(SEM_DESENHO)).toHaveLength(2);
  });
});

describe('estados da tela', () => {
  it('mostra o carregamento', () => {
    renderizar({ resultado: null, carregando: true });

    expect(screen.getByText(CARREGANDO)).toBeOnTheScreen();
  });

  it('avisa o exame não encontrado, que inclui o de outro médico', () => {
    renderizar({ resultado: null, naoEncontrado: true });

    expect(screen.getByRole('alert')).toHaveTextContent(NAO_ENCONTRADO);
  });

  it('avisa a falha ao carregar', () => {
    renderizar({ resultado: null, falhou: true });

    expect(screen.getByRole('alert')).toHaveTextContent(FALHA_AO_CARREGAR);
  });

  it('sem resultado e sem aviso, fica só o topo', () => {
    renderizar({ resultado: null });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen();
  });
});

describe('navegação e acesso', () => {
  it('"Voltar" leva à tela anterior', async () => {
    renderizar();

    await userEvent.setup().press(screen.getByRole('button', { name: 'Voltar' }));

    expect(useRouter().back).toHaveBeenCalled();
  });

  it('sem sessão, volta ao login e não mostra o exame', () => {
    renderizar({}, null);

    expect(screen.queryByRole('header', { name: TITULO_RESULTADO })).toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });

  it('no tablet deitado, usa as margens largas', () => {
    renderizar();

    fireEvent(screen.getByTestId('tela-resultado'), 'layout', {
      nativeEvent: { layout: { width: 1280, height: 800 } },
    });

    const conteudo = StyleSheet.flatten(
      screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle,
    );
    expect(conteudo.paddingHorizontal).toBe(40);
  });
});

describe('exportar XML do exame (#22)', () => {
  it('mostra o botão para quem aplicou e exporta o exame após confirmar', async () => {
    const exportExam = jest.fn(async () => ({
      estado: 'salvo' as const,
      arquivo: 'exame_12_2026-11-12_1430.xml',
      pacientes: 1,
      exames: 1,
    }));
    renderizar({ exportExam });

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Exportar exame (XML)' }));
    expect(screen.getByRole('header', { name: 'Exportar este exame' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));
    expect(exportExam).toHaveBeenCalledWith(expect.objectContaining(ana), 12);
    expect(
      await screen.findByText('Arquivo salvo: exame_12_2026-11-12_1430.xml'),
    ).toBeOnTheScreen();
  });

  it('se o profissional desiste da pasta, o diálogo continua aberto e nada é salvo', async () => {
    const exportExam = jest.fn(async () => ({ estado: 'cancelado' as const }));
    renderizar({ exportExam });

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Exportar exame (XML)' }));
    await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));

    expect(exportExam).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('header', { name: 'Exportar este exame' })).toBeOnTheScreen();
    expect(screen.queryByText(/Arquivo salvo/)).toBeNull();
  });

  it('se salvar falhar, mostra o erro e mantém o diálogo para tentar de novo', async () => {
    const exportExam = jest.fn(async () => {
      throw new Error('disco cheio');
    });
    renderizar({ exportExam });

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Exportar exame (XML)' }));
    await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));

    expect(await screen.findByText(FALHA_AO_EXPORTAR)).toBeOnTheScreen();
    expect(screen.queryByText(/Arquivo salvo/)).toBeNull();
  });

  it('não mostra o botão quando outro profissional (ex.: superusuário) abre o exame', () => {
    const superusuario: SessionProfessional = {
      id: 99,
      name: 'Carlos Bernardo Tauil',
      email: 'carlos@neurosinapse.med.br',
      crmNumber: '12771',
      crmState: 'DF',
      superuser: true,
    };
    renderizar({ exportExam: jest.fn() }, superusuario);
    expect(screen.queryByRole('button', { name: 'Exportar exame (XML)' })).toBeNull();
  });
});

describe('Cenário: resultado do modelo no tablet (#12)', () => {
  const mapa = new Float32Array(64);
  const COM_MODELO: ExameComDesenhos = {
    ...TODOS,
    model: {
      probability: 0.912,
      contributions: { relogio: 1, cubo: -1, trilhas: 2 },
      maps: { relogio: mapa, cubo: mapa, trilhas: mapa },
      modelVersion: 'vgg16-semente1-v1.6',
      durationMs: 2140,
      calculatedAt: '2026-11-03T14:05:00.000Z',
    },
  };

  it('mostra a probabilidade com duas casas, a classe prevista e o aviso de que não é diagnóstico', () => {
    renderizar({ resultado: montarResultado(COM_MODELO) });

    expect(screen.getByText(NAO_E_DIAGNOSTICO)).toBeOnTheScreen();
    expect(screen.getByText('0,91')).toBeOnTheScreen();
    expect(screen.getByText('Classe prevista · CCL')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO_DO_RASTREIO)).toBeOnTheScreen();
    expect(screen.queryByText(/vgg16|Calculado no tablet/)).toBeNull();
    expect(screen.queryByText(MODELO_INDISPONIVEL)).toBeNull();
  });

  it('cada desenho mostra quanto pesou no escore e para que lado', () => {
    renderizar({ resultado: montarResultado(COM_MODELO) });

    expect(screen.getAllByText(PESO_NO_ESCORE)).toHaveLength(3);
    expect(screen.getByText('25 % do peso · puxou o escore para CCL')).toBeOnTheScreen();
    expect(screen.getByText('25 % do peso · puxou o escore para sem CCL')).toBeOnTheScreen();
    expect(screen.getByText('50 % do peso · puxou o escore para CCL')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Peso do relógio no escore: 25 %, puxou o escore para CCL'),
    ).toBeOnTheScreen();
  });

  it('o exame que ainda espera o modelo oferece o cálculo', async () => {
    const user = userEvent.setup();
    renderizar({ resultado: montarResultado({ ...TODOS, state: 'processando_resultado' }) });

    expect(screen.getByText(AGUARDANDO_CALCULO)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: CALCULAR_RESULTADO }));

    expect(useRouter().replace).toHaveBeenCalledWith('/analise/12');
  });

  it('depois de um erro no cálculo, avisa e oferece calcular de novo', () => {
    renderizar({ resultado: montarResultado({ ...TODOS, state: 'erro_inferencia' }) });

    expect(screen.getByText(ERRO_ANTERIOR)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: CALCULAR_RESULTADO })).toBeOnTheScreen();
  });
});

describe('Cenário: resultado completo, com onde cada desenho pesou (#14)', () => {
  const QUADRADO = [
    { tipo: 'inicio', ordem: 1, instante: 0, x: 100, y: 100, ponteiro: 'caneta' },
    { tipo: 'ponto', ordem: 2, instante: 16, x: 323, y: 323, ponteiro: 'caneta' },
  ] as const;
  const mapa = new Float32Array(64);
  mapa[9] = 2;
  const traco = { largura: 960, altura: 600, eventos: QUADRADO };
  const COM_MAPA: ExameComDesenhos = {
    ...TODOS,
    model: {
      probability: 0.912,
      contributions: { relogio: 1, cubo: -1, trilhas: 2 },
      maps: { relogio: mapa, cubo: new Float32Array(64), trilhas: mapa },
      modelVersion: 'vgg16-semente1-v1.7',
      durationMs: 2140,
      calculatedAt: '2026-11-03T14:05:00.000Z',
    },
    traces: { relogio: traco, cubo: traco, trilhas: traco },
  };
  const DESTAQUE =
    'O trecho que mais puxou o escore para CCL fica na parte de cima, à esquerda do desenho.';

  it('mostra sobre o desenho onde ele pesou, com a posição em texto', () => {
    renderizar({ resultado: montarResultado(COM_MAPA) });

    expect(screen.getAllByText(ONDE_PESOU)).toHaveLength(2);
    expect(screen.getAllByText(DESTAQUE)).toHaveLength(2);
    expect(screen.getByLabelText(`Desenho: Relógio. ${DESTAQUE}`)).toBeOnTheScreen();
    // O cubo tem o mapa todo zero: fica só a imagem e o peso no escore.
    expect(screen.getByLabelText('Desenho: Cubo')).toBeOnTheScreen();
    expect(screen.getAllByText(PESO_NO_ESCORE)).toHaveLength(3);
  });

  it('sem o traçado, o desenho aparece sem o mapa', () => {
    renderizar({ resultado: montarResultado({ ...COM_MAPA, traces: undefined }) });

    expect(screen.queryByText(ONDE_PESOU)).toBeNull();
    expect(screen.getByLabelText('Desenho: Relógio')).toBeOnTheScreen();
  });
});
