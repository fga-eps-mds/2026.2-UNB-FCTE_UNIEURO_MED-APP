import { act, render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import DrawingRoute from '@/app/desenho';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { SessionProvider } from '@/features/auth/session';
import { FALHA_AO_SALVAR } from '@/features/avaliacao/drawing-task-screen';
import { gerarImagemDesenho } from '@/features/captura/imagem-desenho';

import { desenharNoQuadro, medirQuadro } from '../test-support/desenho';
import {
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

// Da tela de desenho até o banco (#10): o "Confirmar" grava a tarefa, o traçado e a
// imagem no SQLite de verdade. Só a navegação, o consentimento (#21, com teste
// próprio) e o PNG, que precisa do Skia nativo, são simulados.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockTablet: TabletComAnaEBruno;

jest.mock('@/features/captura/composition', () => {
  const { createDrawingRepository } = jest.requireActual('@/db/drawing-repository');
  const regra = jest.requireActual('@/features/captura/drawing');
  const repositorio = createDrawingRepository(() => Promise.resolve(mockTablet.database));
  return { confirmDrawing: (input: unknown) => regra.confirmarDesenho(input, repositorio) };
});

jest.mock('@/features/avaliacao/use-consent-gate', () => ({
  useConsentGate: jest.fn(() => 'liberado'),
}));

jest.mock('@/features/captura/imagem-desenho', () => ({ gerarImagemDesenho: jest.fn() }));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const QUADRO = { largura: 960, altura: 600 };
const ROTULOS: Record<string, string> = {
  '1': 'Área de desenho: desenhe um relógio',
  '2': 'Área de desenho: copie o cubo',
  '3': 'Área de desenho: ligue números e letras',
};

let atendimentoId: number;

beforeEach(async () => {
  mockTablet = await abrirTabletComAnaEBruno();
  jest.mocked(gerarImagemDesenho).mockReturnValue(PNG);
  ({ attendanceId: atendimentoId } = await createAttendanceRepository(
    async () => mockTablet.database,
    cpfProtector,
  ).createAttendance({
    patient: {
      name: 'José Alves Martins',
      cpf: '52998224725',
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'masculino',
    },
    professionalId: mockTablet.anaId,
    startedAt: '2026-11-03T14:00:00.000Z',
  }));
});

afterEach(async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  await mockTablet.fechar();
});

function abrirTarefa(tarefa: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({
    atendimento: String(atendimentoId),
    tarefa,
  });
  render(
    <SessionProvider
      initialProfessional={{
        id: mockTablet.anaId,
        name: 'Ana Carolina Souza',
        email: 'ana.souza@unieuro.com.br',
        crmNumber: '12345',
        crmState: 'DF',
      }}>
      <DrawingRoute />
    </SessionProvider>,
  );
  medirQuadro(QUADRO.largura, QUADRO.altura, ROTULOS[tarefa]);
  return userEvent.setup();
}

async function confirmar(user: ReturnType<typeof userEvent.setup>) {
  await user.press(screen.getByRole('button', { name: 'Confirmar' }));
  await act(async () => {});
}

const contar = async (tabela: string) =>
  (await mockTablet.database.getFirstAsync<{ total: number }>(
    `SELECT count(*) AS total FROM ${tabela}`,
  ))!.total;

describe('Cenário: traçado guardado', () => {
  it('grava no tablet, ligado ao atendimento e à tarefa, cada ponto com a ordem e o instante', async () => {
    const user = abrirTarefa('1');
    await desenharNoQuadro([
      [100, 100],
      [150, 120],
      [200, 100],
    ]);

    await confirmar(user);

    const tarefa = await mockTablet.database.getFirstAsync<{
      id: number;
      id_avaliacao: number;
      tipo: string;
      ordem: number;
      largura: number;
      altura: number;
    }>('SELECT id, id_avaliacao, tipo, ordem, largura, altura FROM tarefa');
    expect(tarefa).toMatchObject({
      id_avaliacao: atendimentoId,
      tipo: 'relogio',
      ordem: 1,
      ...QUADRO,
    });

    const eventos = await mockTablet.database.getAllAsync<{
      id_tarefa: number;
      ordem: number;
      tipo: string;
      coord_x: number;
      coord_y: number;
      instante: number;
      ponteiro: string;
    }>(
      `SELECT id_tarefa, ordem, tipo, coord_x, coord_y, instante, ponteiro
       FROM evento_tracado ORDER BY ordem`,
    );
    expect(
      eventos.map(({ ordem, tipo, coord_x, coord_y }) => [ordem, tipo, coord_x, coord_y]),
    ).toEqual([
      [1, 'inicio', 100, 100],
      [2, 'ponto', 150, 120],
      [3, 'ponto', 200, 100],
    ]);
    for (const evento of eventos) {
      expect(evento.id_tarefa).toBe(tarefa!.id);
      expect(evento.ponteiro).toBe('caneta');
      expect(evento.instante).toBeGreaterThanOrEqual(0);
    }
  });

  it('só segue para a próxima tarefa depois de gravar', async () => {
    const user = abrirTarefa('2');
    await desenharNoQuadro([[50, 50]]);

    await confirmar(user);

    expect(await contar('tarefa')).toBe(1);
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: String(atendimentoId), tarefa: '3' },
    });
  });
});

describe('Cenário: traços apagados também ficam', () => {
  it('grava todos os eventos que o quadro registrou, sem descartar nenhum', async () => {
    // A tela das tarefas ainda não tem desfazer nem limpar, então o paciente não
    // consegue apagar um traço aqui. A gravação repassa o registro inteiro do quadro,
    // e o repositório grava o desfazer e o limpar (teste do repositório).
    const user = abrirTarefa('3');
    await desenharNoQuadro([
      [500, 245],
      [706, 54],
    ]);
    await desenharNoQuadro([
      [706, 54],
      [600, 300],
    ]);

    await confirmar(user);

    expect(await contar('evento_tracado')).toBe(4);
    expect(gerarImagemDesenho).toHaveBeenCalledWith([expect.any(Array), expect.any(Array)], QUADRO);
  });
});

describe('Cenário: imagem final guardada', () => {
  it('gera e grava o PNG do desenho final, ligado ao atendimento e à tarefa', async () => {
    const user = abrirTarefa('1');
    await desenharNoQuadro([
      [100, 100],
      [200, 100],
    ]);

    await confirmar(user);

    const gravado = await mockTablet.database.getFirstAsync<{
      id_avaliacao: number;
      tipo: string;
      imagem_final: Uint8Array;
    }>(
      `SELECT t.id_avaliacao, t.tipo, d.imagem_final
       FROM desenho d JOIN tarefa t ON t.id = d.id_tarefa`,
    );
    expect(gravado).toMatchObject({ id_avaliacao: atendimentoId, tipo: 'relogio' });
    expect(Array.from(gravado!.imagem_final)).toEqual(Array.from(PNG));
  });
});

describe('Cenário: tudo ou nada', () => {
  async function confirmarComFalha() {
    // Uma imagem vazia é recusada pelo banco no meio da transação.
    jest.mocked(gerarImagemDesenho).mockReturnValueOnce(new Uint8Array());
    const user = abrirTarefa('1');
    await desenharNoQuadro([
      [100, 100],
      [200, 100],
    ]);
    await confirmar(user);
    return user;
  }

  it('não deixa nenhuma parte da tarefa gravada pela metade', async () => {
    await confirmarComFalha();

    expect(await contar('tarefa')).toBe(0);
    expect(await contar('evento_tracado')).toBe(0);
    expect(await contar('desenho')).toBe(0);
  });

  it('avisa o profissional e mantém o desenho na tela, sem sair da tarefa', async () => {
    await confirmarComFalha();

    expect(screen.getByRole('alert')).toHaveTextContent(FALHA_AO_SALVAR);
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled();
    expect(screen.getByLabelText(ROTULOS['1'])).toBeEnabled();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('grava tudo na nova tentativa e segue para a próxima tarefa', async () => {
    const user = await confirmarComFalha();

    await confirmar(user);

    expect(await contar('tarefa')).toBe(1);
    expect(await contar('evento_tracado')).toBe(2);
    expect(await contar('desenho')).toBe(1);
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: String(atendimentoId), tarefa: '2' },
    });
  });
});
