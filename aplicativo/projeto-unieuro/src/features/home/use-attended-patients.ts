import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSession } from '@/features/auth/session';
import {
  toPatientSummary,
  type PatientListRepository,
  type PatientSummary,
} from '@/features/home/patients';

/**
 * Pacientes atendidos pelo profissional da sessão, lidos do banco.
 *
 * A leitura se repete sempre que a tela volta a ter foco: depois do registro do
 * atendimento, o "Voltar ao início" do termo traz a tela inicial de volta da
 * pilha, sem montá-la de novo.
 */
export function useAttendedPatients(repository: PatientListRepository) {
  const { professional } = useSession();
  const professionalId = professional?.id ?? null;
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  // Profissional cuja primeira leitura já terminou. Enquanto ela não termina, a
  // tela mostra que está carregando, e não "Nenhum paciente ainda". As leituras
  // seguintes, ao voltar o foco, mantêm a lista na tela sem voltar a carregar.
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (professionalId === null) {
        setPatients([]);
        setLoadFailed(false);
        return;
      }

      // Uma leitura que termina depois de a tela perder o foco ou de a sessão
      // mudar não sobrescreve a lista.
      let current = true;
      repository
        .listAttendedPatients(professionalId)
        .then((list) => {
          if (!current) return;
          setPatients(list.map(toPatientSummary));
          setLoadFailed(false);
          setLoadedFor(professionalId);
        })
        .catch(() => {
          if (!current) return;
          setLoadFailed(true);
          setLoadedFor(professionalId);
        });
      return () => {
        current = false;
      };
    }, [professionalId, repository]),
  );

  const loading = professionalId !== null && loadedFor !== professionalId;

  return { patients, loadFailed, loading };
}
