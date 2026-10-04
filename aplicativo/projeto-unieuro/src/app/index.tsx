import LoginScreen from '@/features/auth/login-screen';
import { professionalRepository } from '@/db/professional-repository';

export default function IndexRoute() {
  return <LoginScreen repository={professionalRepository} />;
}
