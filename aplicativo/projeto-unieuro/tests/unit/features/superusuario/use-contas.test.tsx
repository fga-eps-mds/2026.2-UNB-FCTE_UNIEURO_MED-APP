import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';

import { SessionProvider, useSession, type SessionProfessional } from '@/features/auth/session';
import type { ContaProfissional, ContasRepository } from '@/features/superusuario/contas';
import { useContas } from '@/features/superusuario/use-contas';

const tauil: SessionProfessional = {
  id: 1,
  name: 'Carlos Bernardo Tauil',
  email: 'tauil@unieuro.com.br',
  crmNumber: '12771',
  crmState: 'DF',
  superuser: true,
};

const ana: ContaProfissional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
  active: true,
  superuser: false,
  examCount: 12,
};

const repositoryWith = (...answers: (ContaProfissional[] | Error)[]) => {
  const listAccounts = jest.fn<Promise<ContaProfissional[]>, [number]>();
  for (const answer of answers) {
    if (answer instanceof Error) listAccounts.mockRejectedValueOnce(answer);
    else listAccounts.mockResolvedValueOnce(answer);
  }
  return { listAccounts } satisfies ContasRepository;
};

function renderWithSession(repository: ContasRepository, professional: SessionProfessional | null) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider initialProfessional={professional}>{children}</SessionProvider>
  );
  return renderHook(() => useContas(repository), { wrapper });
}

/** Simula a área do superusuário voltando a ter foco. */
async function refocus() {
  const lastEffect = jest.mocked(useFocusEffect).mock.calls.at(-1)![0];
  await act(async () => {
    lastEffect();
  });
}

describe('contas da área do superusuário', () => {
  it('lê as contas pedindo como o profissional da sessão e monta as linhas da tabela', async () => {
    const repository = repositoryWith([ana]);

    const { result } = renderWithSession(repository, tauil);

    await waitFor(() => expect(result.current.contas).toHaveLength(1));
    expect(repository.listAccounts).toHaveBeenCalledWith(1);
    expect(result.current.contas[0]).toMatchObject({
      nome: 'Ana Carolina Souza',
      crm: '12345/DF',
      situacao: 'ativa',
      exames: 12,
    });
    expect(result.current.loadFailed).toBe(false);
  });

  it('fica carregando até a primeira leitura terminar, e não volta a carregar no foco', async () => {
    const repository = repositoryWith([ana], [ana]);

    const { result } = renderWithSession(repository, tauil);

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    await refocus();
    expect(result.current.loading).toBe(false);
  });

  it('lê de novo quando a tela volta a ter foco', async () => {
    const paulo = { ...ana, id: 8, name: 'Paulo Henrique Rocha' };
    const repository = repositoryWith([ana], [ana, paulo]);
    const { result } = renderWithSession(repository, tauil);
    await waitFor(() => expect(result.current.contas).toHaveLength(1));

    await refocus();

    await waitFor(() => expect(result.current.contas).toHaveLength(2));
  });

  it('recarrega a pedido, depois de uma ação, sem voltar a mostrar que está carregando', async () => {
    const desativada = { ...ana, active: false };
    const repository = repositoryWith([ana], [desativada]);
    const { result } = renderWithSession(repository, tauil);
    await waitFor(() => expect(result.current.contas[0]?.situacao).toBe('ativa'));

    act(() => result.current.recarregar());

    expect(result.current.loading).toBe(false);
    await waitFor(() => expect(result.current.contas[0].situacao).toBe('desativada'));
    expect(repository.listAccounts).toHaveBeenLastCalledWith(1);
  });

  it('avisa quando a leitura pedida depois de uma ação falha', async () => {
    const repository = repositoryWith([ana], new Error('banco indisponível'));
    const { result } = renderWithSession(repository, tauil);
    await waitFor(() => expect(result.current.contas).toHaveLength(1));

    act(() => result.current.recarregar());

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.contas).toHaveLength(1);
  });

  it('sem profissional na sessão, recarregar não consulta o banco', () => {
    const repository = repositoryWith();
    const { result } = renderWithSession(repository, null);

    act(() => result.current.recarregar());

    expect(repository.listAccounts).not.toHaveBeenCalled();
  });

  it('não consulta o banco sem profissional na sessão', () => {
    const repository = repositoryWith();

    const { result } = renderWithSession(repository, null);

    expect(result.current.contas).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(repository.listAccounts).not.toHaveBeenCalled();
  });

  it('avisa quando a leitura falha e mantém a lista anterior', async () => {
    const repository = repositoryWith([ana], new Error('banco indisponível'));
    const { result } = renderWithSession(repository, tauil);
    await waitFor(() => expect(result.current.contas).toHaveLength(1));

    await refocus();

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.contas).toHaveLength(1);
  });

  it('ignora a leitura que termina depois de a tela perder o foco', async () => {
    let resolve!: (list: ContaProfissional[]) => void;
    const repository: ContasRepository = {
      listAccounts: jest.fn(() => new Promise<ContaProfissional[]>((done) => (resolve = done))),
    };
    const { result, unmount } = renderWithSession(repository, tauil);

    unmount();
    await act(async () => resolve([ana]));

    expect(result.current.contas).toEqual([]);
  });

  it('não avisa a falha de uma leitura que termina depois de a tela perder o foco', async () => {
    let reject!: (error: Error) => void;
    const repository: ContasRepository = {
      listAccounts: jest.fn(
        () => new Promise<ContaProfissional[]>((_resolve, fail) => (reject = fail)),
      ),
    };
    const { result, unmount } = renderWithSession(repository, tauil);

    unmount();
    await act(async () => reject(new Error('banco indisponível')));

    expect(result.current.loadFailed).toBe(false);
  });

  it('limpa a lista e o aviso de falha quando a sessão termina', async () => {
    const repository = repositoryWith([ana], new Error('banco indisponível'));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SessionProvider initialProfessional={tauil}>{children}</SessionProvider>
    );
    const { result } = renderHook(
      () => ({ contas: useContas(repository), session: useSession() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.contas.contas).toHaveLength(1));
    await refocus();
    await waitFor(() => expect(result.current.contas.loadFailed).toBe(true));

    act(() => result.current.session.signOut());

    expect(result.current.contas.contas).toEqual([]);
    expect(result.current.contas.loadFailed).toBe(false);
  });
});
