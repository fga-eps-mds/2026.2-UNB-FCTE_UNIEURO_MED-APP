import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { montarResultado, type ExameComDesenhos } from '@/features/resultado/resultado';
import { FALHA_AO_EXPORTAR } from '@/features/exportacao/exportar-xml-dialog';
import ResultadoScreen, {
  CARREGANDO,
  FALHA_AO_CARREGAR,
  MODELO_INDISPONIVEL,
  NAO_ENCONTRADO,
  SEM_DESENHO,
  TITULO_MODELO,
  TITULO_RESULTADO,
} from '@/features/resultado/resultado-screen';

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
