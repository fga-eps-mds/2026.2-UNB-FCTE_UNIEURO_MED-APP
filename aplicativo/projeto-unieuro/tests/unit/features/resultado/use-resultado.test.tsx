import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import type { ExameComDesenhos, ResultadoRepository } from '@/features/resultado/resultado';
import { useResultado } from '@/features/resultado/use-resultado';

const ana: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const exame: ExameComDesenhos = {
  id: 12,
  startedAt: '2026-11-03T14:00:00.000Z',
  state: 'concluida',
  patientName: 'José Alves Martins',
  recordNumber: '2026-0184',
  appliedBy: 'Ana Carolina Souza',
  drawings: [],
};

function usar(
  repository: ResultadoRepository,
  exameId: number | null,
  sessao: SessionProfessional | null = ana,
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider initialProfessional={sessao}>{children}</SessionProvider>
  );
  return renderHook(() => useResultado(repository, exameId), { wrapper });
}

describe('useResultado', () => {
  it('carrega e depois entrega o resultado do exame', async () => {
    const repository: ResultadoRepository = { findExamResult: jest.fn(async () => exame) };

    const { result } = usar(repository, 12);
    expect(result.current.carregando).toBe(true);

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.resultado?.patientName).toBe('José Alves Martins');
    expect(result.current).toMatchObject({ falhou: false, naoEncontrado: false });
    expect(repository.findExamResult).toHaveBeenCalledWith(7, 12);
  });

  it('avisa que não achou o exame que o profissional não pode ver', async () => {
    const { result } = usar({ findExamResult: jest.fn(async () => null) }, 12);

    await waitFor(() => expect(result.current.naoEncontrado).toBe(true));
    expect(result.current.resultado).toBeNull();
  });

  it('avisa a falha ao ler o banco', async () => {
    const { result } = usar(
      {
        findExamResult: jest.fn(async () => {
          throw new Error('banco indisponível');
        }),
      },
      12,
    );

    await waitFor(() => expect(result.current.falhou).toBe(true));
    expect(result.current.naoEncontrado).toBe(false);
  });

  it('com um parâmetro de rota que não é número, não lê o banco', () => {
    const repository: ResultadoRepository = { findExamResult: jest.fn() };

    const { result } = usar(repository, null);

    expect(result.current).toMatchObject({ carregando: false, naoEncontrado: true });
    expect(repository.findExamResult).not.toHaveBeenCalled();
  });

  it('sem sessão, não lê o banco', () => {
    const repository: ResultadoRepository = { findExamResult: jest.fn() };

    const { result } = usar(repository, 12, null);

    expect(result.current.carregando).toBe(false);
    expect(repository.findExamResult).not.toHaveBeenCalled();
  });

  it('ignora a leitura que termina depois de a tela sair', async () => {
    let terminar: (valor: ExameComDesenhos) => void = () => undefined;
    const repository: ResultadoRepository = {
      findExamResult: jest.fn(
        () =>
          new Promise<ExameComDesenhos>((resolve) => {
            terminar = resolve;
          }),
      ),
    };
    const { unmount } = usar(repository, 12);

    unmount();
    terminar(exame);

    await expect(Promise.resolve()).resolves.toBeUndefined();
  });
});
