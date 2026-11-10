import { useEffect, useState } from 'react';

import type { PatientCpf, PatientSummary } from '@/features/home/patients';

type LoadedCpfs = {
  patients: readonly PatientSummary[];
  cpfs: ReadonlyMap<number, string>;
  failed: boolean;
};

/**
 * CPFs dos pacientes da lista, para a busca por CPF (#99).
 *
 * Os CPFs só são decifrados quando a busca tem dígitos de CPF, e uma vez por
 * lista: quando a lista é lida de novo, como ao voltar o foco depois de um
 * atendimento, eles são lidos outra vez para incluir o paciente novo.
 */
export function usePatientCpfs(
  load: () => Promise<PatientCpf[]>,
  patients: readonly PatientSummary[],
  wanted: boolean,
) {
  const [loaded, setLoaded] = useState<LoadedCpfs | null>(null);
  const current = loaded?.patients === patients ? loaded : null;

  useEffect(() => {
    if (!wanted || current) return;
    // Uma leitura que termina depois de a lista mudar não vale para a nova lista.
    let stillWanted = true;
    load()
      .then((list) => {
        if (!stillWanted) return;
        const cpfs = new Map(list.map(({ patientId, cpf }) => [patientId, cpf]));
        setLoaded({ patients, cpfs, failed: false });
      })
      .catch(() => {
        if (stillWanted) setLoaded({ patients, cpfs: new Map(), failed: true });
      });
    return () => {
      stillWanted = false;
    };
  }, [wanted, current, load, patients]);

  return { cpfs: current?.cpfs, failed: current?.failed ?? false };
}
