import { Pressable, Text, View } from 'react-native';

import type { InfluenciaDoDesenho, ModeloDoResultado } from '@/features/resultado/resultado';
import type { ResultadoStyles } from '@/features/resultado/resultado.styles';

export const NAO_E_DIAGNOSTICO = 'Este resultado não é diagnóstico';
export const ROTULO_PROBABILIDADE = 'Probabilidade de CCL';
export const TEXTO_DO_RASTREIO =
  'O escore indica a chance de comprometimento cognitivo leve calculada pelo modelo a partir dos três desenhos. Ele serve para rastreio e não substitui a avaliação clínica.';
export const PESO_NO_ESCORE = 'Peso deste desenho no escore';
export const CALCULAR_RESULTADO = 'Calcular o resultado';
export const ERRO_ANTERIOR =
  'O cálculo anterior não terminou. Os desenhos estão guardados e o cálculo pode ser feito de novo.';
export const AGUARDANDO_CALCULO =
  'O resultado do modelo ainda não foi calculado para este exame. Os desenhos estão guardados no tablet.';

const ROTULO_DA_CLASSE: Record<ModeloDoResultado['classe'], string> = {
  ccl: 'CCL',
  'sem-ccl': 'Sem indício de CCL',
};

// Duas casas, com vírgula, como no protótipo ("0,91").
export const formatarProbabilidade = (valor: number) => valor.toFixed(2).replace('.', ',');
const formatarPercentual = (valor: number) => `${Math.round(valor * 100)} %`;

export function ResultadoDoModeloCard({
  modelo,
  styles,
}: Readonly<{ modelo: ModeloDoResultado; styles: ResultadoStyles }>) {
  const probabilidade = formatarProbabilidade(modelo.probabilidade);
  return (
    <View style={styles.modelo}>
      <View style={styles.faixaDiagnostico}>
        <Text accessibilityRole="alert" style={styles.faixaDiagnosticoTexto}>
          {NAO_E_DIAGNOSTICO}
        </Text>
      </View>
      <View
        accessible
        accessibilityLabel={`${ROTULO_PROBABILIDADE}: ${probabilidade}. Classe prevista: ${ROTULO_DA_CLASSE[modelo.classe]}`}
        style={styles.escore}>
        <Text style={styles.escoreRotulo}>{ROTULO_PROBABILIDADE}</Text>
        <Text style={styles.escoreValor}>{probabilidade}</Text>
        <Text
          style={
            styles.escoreClasse
          }>{`Classe prevista · ${ROTULO_DA_CLASSE[modelo.classe]}`}</Text>
      </View>
      <Text style={styles.aviso}>{TEXTO_DO_RASTREIO}</Text>
    </View>
  );
}

export function ModeloPendente({
  comErro,
  onCalcular,
  styles,
}: Readonly<{ comErro: boolean; onCalcular: () => void; styles: ResultadoStyles }>) {
  return (
    <View style={styles.modelo}>
      <Text style={styles.aviso}>{comErro ? ERRO_ANTERIOR : AGUARDANDO_CALCULO}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onCalcular}
        style={({ pressed }) => [styles.botao, pressed && styles.pressed]}>
        <Text style={styles.botaoTexto}>{CALCULAR_RESULTADO}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Quanto cada desenho pesou no escore (#14, "o que influenciou"). A contribuição vem do próprio
 * classificador: a soma das três, com uma constante, dá o logit do escore, então a parte de cada
 * desenho é exata. Onde, dentro do desenho, esse peso se concentra fica no mapa sobre a imagem
 * (`mapa-sobre-o-desenho.tsx`).
 */
export function InfluenciaCard({
  titulo,
  influencia,
  styles,
}: Readonly<{ titulo: string; influencia: InfluenciaDoDesenho; styles: ResultadoStyles }>) {
  const lado =
    influencia.puxaPara === 'ccl' ? 'puxou o escore para CCL' : 'puxou o escore para sem CCL';
  const percentual = formatarPercentual(influencia.parteDoPeso);
  return (
    <View
      accessible
      accessibilityLabel={`Peso do ${titulo.toLowerCase()} no escore: ${percentual}, ${lado}`}
      style={styles.influencia}>
      <Text style={styles.influenciaTitulo}>{PESO_NO_ESCORE}</Text>
      <View style={styles.barra}>
        <View
          style={[
            styles.barraValor,
            influencia.puxaPara === 'ccl' ? styles.barraCcl : styles.barraSemCcl,
            { width: `${Math.round(influencia.parteDoPeso * 100)}%` },
          ]}
        />
      </View>
      <Text style={styles.influenciaTexto}>{`${percentual} do peso · ${lado}`}</Text>
    </View>
  );
}
