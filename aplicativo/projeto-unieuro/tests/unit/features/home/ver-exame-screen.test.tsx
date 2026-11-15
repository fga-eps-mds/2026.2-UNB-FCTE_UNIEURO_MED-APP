import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import {
  RESULTADO_INDISPONIVEL,
  SEM_ANALISE,
  type DesenhoDaConsulta,
  type ExameDaConsulta,
} from '@/features/home/exame';
import type { EstadoDoExame } from '@/features/home/use-exame';
import VerExameScreen, {
  CARREGANDO_EXAME,
  EXAME_NAO_ENCONTRADO,
  FALHA_AO_CARREGAR,
} from '@/features/home/ver-exame-screen';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 800, height: 1280, scale: 1, fontScale: 1 })),
}));

function naLargura(width: number) {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
}

afterEach(() => naLargura(800));

const profissional: SessionProfessional = {
  id: 1,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const desenho = (ordem: number, nome: string, gravado: boolean): DesenhoDaConsulta => ({
  ordem,
  tipo: (['relogio', 'cubo', 'trilhas'] as const)[ordem - 1],
  nome,
  imagemUri: gravado ? `data:image/png;base64,AAA${ordem}` : null,
  confirmadoAs: gravado ? `14:3${ordem}` : null,
});

const concluido: ExameDaConsulta = {
  id: 12,
  pacienteNome: 'José Alves Martins',
  numeroFicha: '2026-0184',
  profissionalNome: 'Ana Carolina Souza',
  data: '05/10/2026',
  hora: '14:32',
  situacao: 'concluido',
  situacaoTexto: 'Concluído',
  desenhos: [desenho(1, 'Relógio', true), desenho(2, 'Cubo', true), desenho(3, 'Trilhas', true)],
  desenhosGravados: 3,
  resultado: RESULTADO_INDISPONIVEL,
};

const interrompido: ExameDaConsulta = {
  ...concluido,
  situacao: 'interrompido',
  situacaoTexto: 'Interrompido',
  desenhos: [desenho(1, 'Relógio', true), desenho(2, 'Cubo', false), desenho(3, 'Trilhas', false)],
  desenhosGravados: 1,
  resultado: SEM_ANALISE,
};

function renderTela(estado: EstadoDoExame, sessao: SessionProfessional | null = profissional) {
  return render(
    <SessionProvider initialProfessional={sessao}>
      <VerExameScreen estado={estado} />
    </SessionProvider>,
  );
}

describe('Cenário: consultar uma avaliação salva', () => {
  it('mostra os dados do exame selecionado', () => {
    renderTela({ status: 'pronto', exame: concluido });

    expect(screen.getByRole('header', { name: 'Exame de 05/10/2026 às 14:32' })).toBeTruthy();
    expect(screen.getByText('Concluído')).toBeTruthy();
    expect(screen.getByText('José Alves Martins')).toBeTruthy();
    expect(screen.getByText('2026-0184')).toBeTruthy();
    expect(screen.getAllByText('Ana Carolina Souza').length).toBeGreaterThan(0);
  });

  it('mostra os três desenhos gravados, com o nome da tarefa e a imagem do banco', () => {
    renderTela({ status: 'pronto', exame: concluido });

    expect(screen.getByText('3 de 3 desenhos gravados neste tablet.')).toBeTruthy();
    for (const [ordem, nome] of [
      [1, 'Relógio'],
      [2, 'Cubo'],
      [3, 'Trilhas'],
    ] as const) {
      const imagem = screen.getByRole('image', { name: `Desenho: ${nome}` });
      expect(imagem.props.source).toEqual({ uri: `data:image/png;base64,AAA${ordem}` });
      expect(screen.getByText(`${ordem}. ${nome}`)).toBeTruthy();
      expect(screen.getByText(`Confirmado às 14:3${ordem}`)).toBeTruthy();
    }
  });

  it('não mostra resultado do modelo, só o aviso de que ele ainda não está disponível', () => {
    renderTela({ status: 'pronto', exame: concluido });

    expect(screen.getByRole('header', { name: 'Resultado' })).toBeTruthy();
    expect(screen.getByText(RESULTADO_INDISPONIVEL)).toBeTruthy();
  });

  it('no exame interrompido, mostra o desenho salvo e as tarefas não realizadas', () => {
    renderTela({ status: 'pronto', exame: interrompido });

    expect(screen.getByText('Interrompido')).toBeTruthy();
    expect(screen.getByText('1 de 3 desenhos gravados neste tablet.')).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Desenho: Relógio' })).toBeTruthy();
    expect(screen.queryByRole('image', { name: 'Desenho: Cubo' })).toBeNull();
    expect(screen.getByLabelText('Cubo: não realizado')).toBeTruthy();
    expect(screen.getByLabelText('Trilhas: não realizado')).toBeTruthy();
    expect(screen.getByText(SEM_ANALISE)).toBeTruthy();
  });

  it('mostra o exame que ainda não terminou como em andamento', () => {
    renderTela({
      status: 'pronto',
      exame: { ...interrompido, situacao: null, situacaoTexto: 'Em andamento' },
    });

    expect(screen.getByText('Em andamento')).toBeTruthy();
  });

  it('mostra a mesma tela também na largura do tablet deitado', () => {
    naLargura(1280);

    renderTela({ status: 'pronto', exame: concluido });

    expect(screen.getAllByRole('image')).toHaveLength(3);
  });
});

describe('enquanto não há exame para mostrar', () => {
  it('avisa que está carregando', () => {
    renderTela({ status: 'carregando' });

    expect(screen.getByLabelText(CARREGANDO_EXAME)).toBeTruthy();
  });

  it('avisa quando a leitura do exame falhou', () => {
    renderTela({ status: 'falhou' });

    expect(screen.getByText(FALHA_AO_CARREGAR)).toBeTruthy();
  });

  it('avisa quando o exame não foi encontrado entre os do profissional', () => {
    renderTela({ status: 'nao-encontrado' });

    expect(screen.getByRole('header', { name: EXAME_NAO_ENCONTRADO })).toBeTruthy();
    expect(screen.queryByRole('image')).toBeNull();
  });
});

describe('área do profissional', () => {
  it('mostra quem está autenticado no topo', () => {
    renderTela({ status: 'carregando' });

    expect(screen.getByText('Ana Carolina Souza')).toBeTruthy();
    expect(screen.getByText('CRM 12345/DF')).toBeTruthy();
  });

  it('volta para a tela anterior pelo botão Voltar', async () => {
    renderTela({ status: 'pronto', exame: concluido });

    await userEvent.press(screen.getByRole('button', { name: 'Voltar' }));

    expect(useRouter().back).toHaveBeenCalled();
  });

  it('sem profissional autenticado, não mostra o exame e volta ao login', () => {
    renderTela({ status: 'pronto', exame: concluido }, null);

    expect(screen.queryByText('José Alves Martins')).toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });
});
