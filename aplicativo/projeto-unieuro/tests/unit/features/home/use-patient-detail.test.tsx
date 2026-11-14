import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import type { PatientDetailRepository, PatientWithExams } from '@/features/home/patient-detail';
import { usePatientDetail } from '@/features/home/use-patient-detail';

const ana: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const jose: PatientWithExams = {
  id: 3,
  name: 'José Alves Martins',
  recordNumber: '2026-0001',
  birthDate: '1948-03-14',
  schoolingYears: 5,
  sex: 'masculino',
  exams: [{ id: 1, startedAt: '2026-10-13T09:10:00.000Z', state: 'concluida' }],
};

const repositoryWith = (...answers: (PatientWithExams | null | Error)[]) => {
  const find = jest.fn<Promise<PatientWithExams | null>, [number, number]>();
  for (const answer of answers) {
    if (answer instanceof Error) find.mockRejectedValueOnce(answer);
    else find.mockResolvedValueOnce(answer);
  }
  return { findPatientWithExams: find } satisfies PatientDetailRepository;
};

function renderWithSession(
  repository: PatientDetailRepository,
  professional: SessionProfessional | null,
  patientId: number | null = 3,
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider initialProfessional={professional}>{children}</SessionProvider>
  );
  return renderHook(() => usePatientDetail(repository, patientId), { wrapper });
}

/** Simula a tela voltando a ter foco, como depois de um novo exame. */
async function refocus() {
  const lastEffect = jest.mocked(useFocusEffect).mock.calls.at(-1)![0];
  await act(async () => {
    lastEffect();
  });
}

describe('exames do paciente', () => {
  it('lê o paciente e os exames do profissional da sessão', async () => {
    const repository = repositoryWith(jose);

    const { result } = renderWithSession(repository, ana);

    await waitFor(() => expect(result.current.patient).not.toBeNull());
    expect(repository.findPatientWithExams).toHaveBeenCalledWith(7, 3);
    expect(result.current.patient).toMatchObject({ name: 'José Alves Martins' });
    expect(result.current.patient?.exams[0]).toMatchObject({ status: 'concluido' });
    expect(result.current).toMatchObject({ loading: false, loadFailed: false, notFound: false });
  });

  it('mostra que está carregando até a primeira leitura terminar', async () => {
    const repository = repositoryWith(jose);

    const { result } = renderWithSession(repository, ana);

    expect(result.current.loading).toBe(true);
    expect(result.current.notFound).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('avisa que o paciente não foi encontrado quando o banco não o devolve', async () => {
    const repository = repositoryWith(null);

    const { result } = renderWithSession(repository, ana);

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current).toMatchObject({ patient: null, loading: false, loadFailed: false });
  });

  it('avisa que a leitura falhou, sem dizer que o paciente não existe', async () => {
    const repository = repositoryWith(new Error('banco indisponível'));

    const { result } = renderWithSession(repository, ana);

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current).toMatchObject({ patient: null, loading: false, notFound: false });
  });

  it('lê de novo quando a tela volta a ter foco', async () => {
    const maisUm = {
      ...jose,
      exams: [
        { id: 2, startedAt: '2026-10-14T09:10:00.000Z', state: 'interrompida' },
        ...jose.exams,
      ],
    };
    const repository = repositoryWith(jose, maisUm);
    const { result } = renderWithSession(repository, ana);
    await waitFor(() => expect(result.current.patient?.exams).toHaveLength(1));

    await refocus();

    await waitFor(() => expect(result.current.patient?.exams).toHaveLength(2));
    expect(repository.findPatientWithExams).toHaveBeenCalledTimes(2);
  });

  it('mantém o paciente na tela quando uma leitura posterior falha', async () => {
    const repository = repositoryWith(jose, new Error('banco indisponível'));
    const { result } = renderWithSession(repository, ana);
    await waitFor(() => expect(result.current.patient).not.toBeNull());

    await refocus();

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.patient).toMatchObject({ name: 'José Alves Martins' });
  });

  it('não usa uma leitura que termina depois de a tela perder o foco', async () => {
    let terminar: (value: PatientWithExams | null) => void = () => undefined;
    const repository = {
      findPatientWithExams: jest.fn(
        () => new Promise<PatientWithExams | null>((r) => (terminar = r)),
      ),
    } satisfies PatientDetailRepository;
    const { result, unmount } = renderWithSession(repository, ana);

    unmount();
    await act(async () => terminar(jose));

    expect(result.current.patient).toBeNull();
  });

  it('não consulta o banco sem profissional na sessão', () => {
    const repository = repositoryWith();

    const { result } = renderWithSession(repository, null);

    expect(result.current.patient).toBeNull();
    expect(repository.findPatientWithExams).not.toHaveBeenCalled();
  });

  it('não consulta o banco quando o paciente da rota não é um número', () => {
    const repository = repositoryWith();

    const { result } = renderWithSession(repository, ana, null);

    expect(result.current).toMatchObject({ patient: null, notFound: true, loading: false });
    expect(repository.findPatientWithExams).not.toHaveBeenCalled();
  });
});
