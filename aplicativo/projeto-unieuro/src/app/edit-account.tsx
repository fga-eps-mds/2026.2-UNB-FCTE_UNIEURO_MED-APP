import { accountRepository } from '@/features/auth/composition';
import EditAccountScreen from '@/features/settings/edit-account-screen';

export default function EditAccountRoute() {
  return <EditAccountScreen repository={accountRepository} />;
}
