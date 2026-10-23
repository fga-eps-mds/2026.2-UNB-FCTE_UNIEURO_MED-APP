import { patientListRepository } from '@/features/home/composition';
import HomeScreen from '@/features/home/home-screen';
import { useAttendedPatients } from '@/features/home/use-attended-patients';

export default function HomeRoute() {
  const { patients, loadFailed, loading } = useAttendedPatients(patientListRepository);
  return <HomeScreen patients={patients} loadFailed={loadFailed} loading={loading} />;
}
