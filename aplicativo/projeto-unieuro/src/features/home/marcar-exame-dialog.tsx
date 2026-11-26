import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandPalette, FontFamilies, type ThemeColors } from '@/constants/theme';
import {
  ROTULO_MARCACAO,
  TIPOS_MARCACAO,
  type ResultadoMarcacao,
  type TipoMarcacao,
} from '@/features/avaliacao/marcacao';
import { createAccountFormStyles } from '@/features/settings/account-form.styles';
import { FormField } from '@/features/settings/form-field';
import { useTheme } from '@/hooks/use-theme';

export const FALHA_AO_MARCAR = 'Não foi possível gravar agora. Tente de novo.';

/** O que o diálogo faz: marcar o exame sem marcação, ou desfazer a marcação dele. */
export type MarcacaoPedida = { acao: 'marcar' } | { acao: 'desmarcar'; marcacao: TipoMarcacao };

type MarcarExameDialogProps = {
  visible: boolean;
  pedido: MarcacaoPedida;
  /** Data e hora do exame, como a linha da lista mostra. */
  quando: string;
  /** Grava a marcação ou a desfaz. Só devolve `feito` depois de conferir a senha. */
  onConfirm: (tipo: TipoMarcacao | null, senha: string) => Promise<ResultadoMarcacao>;
  onCancel: () => void;
  onDone: () => void;
};

function createOpcaoStyles(theme: ThemeColors) {
  return StyleSheet.create({
    grupo: { gap: 6 },
    opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    opcao: {
      flexGrow: 1,
      flexBasis: 200,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.field,
    },
    opcaoEscolhida: { borderColor: theme.primary, backgroundColor: BrandPalette.lightPeach },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
    },
    radioEscolhido: { borderColor: theme.primary },
    ponto: { width: 11, height: 11, borderRadius: 6, backgroundColor: theme.primary },
    texto: { color: theme.textSecondary, fontFamily: FontFamilies.semibold, fontSize: 18 },
    textoEscolhido: { color: theme.primary },
  });
}

/**
 * Confirmação da marcação do exame como teste ou material de ensino (#58), e de
 * quando ela é desfeita. Nada é apagado: o diálogo diz isso antes de pedir a senha.
 */
export function MarcarExameDialog({
  visible,
  pedido,
  quando,
  onConfirm,
  onCancel,
  onDone,
}: Readonly<MarcarExameDialogProps>) {
  const theme = useTheme();
  const form = useMemo(() => createAccountFormStyles(theme), [theme]);
  const opcao = useMemo(() => createOpcaoStyles(theme), [theme]);
  const [tipo, setTipo] = useState<TipoMarcacao | null>(null);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string>();
  const [gravando, setGravando] = useState(false);
  const marcar = pedido.acao === 'marcar';
  const botao = marcar ? 'Marcar exame' : 'Desfazer marcação';

  function limpar() {
    setTipo(null);
    setSenha('');
    setErro(undefined);
  }

  function cancelar() {
    limpar();
    onCancel();
  }

  async function confirmar() {
    if (gravando) return;
    setGravando(true);
    try {
      const resultado = await onConfirm(marcar ? tipo : null, senha);
      if (!resultado.feito) {
        setErro(resultado.mensagem);
        return;
      }
      limpar();
      onDone();
    } catch {
      setErro(FALHA_AO_MARCAR);
    } finally {
      setGravando(false);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={cancelar}>
      <View style={form.backdrop}>
        <View style={form.dialog} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={form.dialogTitle}>
            {marcar ? 'Marcar este exame?' : 'Desfazer a marcação?'}
          </Text>
          <Text style={form.dialogText}>
            {marcar
              ? `O exame de ${quando} continua na lista do paciente e no tablet. Nada é apagado: na exportação, ele sai com a marcação.`
              : `O exame de ${quando} deixa de ser ${ROTULO_MARCACAO[pedido.marcacao]} e volta a contar como exame da pesquisa.`}
          </Text>

          {marcar && (
            <View style={opcao.grupo}>
              <Text style={form.label}>MARCAR COMO</Text>
              <View accessibilityRole="radiogroup" style={opcao.opcoes}>
                {TIPOS_MARCACAO.map(({ id, rotulo }) => {
                  const escolhido = tipo === id;
                  return (
                    <Pressable
                      key={id}
                      accessibilityRole="radio"
                      accessibilityLabel={rotulo}
                      accessibilityState={{ checked: escolhido }}
                      onPress={() => {
                        setTipo(id);
                        setErro(undefined);
                      }}
                      style={[opcao.opcao, escolhido && opcao.opcaoEscolhida]}>
                      <View style={[opcao.radio, escolhido && opcao.radioEscolhido]}>
                        {escolhido && <View style={opcao.ponto} />}
                      </View>
                      <Text style={[opcao.texto, escolhido && opcao.textoEscolhido]}>{rotulo}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <FormField
            styles={form}
            label="CONFIRME COM A SUA SENHA"
            secureTextEntry
            autoComplete="current-password"
            value={senha}
            onChangeText={(texto) => {
              setSenha(texto);
              setErro(undefined);
            }}
            error={erro}
          />
          <Text style={form.hint}>
            {marcar
              ? 'A marcação fica registrada com o tipo, a data, a hora e o profissional.'
              : 'O aplicativo registra quem desfez a marcação, com a data e a hora.'}
          </Text>
          <View style={form.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={cancelar}
              style={({ pressed }) => [form.secondaryButton, pressed && form.disabled]}>
              <Text style={form.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={botao}
              accessibilityState={{ busy: gravando, disabled: gravando }}
              disabled={gravando}
              onPress={confirmar}
              style={({ pressed }) => [form.primaryButton, (pressed || gravando) && form.disabled]}>
              {gravando ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={form.primaryButtonText}>{botao}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
