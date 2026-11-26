import { passwordRecoveryAttempts, passwordRecoveryRepository } from '@/features/auth/composition';
import RecoveryScreen from '@/features/auth/recovery-screen';

export default function RecoveryRoute() {
  return (
    <RecoveryScreen
      repository={passwordRecoveryRepository}
      attemptsStore={passwordRecoveryAttempts}
    />
  );
}
