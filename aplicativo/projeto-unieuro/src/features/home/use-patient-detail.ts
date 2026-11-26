import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSession } from '@/features/auth/session';
import {
  findPatientWithExamsFor,
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
 * Paciente e exames do profissional da sessão, lidos do banco (#59). Para o
 * superusuário, os exames de todos os profissionais (#49).
 *
 * A leitura se repete sempre que a tela volta a ter foco, para mostrar o exame
 * que acabou de ser aplicado, e quando a tela pede `reload`, depois de marcar ou
 * desmarcar um exame (#58). `patientId` é `null` quando o parâmetro da rota
 * não é um número, e a tela mostra "paciente não encontrado".
 */
export function usePatientDetail(repository: PatientDetailRepository, patientId: number | null) {
  const { professional } = useSession();
  const professionalId = professional?.id ?? null;
  const superuser = professional?.superuser === true;
  const key =
    professionalId !== null && patientId !== null
      ? `${professionalId}:${superuser}:${patientId}`
      : null;
  const [reading, setReading] = useState<Reading | null>(null);
  // Cada pedido de releitura troca o efeito de foco, que roda de novo com a tela aberta.
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useFocusEffect(
    useCallback(() => {
      if (professionalId === null || patientId === null) return;

      const readKey = `${professionalId}:${superuser}:${patientId}`;
      // Uma leitura que termina depois de a tela perder o foco ou de a sessão
      // mudar não sobrescreve o que está na tela.
      let current = true;
      findPatientWithExamsFor({ id: professionalId, superuser }, repository, patientId)
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
      // `version` só existe para refazer a leitura quando a tela pede.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [professionalId, superuser, patientId, repository, version]),
  );

  const latest = reading?.key === key ? reading : null;
  return {
    patient: latest?.patient ?? null,
    loading: key !== null && latest === null,
    loadFailed: latest?.failed ?? false,
    notFound: patientId === null || (latest !== null && !latest.failed && latest.patient === null),
    reload,
  };
}
