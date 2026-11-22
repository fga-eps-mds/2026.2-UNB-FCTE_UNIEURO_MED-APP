import AreaSuperusuarioScreen from '@/features/superusuario/area-superusuario-screen';
import { contasRepository } from '@/features/superusuario/composition';
import { useContas } from '@/features/superusuario/use-contas';
import { TabelaContas } from '@/features/superusuario/tabela-contas';

export default function SuperusuarioRoute() {
  const { contas, loading, loadFailed } = useContas(contasRepository);
  return (
    <AreaSuperusuarioScreen>
      <TabelaContas contas={contas} loading={loading} loadFailed={loadFailed} />
    </AreaSuperusuarioScreen>
  );
}
