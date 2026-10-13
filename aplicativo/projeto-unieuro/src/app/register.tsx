import { registrationRepository } from '@/features/auth/composition';
import RegisterScreen from '@/features/auth/register-screen';

export default function RegisterRoute() {
  return <RegisterScreen repository={registrationRepository} />;
}
