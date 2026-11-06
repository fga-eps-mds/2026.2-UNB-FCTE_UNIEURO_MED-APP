import { Pressable, Text, View } from 'react-native';

import type { TermoStyles } from '@/features/avaliacao/termo-consentimento.styles';
import { QUEM_ASSINA_OPCOES, type QuemAssina } from '@/features/avaliacao/termo-tcle';

type QuemAssinaProps = {
  valor: QuemAssina;
  onChange: (valor: QuemAssina) => void;
  styles: TermoStyles;
};

/**
 * Quem assina o termo: o paciente ou, quando ele não pode assinar, o responsável
 * legal (#21, cenários de aceite). O valor vai junto com a decisão gravada.
 */
export function QuemAssinaEscolha({ valor, onChange, styles }: Readonly<QuemAssinaProps>) {
  return (
    // Sem papel de grupo acessível: no Android, um grupo acessível esconde as
    // opções do leitor de tela. Cada opção é um rádio com o próprio rótulo.
    <View style={styles.quemAssina}>
      <Text style={styles.quemAssinaRotulo}>Quem assina</Text>
      {/* As duas opções formam um grupo: se não couberem ao lado do rótulo, o grupo todo desce
          para a linha de baixo, mas as opções nunca se separam uma da outra. */}
      <View style={styles.quemAssinaOpcoes}>
        {QUEM_ASSINA_OPCOES.map((opcao) => {
          const marcada = opcao.valor === valor;
          return (
            <Pressable
              key={opcao.valor}
              accessibilityLabel={opcao.rotulo}
              accessibilityRole="radio"
              accessibilityState={{ checked: marcada }}
              onPress={() => onChange(opcao.valor)}
              style={({ pressed }) => [
                styles.opcao,
                styles.opcaoQuemAssina,
                marcada && styles.opcaoMarcada,
                pressed && styles.opcaoPressionada,
              ]}>
              <View style={[styles.radio, marcada && styles.radioMarcado]}>
                {marcada && <View style={styles.radioPonto} />}
              </View>
              <Text style={styles.opcaoTexto}>{opcao.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
