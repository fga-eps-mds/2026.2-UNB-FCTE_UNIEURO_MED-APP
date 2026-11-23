import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import {
  FALHA_NO_CALCULO,
  SEM_MODELO_NO_APK,
  type AnaliseRepository,
  type DependenciasDaAnalise,
  type ExameParaAnalise,
} from '@/features/inferencia/analise';
import AnaliseScreen, {
  ETAPA_DO_EXAME,
  ITENS_DA_ANALISE,
  NAO_ENCONTRADO,
  SEM_DADO_SAINDO,
  TENTAR_DE_NOVO,
  TITULO_ANALISE,
  VER_DESENHOS,
} from '@/features/inferencia/analise-screen';
import { LADO_DO_MAPA } from '@/features/inferencia/escore';

jest.mock('@/features/inferencia/preparo-desenho', () => ({
  prepararDesenho: jest.fn(() => new Float32Array(1)),
}));

const ana: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const traco = [
  { tipo: 'inicio' as const, ordem: 1, instante: 0, x: 1, y: 1, ponteiro: 'caneta' as const },
];
const EXAME: ExameParaAnalise = {
  id: 42,
  state: 'processando_resultado',
  patientName: 'José Alves Martins',
  recordNumber: '2026-0184',
  events: { relogio: traco, cubo: traco, trilhas: traco },
};

const mapa = () => new Float32Array(LADO_DO_MAPA * LADO_DO_MAPA).fill(0.5);
const SAIDAS = {
  probabilidade: 0.6,
  contribuicoes: { relogio: 0.1, cubo: 0.2, trilhas: 0.3 },
  mapas: { relogio: mapa(), cubo: mapa(), trilhas: mapa() },
};

function dependencias(exame: ExameParaAnalise | null = EXAME) {
  const repository: AnaliseRepository = {
    findExamForAnalysis: jest.fn(async () => exame),
    saveResult: jest.fn(async () => true),
    markError: jest.fn(async () => undefined),
  };
  const avaliar = jest.fn(async () => SAIDAS);
  const deps: DependenciasDaAnalise = {
    repository,
    carregarModelo: jest.fn(async () => ({ versao: 'v1.6', modelo: { avaliar } })),
  };
  return { deps, repository, avaliar };
}

function renderizar(deps: DependenciasDaAnalise, exameId: number | null = 42) {
  render(
    <SessionProvider initialProfessional={ana}>
      <AnaliseScreen exameId={exameId} dependencias={deps} />
    </SessionProvider>,
  );
}

describe('Cenário: escore sem internet', () => {
  it('mostra o checklist do protótipo e abre o resultado quando o cálculo termina', async () => {
    const { deps, repository } = dependencias();

    renderizar(deps);

    expect(screen.getByRole('header', { name: TITULO_ANALISE })).toBeOnTheScreen();
    expect(screen.getByText(ETAPA_DO_EXAME)).toBeOnTheScreen();
    expect(screen.getByText(SEM_DADO_SAINDO)).toBeOnTheScreen();
    for (const item of ITENS_DA_ANALISE) {
      expect(screen.getByText(item)).toBeOnTheScreen();
    }
    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledWith('/resultado/42'));
    expect(repository.findExamForAnalysis).toHaveBeenCalledWith(ana.id, 42);
    expect(screen.getByText('José Alves Martins · Ficha 2026-0184')).toBeOnTheScreen();
  });

  it('o primeiro item já aparece concluído quando a tela abre', async () => {
    const { deps } = dependencias();

    renderizar(deps);

    expect(screen.getByLabelText(`${ITENS_DA_ANALISE[0]}: concluído`)).toBeOnTheScreen();
    await waitFor(() => expect(useRouter().replace).toHaveBeenCalled());
  });

  it('a tela aberta de novo acompanha o cálculo em andamento, sem rodar o modelo outra vez', async () => {
    const { deps, avaliar } = dependencias();

    renderizar(deps);
    renderizar(deps);

    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledTimes(2));
    expect(avaliar).toHaveBeenCalledTimes(1);
  });
});

describe('falhas', () => {
  it('avisa o erro e calcula de novo quando o profissional pede', async () => {
    const { deps, avaliar } = dependencias();
    avaliar.mockRejectedValueOnce(new Error('sessão fechada'));
    const user = userEvent.setup();
    renderizar(deps);

    expect(await screen.findByText(FALHA_NO_CALCULO)).toBeOnTheScreen();
    expect(useRouter().replace).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: TENTAR_DE_NOVO }));

    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledWith('/resultado/42'));
    expect(avaliar).toHaveBeenCalledTimes(2);
  });

  it('sem o modelo no APK, avisa e deixa ver os desenhos, sem oferecer o novo cálculo', async () => {
    const { deps } = dependencias();
    const { ModeloAusenteError } = jest.requireActual<
      typeof import('@/features/inferencia/arquivo-do-modelo')
    >('@/features/inferencia/arquivo-do-modelo');
    jest.mocked(deps.carregarModelo).mockRejectedValue(new ModeloAusenteError());
    const user = userEvent.setup();
    renderizar(deps);

    expect(await screen.findByText(SEM_MODELO_NO_APK)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: TENTAR_DE_NOVO })).toBeNull();
    await user.press(screen.getByRole('button', { name: VER_DESENHOS }));
    expect(useRouter().replace).toHaveBeenCalledWith('/resultado/42');
  });

  it('avisa quando a leitura do exame falha', async () => {
    const { deps, repository } = dependencias();
    jest.mocked(repository.findExamForAnalysis).mockRejectedValue(new Error('banco fechado'));

    renderizar(deps);

    expect(await screen.findByText('Não foi possível ler o exame no tablet.')).toBeOnTheScreen();
  });

  it('não encontra o exame de outro médico', async () => {
    const { deps } = dependencias(null);

    renderizar(deps);

    expect(await screen.findByText(NAO_ENCONTRADO)).toBeOnTheScreen();
  });

  it('não procura nada com um número de exame inválido', () => {
    const { deps, repository } = dependencias();

    renderizar(deps, null);

    expect(screen.getByText(NAO_ENCONTRADO)).toBeOnTheScreen();
    expect(repository.findExamForAnalysis).not.toHaveBeenCalled();
  });
});

it('volta ao login sem profissional na sessão', () => {
  const { deps } = dependencias();

  render(
    <SessionProvider initialProfessional={null}>
      <AnaliseScreen exameId={42} dependencias={deps} />
    </SessionProvider>,
  );

  expect(screen.queryByText(TITULO_ANALISE)).toBeNull();
});
