import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { markExam, unmarkExam } from '@/features/avaliacao/composition';
import { exportarExamesDoPaciente } from '@/features/exportacao/composition';

import { patientDetailRepository } from '@/features/home/composition';
import PatientDetailScreen from '@/features/home/patient-detail-screen';
import { usePatientDetail } from '@/features/home/use-patient-detail';

// Só dígitos: "7" abre o paciente 7, mas "7abc", "-1" e "0x7" não abrem ninguém.
const patientIdOf = (param: string | string[] | undefined) =>
  typeof param === 'string' && /^\d+$/.test(param) ? Number(param) : null;

export default function PatientRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { patient, loading, loadFailed, notFound, reload } = usePatientDetail(
    patientDetailRepository,
    patientIdOf(id),
  );
  // Marcação do exame como teste ou ensino (#58), gravada no banco e relida em seguida.
  const marking = useMemo(
    () => ({ mark: markExam, unmark: unmarkExam, onChanged: reload }),
    [reload],
  );
  return (
    <PatientDetailScreen
      patient={patient}
      loading={loading}
      loadFailed={loadFailed}
      notFound={notFound}
      marking={marking}
      exportPatient={exportarExamesDoPaciente}
    />
  );
}
