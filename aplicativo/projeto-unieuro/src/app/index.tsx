import LoginScreen from '@/features/auth/login-screen';
import { credentialsRepository } from '@/features/auth/composition';

export default function IndexRoute() {
  return <LoginScreen repository={credentialsRepository} />;
}
