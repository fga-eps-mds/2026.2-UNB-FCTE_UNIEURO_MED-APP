import { useLocalSearchParams } from 'expo-router';

import AnaliseScreen from '@/features/inferencia/analise-screen';
import { dependenciasDaAnalise } from '@/features/inferencia/composition';

// Só dígitos: "7" abre o exame 7, mas "7abc", "-1" e "0x7" não abrem nenhum.
const exameIdDe = (param: string | string[] | undefined) =>
  typeof param === 'string' && /^\d+$/.test(param) ? Number(param) : null;

export default function AnaliseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AnaliseScreen exameId={exameIdDe(id)} dependencias={dependenciasDaAnalise} />;
}
