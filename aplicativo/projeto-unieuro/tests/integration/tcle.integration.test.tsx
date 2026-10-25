import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import InstructionRoute from '@/app/instrucao';
import ConsentRoute from '@/app/tcle';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { createConsentRepository } from '@/db/consent-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import {
  registrarDecisaoConsentimento,
  verificarAcessoTarefas,
  type AcessoTarefas,
  type RegistrarDecisaoInput,
  type ResultadoDecisao,
} from '@/features/avaliacao/consentimento';
import { TERMO_TCLE, descreverVersao } from '@/features/avaliacao/termo-tcle';

import { desenharNoQuadro, medirQuadro } from '../test-support/desenho';
import {
  ANA,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

// TCLE (#21) de ponta a ponta: a rota, a tela do termo, a assinatura, a regra da
// decisão e o SQLite de verdade, do atendimento recém-registrado até a instrução
// da primeira tarefa. Só a navegação é simulada (jest.setup.ts).

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

// O Skia não gera PNG no Jest; a imagem tem o próprio teste (imagem-desenho.test.ts).
// Aqui vale que os bytes dela chegam ao banco junto com o aceite.
jest.mock('@/features/captura/imagem-desenho', () => ({
  gerarImagemDesenho: jest.fn(() => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
}));

// A composição liga as regras ao banco do aplicativo; aqui, ao banco do teste.
let mockRegistrar: (input: RegistrarDecisaoInput) => Promise<ResultadoDecisao>;
let mockAcesso: (atendimentoId: number) => Promise<AcessoTarefas>;
jest.mock('@/features/avaliacao/composition', () => ({
  get registerConsentDecision() {
    return mockRegistrar;
  },
  get getTaskAccess() {
    return mockAcesso;
  },
}));

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const DATA_HORA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ASSINATURA = [
  [20, 80],
  [90, 40],
  [160, 100],
  [240, 50],
] as const;
const VERSAO = descreverVersao(TERMO_TCLE);

let tablet: TabletComAnaEBruno;
let ana: SessionProfessional;
let atendimentoId: number;

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  ana = { id: tablet.anaId, ...ANA };

  const consentimento = createConsentRepository(async () => tablet.database);
  mockRegistrar = (input) => registrarDecisaoConsentimento(input, consentimento);
  mockAcesso = (id) => verificarAcessoTarefas(id, consentimento);

  const atendimentos = createAttendanceRepository(async () => tablet.database, cpfProtector);
  atendimentoId = (
    await atendimentos.createAttendance({
      patient: {
        name: 'José Alves Martins',
        cpf: '12345678909',
        birthDate: '1948-03-14',
        schoolingYears: 5,
        sex: 'masculino',
      },
      professionalId: ana.id,
      startedAt: '2026-10-25T12:00:00.000Z',
    })
  ).attendanceId;
  definirParametros({ atendimento: String(atendimentoId) });
});

afterEach(async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  await tablet.fechar();
});

function definirParametros(parametros: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(parametros);
}

function abrir(rota: React.ReactElement) {
  return render(<SessionProvider initialProfessional={ana}>{rota}</SessionProvider>);
}

async function abrirTermo() {
  const tela = abrir(<ConsentRoute />);
  await screen.findByText(VERSAO);
  return tela;
}

async function assinar() {
  medirQuadro(520, 160, 'Área de assinatura');
  await desenharNoQuadro(ASSINATURA);
}

const botaoAssinar = () => screen.getByRole('button', { name: 'Assinar e iniciar' });

const primeiraTarefa = () => ({
  pathname: '/instrucao',
  params: { atendimento: String(atendimentoId), tarefa: '1' },
});

const consentimentoGravado = () =>
  tablet.database.getFirstAsync(
    `SELECT versao_tcle, aceito, assinado_por, assinatura_png, data_hora
     FROM consentimento WHERE id_avaliacao = ?`,
    [atendimentoId],
  );

const estadoDaAvaliacao = async () =>
  (
    await tablet.database.getFirstAsync<{ estado: string }>(
      'SELECT estado FROM avaliacao WHERE id = ?',
      [atendimentoId],
    )
  )?.estado;

describe('TCLE do atendimento registrado', () => {
  it('apresentação do termo: mostra o texto e a versão, e nenhuma tarefa abre antes da decisão', async () => {
    await abrirTermo();

    expect(screen.getByRole('header', { name: 'Declaração de consentimento' })).toBeOnTheScreen();
    expect(botaoAssinar()).toBeDisabled();
    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(await estadoDaAvaliacao()).toBe('aguardando_consentimento');
  });

  it('aceite pelo paciente: grava o aceite com a assinatura e abre a instrução da primeira tarefa', async () => {
    const user = userEvent.setup();
    await abrirTermo();

    await assinar();
    await user.press(botaoAssinar());

    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledWith(primeiraTarefa()));
    expect(await consentimentoGravado()).toEqual({
      versao_tcle: TERMO_TCLE.versao,
      aceito: 1,
      assinado_por: 'paciente',
      assinatura_png: PNG,
      data_hora: expect.stringMatching(DATA_HORA_ISO),
    });
    expect(await estadoDaAvaliacao()).toBe('em_andamento');
  });

  it('aceite pelo responsável legal: grava "responsável legal" como quem assinou', async () => {
    const user = userEvent.setup();
    await abrirTermo();

    await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));
    await assinar();
    await user.press(botaoAssinar());

    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledWith(primeiraTarefa()));
    expect(await consentimentoGravado()).toMatchObject({
      aceito: 1,
      assinado_por: 'responsavel_legal',
      assinatura_png: PNG,
    });
    expect(await estadoDaAvaliacao()).toBe('em_andamento');
  });

  it('assinatura obrigatória: sem assinatura, "Assinar e iniciar" fica desabilitado e nada é gravado', async () => {
    const user = userEvent.setup();
    await abrirTermo();
    medirQuadro(520, 160, 'Área de assinatura');

    await user.press(botaoAssinar());

    expect(botaoAssinar()).toBeDisabled();
    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(await consentimentoGravado()).toBeNull();
  });

  it('recusa do termo: grava a recusa, cancela a avaliação e volta ao início sem abrir tarefa', async () => {
    const user = userEvent.setup();
    await abrirTermo();

    await user.press(screen.getByRole('button', { name: 'Recusar' }));
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    await waitFor(() => expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu'));
    expect(await consentimentoGravado()).toEqual({
      versao_tcle: TERMO_TCLE.versao,
      aceito: 0,
      assinado_por: 'paciente',
      assinatura_png: null,
      data_hora: expect.stringMatching(DATA_HORA_ISO),
    });
    expect(await estadoDaAvaliacao()).toBe('cancelada');
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('desistir da recusa: "Voltar" mostra o termo de novo, sem nenhuma decisão gravada', async () => {
    const user = userEvent.setup();
    await abrirTermo();

    await user.press(screen.getByRole('button', { name: 'Recusar' }));
    await user.press(screen.getByRole('button', { name: 'Voltar' }));

    expect(screen.queryByRole('button', { name: 'Confirmar recusa' })).toBeNull();
    expect(botaoAssinar()).toBeOnTheScreen();
    expect(await consentimentoGravado()).toBeNull();
    expect(await estadoDaAvaliacao()).toBe('aguardando_consentimento');
  });

  it('sem decisão: com o aplicativo fechado antes, a avaliação continua aguardando e a instrução não abre', async () => {
    const tela = await abrirTermo();
    await assinar();
    tela.unmount();
    await tablet.reabrir();

    expect(await estadoDaAvaliacao()).toBe('aguardando_consentimento');
    expect(await consentimentoGravado()).toBeNull();

    definirParametros({ atendimento: String(atendimentoId), tarefa: '1' });
    abrir(<InstructionRoute />);

    await waitFor(() =>
      expect(useRouter().replace).toHaveBeenCalledWith({
        pathname: '/tcle',
        params: { atendimento: String(atendimentoId) },
      }),
    );
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull();
  });
});

describe('depois da decisão', () => {
  async function aceitar() {
    const user = userEvent.setup();
    const tela = await abrirTermo();
    await assinar();
    await user.press(botaoAssinar());
    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledWith(primeiraTarefa()));
    tela.unmount();
    jest.mocked(useRouter().replace).mockClear();
  }

  it('o aceite libera a instrução da primeira tarefa', async () => {
    await aceitar();

    definirParametros({ atendimento: String(atendimentoId), tarefa: '1' });
    abrir(<InstructionRoute />);

    expect(await screen.findByText('Tarefa 1 de 3')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Começar' })).toBeOnTheScreen();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('com o aceite gravado, abrir o termo de novo segue direto para a instrução', async () => {
    await aceitar();

    abrir(<ConsentRoute />);

    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledWith(primeiraTarefa()));
    expect(screen.queryByText(VERSAO)).toBeNull();
  });

  it('depois da recusa, a instrução não abre e volta ao início', async () => {
    const user = userEvent.setup();
    const tela = await abrirTermo();
    await user.press(screen.getByRole('button', { name: 'Recusar' }));
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));
    await waitFor(() => expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu'));
    tela.unmount();

    definirParametros({ atendimento: String(atendimentoId), tarefa: '1' });
    abrir(<InstructionRoute />);

    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledWith('/menu'));
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull();
  });
});
