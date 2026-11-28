import AreaSuperusuarioScreen from '@/features/superusuario/area-superusuario-screen';
import { contasRepository } from '@/features/superusuario/composition';
import { ContasDosMedicos } from '@/features/superusuario/contas-dos-medicos';

export default function SuperusuarioRoute() {
  return (
    <AreaSuperusuarioScreen>
      <ContasDosMedicos repository={contasRepository} />
    </AreaSuperusuarioScreen>
  );
}
