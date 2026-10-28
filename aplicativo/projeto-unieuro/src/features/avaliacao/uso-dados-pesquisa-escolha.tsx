import { Pressable, Text, View } from 'react-native';

import type { TermoStyles } from '@/features/avaliacao/termo-consentimento.styles';

export type EscolhasUsoPesquisa = {
  autorizaImagensPesquisa: boolean | null;
  autorizaDadosPesquisaFutura: boolean | null;
};

type Props = {
  styles: TermoStyles;
  valores: EscolhasUsoPesquisa;
  onChange: (valores: EscolhasUsoPesquisa) => void;
};

const OPCOES: readonly { rotulo: string; valor: boolean }[] = [
  { rotulo: 'Sim', valor: true },
  { rotulo: 'Não', valor: false },
];

export function UsoDadosPesquisaEscolha({ styles, valores, onChange }: Readonly<Props>) {
  const perguntas = [
    {
      chave: 'autorizaImagensPesquisa' as const,
      titulo: '9) Uso das imagens dos desenhos',
      texto:
        'Autorizo o uso das imagens dos meus desenhos somente nesta pesquisa. As imagens são dos desenhos, não do meu rosto.',
      ajuda: 'Se marcar NÃO, não é possível participar: a análise por IA depende das imagens.',
    },
    {
      chave: 'autorizaDadosPesquisaFutura' as const,
      titulo: '10) Uso dos dados em pesquisas futuras',
      texto:
        'Autorizo o uso dos meus dados e desenhos em outras pesquisas aprovadas por Comitê de Ética, com sigilo.',
      ajuda: 'Marcar NÃO não impede a participação nesta pesquisa.',
    },
  ];

  return (
    <>
      {perguntas.map((pergunta) => (
        <View key={pergunta.chave} style={styles.cartaoEscolhaConsentimento}>
          <Text style={styles.tituloEscolhaConsentimento}>{pergunta.titulo}</Text>
          <Text style={styles.textoEscolhaConsentimento}>{pergunta.texto}</Text>
          <View style={styles.opcoesConsentimento}>
            {OPCOES.map((opcao) => {
              const marcada = valores[pergunta.chave] === opcao.valor;
              return (
                <Pressable
                  key={opcao.rotulo}
                  accessibilityLabel={`${pergunta.chave === 'autorizaImagensPesquisa' ? 'Uso das imagens' : 'Uso futuro'}: ${opcao.rotulo}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: marcada }}
                  onPress={() => onChange({ ...valores, [pergunta.chave]: opcao.valor })}
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
          <Text style={styles.ajudaEscolhaConsentimento}>{pergunta.ajuda}</Text>
        </View>
      ))}
    </>
  );
}
