import { useLocalSearchParams } from 'expo-router';

import { patientDetailRepository } from '@/features/home/composition';
import PatientDetailScreen from '@/features/home/patient-detail-screen';
import { usePatientDetail } from '@/features/home/use-patient-detail';

// Só dígitos: "7" abre o paciente 7, mas "7abc", "-1" e "0x7" não abrem ninguém.
const patientIdOf = (param: string | string[] | undefined) =>
  typeof param === 'string' && /^\d+$/.test(param) ? Number(param) : null;

export default function PatientRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { patient, loading, loadFailed, notFound } = usePatientDetail(
    patientDetailRepository,
    patientIdOf(id),
  );
  return (
    <PatientDetailScreen
      patient={patient}
      loading={loading}
      loadFailed={loadFailed}
      notFound={notFound}
    />
  );
}
