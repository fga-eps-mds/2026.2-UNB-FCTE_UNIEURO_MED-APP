import { StyleSheet } from 'react-native';

import { Colors, FontFamilies } from '@/constants/theme';
import { createSyncStyles } from '@/features/sincronizacao/sync.styles';

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;

describe('createSyncStyles', () => {
  const styles = createSyncStyles(Colors.light);

  describe('tamanhos do guia de identidade visual', () => {
    it('o menor texto tem 16 e o corpo tem 18', () => {
      expect(flat(styles.fieldLabel).fontSize).toBe(16);
      expect(flat(styles.hint).fontSize).toBe(16);
      expect(flat(styles.footer).fontSize).toBe(16);
      expect(flat(styles.text).fontSize).toBe(18);
      expect(flat(styles.input).fontSize).toBe(18);
    });

    it('os botões têm 64 de altura e texto 20', () => {
      for (const button of [styles.primaryButton, styles.outlineButton]) {
        expect(flat(button).minHeight).toBe(64);
      }
      for (const text of [styles.primaryButtonText, styles.outlineButtonText]) {
        expect(flat(text)).toMatchObject({ fontSize: 20, fontFamily: FontFamilies.semibold });
      }
    });

    it('os toques do topo têm pelo menos 48 de altura', () => {
      expect(flat(styles.back).minHeight).toBe(48);
      expect(flat(styles.textButton).minHeight).toBe(48);
    });

    it('o campo tem altura de toque confortável', () => {
      expect(flat(styles.input).minHeight).toBe(60);
    });
  });

  describe('cores do tema', () => {
    it('usa o fundo, os cartões e o botão principal do tema', () => {
      expect(flat(styles.safeArea).backgroundColor).toBe(Colors.light.background);
      expect(flat(styles.card).backgroundColor).toBe(Colors.light.surface);
      expect(flat(styles.primaryButton).backgroundColor).toBe(Colors.light.primary);
      expect(flat(styles.primaryButtonText).color).toBe(Colors.light.onPrimary);
      expect(flat(styles.outlineButton).borderColor).toBe(Colors.light.primary);
    });

    it('acompanha o tema escuro', () => {
      const dark = createSyncStyles(Colors.dark);

      expect(flat(dark.safeArea).backgroundColor).toBe(Colors.dark.background);
      expect(flat(dark.text).color).toBe(Colors.dark.text);
      expect(flat(dark.input).backgroundColor).toBe(Colors.dark.field);
    });
  });

  describe('disposição', () => {
    it('os cartões quebram em colunas que se ajustam à largura', () => {
      expect(flat(styles.grid)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
      expect(flat(styles.mainColumn).flexBasis).toBe(420);
      expect(flat(styles.sideColumn).flexBasis).toBe(320);
    });

    it('os dígitos de conferência ficam grandes e espaçados para comparar de longe', () => {
      expect(flat(styles.digits)).toMatchObject({ fontSize: 48, letterSpacing: 12 });
    });
  });
});
