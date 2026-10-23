import { accountRepository } from '@/features/auth/composition';
import SettingsScreen from '@/features/settings/settings-screen';

export default function SettingsRoute() {
  return <SettingsScreen repository={accountRepository} />;
}
