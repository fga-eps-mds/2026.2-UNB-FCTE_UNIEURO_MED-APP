import { act, render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import ConsentRoute from '@/app/tcle';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { SessionProvider } from '@/features/auth/session';
import { TERMO_TCLE } from '@/features/avaliacao/termo-tcle';
import { gerarImagemDesenho } from '@/features/captura/imagem-desenho';

import { desenharNoQuadro, medirQuadro } from '../test-support/desenho';
import {
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockTablet: TabletComAnaEBruno;

jest.mock('@/features/avaliacao/composition', () => {
  const { createConsentRepository } = jest.requireActual('@/db/consent-repository');
  const { createAttendanceRepository: criarAtendimentos } = jest.requireActual(
    '@/db/attendance-repository',
  );
  const regra = jest.requireActual('@/features/avaliacao/consentimento');
  const abrir = () => Promise.resolve(mockTablet.database);
  const consentimento = createConsentRepository(abrir);
  const atendimentos = criarAtendimentos(abrir);

  return {
    registerConsentDecision: (input: unknown) =>
      regra.registrarDecisaoConsentimento(input, consentimento),
    getTaskAccess: (id: number) => regra.verificarAcessoTarefas(id, consentimento),
    getAttendancePatient: (id: number) => atendimentos.findPatientOfAttendance(id),
  };
});

jest.mock('@/features/captura/imagem-desenho', () => ({ gerarImagemDesenho: jest.fn() }));

const ASSINATURA_PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

type LinhaConsentimento = {
  id_avaliacao: number;
  versao_tcle: string;
  aceito: number;
  assinado_por: string;
  assinatura_png: Uint8Array | null;
  data_hora: string;
  autoriza_imagens_pesquisa: number | null;
  autoriza_dados_pesquisa_futura: number | null;
};

async function criarAtendimento(nome: string, cpf: string) {
  const atendimentos = createAttendanceRepository(async () => mockTablet.database, cpfProtector);
  return (
    await atendimentos.createAttendance({
      patient: { name: nome, cpf, birthDate: '1948-03-14', schoolingYears: 5, sex: 'masculino' },
      professionalId: mockTablet.anaId,
      startedAt: '2026-10-25T12:00:00.000Z',
    })
  ).attendanceId;
}

const consentimentoDe = (atendimentoId: number) =>
  mockTablet.database.getFirstAsync<LinhaConsentimento>(
    'SELECT * FROM consentimento WHERE id_avaliacao = ?',
    [atendimentoId],
  );

const estadoDe = async (atendimentoId: number) =>
  (
    await mockTablet.database.getFirstAsync<{ estado: string }>(
      'SELECT estado FROM avaliacao WHERE id = ?',
      [atendimentoId],
    )
  )?.estado;

async function abrirTermo(atendimentoId: number) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ atendimento: String(atendimentoId) });
  render(
    <SessionProvider
      initialProfessional={{
        id: mockTablet.anaId,
        name: 'Ana Carolina Souza',
        email: 'ana.souza@unieuro.com.br',
        crmNumber: '12345',
        crmState: 'DF',
      }}>
      <ConsentRoute />
    </SessionProvider>,
  );
  await act(async () => {});
  return userEvent.setup();
}

beforeEach(async () => {
  mockTablet = await abrirTabletComAnaEBruno();
  jest.mocked(gerarImagemDesenho).mockReturnValue(ASSINATURA_PNG);
});

afterEach(async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  await mockTablet.fechar();
});

describe('cabeçalho do termo', () => {
  it('mostra o nome e a ficha do paciente do exame, como estão no banco', async () => {
    const atendimentoId = await criarAtendimento('José Alves Martins', '52998224725');

    await abrirTermo(atendimentoId);

    expect(await screen.findByText('José Alves Martins · Ficha 2026-0001')).toBeOnTheScreen();
  });

  it('acompanha o paciente de cada exame', async () => {
    await criarAtendimento('José Alves Martins', '52998224725');
    const segundo = await criarAtendimento('Maria das Graças Lima', '11144477735');

    await abrirTermo(segundo);

    expect(await screen.findByText('Maria das Graças Lima · Ficha 2026-0002')).toBeOnTheScreen();
    expect(screen.queryByText(/José Alves Martins/)).toBeNull();
  });
});

describe('Cenário: recusa do termo', () => {
  it('grava a decisão "recusa", a versão do termo, a data e a hora, e cancela a avaliação', async () => {
    const atendimentoId = await criarAtendimento('José Alves Martins', '52998224725');
    const user = await abrirTermo(atendimentoId);
    expect(await estadoDe(atendimentoId)).toBe('aguardando_consentimento');

    await user.press(screen.getByRole('button', { name: 'Recusar' }));
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    const consentimento = await consentimentoDe(atendimentoId);
    expect(consentimento).toMatchObject({
      aceito: 0,
      versao_tcle: TERMO_TCLE.versao,
      assinado_por: 'paciente',
      assinatura_png: null,
    });
    expect(Math.abs(Date.parse(consentimento!.data_hora) - Date.now())).toBeLessThan(60_000);
    expect(await estadoDe(atendimentoId)).toBe('cancelada');
    expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu');
  });

  it('desistir da recusa não grava nada e mantém a avaliação aguardando', async () => {
    const atendimentoId = await criarAtendimento('José Alves Martins', '52998224725');
    const user = await abrirTermo(atendimentoId);

    await user.press(screen.getByRole('button', { name: 'Recusar' }));
    await user.press(screen.getByRole('button', { name: 'Voltar' }));

    expect(await consentimentoDe(atendimentoId)).toBeNull();
    expect(await estadoDe(atendimentoId)).toBe('aguardando_consentimento');
  });

  it('depois da recusa, o termo não abre de novo e volta ao menu', async () => {
    const atendimentoId = await criarAtendimento('José Alves Martins', '52998224725');
    const user = await abrirTermo(atendimentoId);
    await user.press(screen.getByRole('button', { name: 'Recusar' }));
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));
    screen.unmount();
    jest.mocked(useRouter().dismissTo).mockClear();

    await abrirTermo(atendimentoId);

    expect(screen.queryByRole('button', { name: 'Assinar e iniciar' })).toBeNull();
    expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu');
  });
});

describe('Cenário: aceite do termo', () => {
  it('grava a assinatura, a versão e quem assinou, e libera as tarefas', async () => {
    const atendimentoId = await criarAtendimento('José Alves Martins', '52998224725');
    const user = await abrirTermo(atendimentoId);
    await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));
    medirQuadro(520, 160, 'Área de assinatura');
    await desenharNoQuadro([
      [20, 80],
      [160, 100],
    ]);

    await user.press(screen.getByRole('radio', { name: 'Uso das imagens: Sim' }));
    await user.press(screen.getByRole('radio', { name: 'Uso futuro: Sim' }));
    await user.press(screen.getByRole('button', { name: 'Assinar e iniciar' }));

    const consentimento = await consentimentoDe(atendimentoId);
    expect(consentimento).toMatchObject({
      aceito: 1,
      versao_tcle: TERMO_TCLE.versao,
      assinado_por: 'responsavel_legal',
      autoriza_imagens_pesquisa: 1,
      autoriza_dados_pesquisa_futura: 1,
    });
    expect(Array.from(consentimento!.assinatura_png!)).toEqual(Array.from(ASSINATURA_PNG));
    expect(await estadoDe(atendimentoId)).toBe('em_andamento');
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: String(atendimentoId), tarefa: '1' },
    });
  });
});
