import { confirmPassword, nearbyApi, syncService } from '@/features/sincronizacao/composition';
import SyncScreen from '@/features/sincronizacao/sync-screen';

export default function SyncRoute() {
  return <SyncScreen service={syncService} nearby={nearbyApi} confirmPassword={confirmPassword} />;
}
