import { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { FontFamilies, type ThemeColors } from '@/constants/theme';
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

function createAjustesStyles(theme: ThemeColors) {
  return StyleSheet.create({
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      paddingVertical: 12,
    },
    separador: { height: 1, backgroundColor: theme.border },
    textos: { flexShrink: 1, gap: 4 },
    titulo: { color: theme.text, fontFamily: FontFamilies.semibold, fontSize: 18, lineHeight: 24 },
    descricao: {
      color: theme.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 16,
      lineHeight: 22,
    },
  });
}

/**
 * Cartão "Ajustes do teste" das configurações (#24, protótipo 27): o profissional liga o
 * alto contraste e as letras maiores, e as telas do paciente seguem a escolha.
 */
export function AjustesDoTesteCard({ styles }: Readonly<{ styles: SettingsStyles }>) {
  const theme = useTheme();
  const proprios = useMemo(() => createAjustesStyles(theme), [theme]);
  const { ajustes, definirAjustes } = useAjustesDoTeste();

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {TITULO_AJUSTES}
      </Text>
      <Text style={styles.description}>{DESCRICAO_AJUSTES}</Text>
      <View>
        {AJUSTES.map(({ chave, titulo, descricao }, indice) => (
          <View key={chave}>
            {indice > 0 && <View style={proprios.separador} />}
            <View style={proprios.linha}>
              <View style={proprios.textos}>
                <Text style={proprios.titulo}>{titulo}</Text>
                <Text style={proprios.descricao}>{descricao}</Text>
              </View>
              <Switch
                accessible
                accessibilityRole="switch"
                accessibilityState={{ checked: ajustes[chave] }}
                accessibilityLabel={titulo}
                accessibilityHint={descricao}
                value={ajustes[chave]}
                onValueChange={(ligado) => definirAjustes({ ...ajustes, [chave]: ligado })}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={theme.onPrimary}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
