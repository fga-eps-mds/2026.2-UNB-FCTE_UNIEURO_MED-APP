import { Pressable, Switch, Text, View } from 'react-native';

import { useAjustesDoTeste, type AjustesDoTeste } from '@/features/acessibilidade/ajustes-do-teste';
import type { SettingsStyles } from '@/features/settings/settings.styles';
import { useTheme } from '@/hooks/use-theme';

export const TITULO_AJUSTES = 'Ajustes do teste';
export const DESCRICAO_AJUSTES = 'Valem para as telas que o paciente usa.';

const AJUSTES: { chave: keyof AjustesDoTeste; titulo: string; descricao: string }[] = [
  {
    chave: 'altoContraste',
    titulo: 'Alto contraste',
    descricao: 'Cores mais fortes nas instruções e botões.',
  },
  {
    chave: 'letrasMaiores',
    titulo: 'Letras maiores',
    descricao: 'Aumenta o texto das instruções.',
  },
];

/**
 * Cartão "Ajustes do teste" das configurações (#24, protótipo 27): o profissional liga o
 * alto contraste e as letras maiores, e as telas do paciente seguem a escolha.
 *
 * A linha inteira é o interruptor: um toque em qualquer ponto dela liga ou desliga, e o
 * leitor de tela lê o nome, o estado e a explicação uma vez só. O `Switch` de dentro fica
 * fora do leitor de tela, mas continua respondendo ao toque e ao arraste.
 */
export function AjustesDoTesteCard({ styles }: Readonly<{ styles: SettingsStyles }>) {
  const theme = useTheme();
  const { ajustes, definirAjustes } = useAjustesDoTeste();
  const mudar = (chave: keyof AjustesDoTeste, ligado: boolean) =>
    definirAjustes({ ...ajustes, [chave]: ligado });

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {TITULO_AJUSTES}
      </Text>
      <Text style={styles.description}>{DESCRICAO_AJUSTES}</Text>
      <View>
        {AJUSTES.map(({ chave, titulo, descricao }, indice) => (
          <View key={chave}>
            {indice > 0 && <View style={styles.ajusteSeparador} />}
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: ajustes[chave] }}
              accessibilityLabel={titulo}
              accessibilityHint={descricao}
              onPress={() => mudar(chave, !ajustes[chave])}
              style={styles.ajusteLinha}>
              <View style={styles.ajusteTextos}>
                <Text style={styles.ajusteTitulo}>{titulo}</Text>
                <Text style={styles.ajusteDescricao}>{descricao}</Text>
              </View>
              <Switch
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                testID={`interruptor-${chave}`}
                value={ajustes[chave]}
                onValueChange={(ligado) => mudar(chave, ligado)}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={theme.onPrimary}
              />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
