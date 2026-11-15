import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SessionProvider, useSession, type SessionProfessional } from '@/features/auth/session';
import type { ExameGravado, ExameRepository } from '@/features/home/exame';
import { useExame } from '@/features/home/use-exame';

const ana: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const gravado = (id = 12): ExameGravado => ({
  id,
  iniciadoEm: '2026-10-05T17:32:00.000Z',
  estado: 'concluida',
  pacienteNome: 'José Alves Martins',
  numeroFicha: '2026-0184',
  profissionalNome: 'Ana Carolina Souza',
  desenhos: [],
});

const repositorioCom = (
  buscar: ExameRepository['buscarExame'] = jest.fn(async (_, id) => gravado(id)),
) => ({ buscarExame: jest.fn(buscar) }) satisfies ExameRepository;

function renderComSessao(
  repository: ExameRepository,
  atendimentoId: number | null,
  professional: SessionProfessional | null = ana,
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider initialProfessional={professional}>{children}</SessionProvider>
  );
  return renderHook(
    ({ id }: { id: number | null }) => ({ estado: useExame(repository, id), sessao: useSession() }),
    { wrapper, initialProps: { id: atendimentoId } },
  );
}

describe('exame lido para o "Ver exame"', () => {
  it('mostra que está carregando e depois o exame do profissional da sessão', async () => {
    const repository = repositorioCom();

    const { result } = renderComSessao(repository, 12);

    expect(result.current.estado).toEqual({ status: 'carregando' });
    await waitFor(() => expect(result.current.estado.status).toBe('pronto'));
    expect(repository.buscarExame).toHaveBeenCalledWith(7, 12);
    expect(result.current.estado).toMatchObject({
      exame: { id: 12, pacienteNome: 'José Alves Martins', situacaoTexto: 'Concluído' },
    });
  });

  it('informa que não encontrou quando o exame não é do profissional ou não existe', async () => {
    const repository = repositorioCom(async () => null);

    const { result } = renderComSessao(repository, 99);

    await waitFor(() => expect(result.current.estado).toEqual({ status: 'nao-encontrado' }));
  });

  it('informa a falha quando a leitura do banco não funciona', async () => {
    const repository = repositorioCom(async () => {
      throw new Error('banco indisponível');
    });

    const { result } = renderComSessao(repository, 12);

    await waitFor(() => expect(result.current.estado).toEqual({ status: 'falhou' }));
  });

  it('sem id válido na rota, informa que não encontrou e nem consulta o banco', () => {
    const repository = repositorioCom();

    const { result } = renderComSessao(repository, null);

    expect(result.current.estado).toEqual({ status: 'nao-encontrado' });
    expect(repository.buscarExame).not.toHaveBeenCalled();
  });

  it('sem profissional na sessão, não consulta o banco', () => {
    const repository = repositorioCom();

    const { result } = renderComSessao(repository, 12, null);

    expect(result.current.estado).toEqual({ status: 'carregando' });
    expect(repository.buscarExame).not.toHaveBeenCalled();
  });

  it('ao trocar de exame, volta a carregar sem mostrar o exame anterior', async () => {
    let terminarSegunda: (exame: ExameGravado) => void = () => {};
    const repository = repositorioCom(
      jest
        .fn()
        .mockResolvedValueOnce(gravado(12))
        .mockReturnValueOnce(new Promise((resolve) => (terminarSegunda = resolve))),
    );
    const { result, rerender } = renderComSessao(repository, 12);
    await waitFor(() => expect(result.current.estado.status).toBe('pronto'));

    rerender({ id: 13 });

    expect(result.current.estado).toEqual({ status: 'carregando' });
    await act(async () => terminarSegunda(gravado(13)));
    expect(result.current.estado).toMatchObject({ status: 'pronto', exame: { id: 13 } });
  });

  it('não mostra o exame cuja leitura termina depois de a sessão acabar', async () => {
    let terminar: (exame: ExameGravado) => void = () => {};
    const repository = repositorioCom(() => new Promise((resolve) => (terminar = resolve)));
    const { result } = renderComSessao(repository, 12);

    act(() => result.current.sessao.signOut());
    await act(async () => terminar(gravado(12)));

    expect(result.current.estado).toEqual({ status: 'carregando' });
  });
});
