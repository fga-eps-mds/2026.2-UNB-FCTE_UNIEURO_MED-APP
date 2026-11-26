import { useLocalSearchParams } from 'expo-router';
import { exportarExame } from '@/features/exportacao/composition';
import { resultadoRepository } from '@/features/resultado/composition';
import ResultadoScreen from '@/features/resultado/resultado-screen';
import { useResultado } from '@/features/resultado/use-resultado';

// Só dígitos: "7" abre o exame 7, mas "7abc", "-1" e "0x7" não abrem nenhum.
const exameIdDe = (param: string | string[] | undefined) =>
  typeof param === 'string' && /^\d+$/.test(param) ? Number(param) : null;

export default function ResultadoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leitura = useResultado(resultadoRepository, exameIdDe(id));
  return <ResultadoScreen {...leitura} exportExam={exportarExame} />;
}
