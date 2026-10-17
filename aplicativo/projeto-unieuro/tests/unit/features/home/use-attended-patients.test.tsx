import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';

import { SessionProvider, useSession, type SessionProfessional } from '@/features/auth/session';
import type { AttendedPatient, PatientListRepository } from '@/features/home/patients';
import { useAttendedPatients } from '@/features/home/use-attended-patients';

const ana: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const jose: AttendedPatient = {
  id: 1,
  name: 'José Alves Martins',
  recordNumber: '2026-0001',
  attendanceCount: 1,
  lastStartedAt: '2026-10-13T09:10:00.000Z',
  lastState: 'aguardando_consentimento',
};

const repositoryWith = (...answers: (AttendedPatient[] | Error)[]) => {
  const list = jest.fn<Promise<AttendedPatient[]>, [number]>();
  for (const answer of answers) {
    if (answer instanceof Error) list.mockRejectedValueOnce(answer);
    else list.mockResolvedValueOnce(answer);
  }
  return { listAttendedPatients: list } satisfies PatientListRepository;
};

function renderWithSession(
  repository: PatientListRepository,
  professional: SessionProfessional | null,
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider initialProfessional={professional}>{children}</SessionProvider>
  );
  return renderHook(() => useAttendedPatients(repository), { wrapper });
}

/** Simula a tela inicial voltando a ter foco, como depois do "Voltar ao início". */
async function refocus() {
  const lastEffect = jest.mocked(useFocusEffect).mock.calls.at(-1)![0];
  await act(async () => {
    lastEffect();
  });
}

describe('pacientes atendidos na tela inicial', () => {
  it('lê os pacientes do profissional da sessão', async () => {
    const repository = repositoryWith([jose]);

    const { result } = renderWithSession(repository, ana);

    await waitFor(() => expect(result.current.patients).toHaveLength(1));
    expect(repository.listAttendedPatients).toHaveBeenCalledWith(7);
    expect(result.current.patients[0]).toMatchObject({
      name: 'José Alves Martins',
      recordNumber: '2026-0001',
      examCount: 1,
    });
    expect(result.current.loadFailed).toBe(false);
  });

  it('lê de novo quando a tela volta a ter foco', async () => {
    const segundo = { ...jose, id: 2, name: 'Maria das Dores', recordNumber: '2026-0002' };
    const repository = repositoryWith([jose], [jose, segundo]);
    const { result } = renderWithSession(repository, ana);
    await waitFor(() => expect(result.current.patients).toHaveLength(1));

    await refocus();

    await waitFor(() => expect(result.current.patients).toHaveLength(2));
    expect(repository.listAttendedPatients).toHaveBeenCalledTimes(2);
  });

  it('não consulta o banco sem profissional na sessão', () => {
    const repository = repositoryWith();

    const { result } = renderWithSession(repository, null);

    expect(result.current.patients).toEqual([]);
    expect(repository.listAttendedPatients).not.toHaveBeenCalled();
  });

  it('avisa quando a leitura falha e mantém a lista anterior', async () => {
    const repository = repositoryWith([jose], new Error('banco indisponível'));
    const { result } = renderWithSession(repository, ana);
    await waitFor(() => expect(result.current.patients).toHaveLength(1));

    await refocus();

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.patients).toHaveLength(1);
  });

  it('ignora a leitura que termina depois de a tela perder o foco', async () => {
    let resolve!: (list: AttendedPatient[]) => void;
    const repository: PatientListRepository = {
      listAttendedPatients: jest.fn(
        () => new Promise<AttendedPatient[]>((done) => (resolve = done)),
      ),
    };
    const { result, unmount } = renderWithSession(repository, ana);

    unmount();
    await act(async () => resolve([jose]));

    expect(result.current.patients).toEqual([]);
  });

  it('não avisa a falha de uma leitura que termina depois de a tela perder o foco', async () => {
    let reject!: (error: Error) => void;
    const repository: PatientListRepository = {
      listAttendedPatients: jest.fn(
        () => new Promise<AttendedPatient[]>((_resolve, fail) => (reject = fail)),
      ),
    };
    const { result, unmount } = renderWithSession(repository, ana);

    unmount();
    await act(async () => reject(new Error('banco indisponível')));

    expect(result.current.loadFailed).toBe(false);
  });

  it('limpa a lista e o aviso de falha quando a sessão termina', async () => {
    const repository = repositoryWith([jose], new Error('banco indisponível'));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SessionProvider initialProfessional={ana}>{children}</SessionProvider>
    );
    const { result } = renderHook(
      () => ({ list: useAttendedPatients(repository), session: useSession() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.patients).toHaveLength(1));
    await refocus();
    await waitFor(() => expect(result.current.list.loadFailed).toBe(true));

    act(() => result.current.session.signOut());

    expect(result.current.list.patients).toEqual([]);
    expect(result.current.list.loadFailed).toBe(false);
  });
});
