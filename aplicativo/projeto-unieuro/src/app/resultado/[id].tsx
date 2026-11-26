import { useLocalSearchParams } from 'expo-router';
import { exportarExame } from '@/features/exportacao/composition';
import { resultadoRepository } from '@/features/resultado/composition';
import ResultadoScreen from '@/features/resultado/resultado-screen';
import { useResultado } from '@/features/resultado/use-resultado';

const exameIdDe = (param: string | string[] | undefined) =>
  typeof param === 'string' && /^\d+$/.test(param) ? Number(param) : null;

export default function ResultadoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leitura = useResultado(resultadoRepository, exameIdDe(id));
  return <ResultadoScreen {...leitura} exportExam={exportarExame} />;
}
