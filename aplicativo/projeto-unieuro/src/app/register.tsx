import { professionalRepository } from '@/db/professional-repository';
import RegisterScreen from '@/features/auth/register-screen';

export default function RegisterRoute() {
  return <RegisterScreen repository={professionalRepository} />;
}