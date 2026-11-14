import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSession } from '@/features/auth/session';
import {
  toPatientDetail,
  type PatientDetail,
  type PatientDetailRepository,
} from '@/features/home/patient-detail';

type Reading = {
  /** Profissional e paciente a que a leitura se refere. */
  key: string;
  patient: PatientDetail | null;
  failed: boolean;
};

/**
 * Paciente e exames do profissional da sessão, lidos do banco (#59).
 *
 * A leitura se repete sempre que a tela volta a ter foco, para mostrar o exame
 * que acabou de ser aplicado. `patientId` é `null` quando o parâmetro da rota
 * não é um número, e a tela mostra "paciente não encontrado".
 */
export function usePatientDetail(repository: PatientDetailRepository, patientId: number | null) {
  const { professional } = useSession();
  const professionalId = professional?.id ?? null;
  const key =
    professionalId !== null && patientId !== null ? `${professionalId}:${patientId}` : null;
  const [reading, setReading] = useState<Reading | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (professionalId === null || patientId === null) return;

      const readKey = `${professionalId}:${patientId}`;
      // Uma leitura que termina depois de a tela perder o foco ou de a sessão
      // mudar não sobrescreve o que está na tela.
      let current = true;
      repository
        .findPatientWithExams(professionalId, patientId)
        .then((found) => {
          if (!current) return;
          setReading({ key: readKey, patient: found && toPatientDetail(found), failed: false });
        })
        .catch(() => {
          if (!current) return;
          // Uma leitura que falha ao voltar o foco mantém o paciente já mostrado.
          setReading((previous) => ({
            key: readKey,
            patient: previous?.key === readKey ? previous.patient : null,
            failed: true,
          }));
        });
      return () => {
        current = false;
      };
    }, [professionalId, patientId, repository]),
  );

  const latest = reading?.key === key ? reading : null;
  return {
    patient: latest?.patient ?? null,
    loading: key !== null && latest === null,
    loadFailed: latest?.failed ?? false,
    notFound: patientId === null || (latest !== null && !latest.failed && latest.patient === null),
  };
}
