import { contasRepository } from '@/features/superusuario/composition';
import NovoSuperusuarioScreen from '@/features/superusuario/novo-superusuario-screen';

export default function NovoSuperusuarioRoute() {
  return <NovoSuperusuarioScreen repository={contasRepository} />;
}
