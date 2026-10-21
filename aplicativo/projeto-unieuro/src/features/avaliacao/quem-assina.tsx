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
export function QuemAssinaEscolha({ valor, onChange, styles }: QuemAssinaProps) {
  return (
    // Sem papel de grupo acessível: no Android, um grupo acessível esconde as
    // opções do leitor de tela. Cada opção é um rádio com o próprio rótulo.
    <View style={styles.quemAssina}>
      <Text style={styles.quemAssinaRotulo}>Quem assina</Text>
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
  );
}
