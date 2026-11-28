import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandPalette, FontFamilies, type ThemeColors } from '@/constants/theme';
import {
  ESCOLHA_O_TIPO,
  ROTULO_MARCACAO,
  SENHA_VAZIA,
  TIPOS_MARCACAO,
  type ResultadoMarcacao,
  type TipoMarcacao,
} from '@/features/avaliacao/marcacao';
import { createAccountFormStyles } from '@/features/settings/account-form.styles';
import { FormField } from '@/features/settings/form-field';
import { useTheme } from '@/hooks/use-theme';

/** Mensagem exibida quando ocorre falha inesperada ao gravar no banco local. */
export const FALHA_AO_MARCAR = 'Não foi possível salvar a marcação do paciente. Tente de novo.';

/**
 * O que o diálogo faz (#47): marcar os exames do médico neste paciente como teste
 * ou material de ensino, ou desfazer a marcação existente.
 */
export type MarcacaoPacientePedida =
  | { acao: 'marcar' }
  | { acao: 'desmarcar'; marcacoes: readonly TipoMarcacao[] };

type MarcarPacienteDialogProps = {
  visible: boolean;
  pedido: MarcacaoPacientePedida;
  /** Nome do paciente exibido no texto de confirmação. */
  paciente: string;
  /** Grava a marcação ou a desfaz. Só devolve `feito` depois de conferir a senha. */
  onConfirm: (tipo: TipoMarcacao | null, senha: string) => Promise<ResultadoMarcacao>;
  onCancel: () => void;
  /**
   * A marcação do paciente já tinha mudado (outro pedido marcou ou desfez antes). O
   * diálogo fecha, e quem o abriu mostra a mensagem e relê o paciente.
   */
  onDesatualizado: (mensagem: string) => void;
  onDone: () => void;
};

/** Estilos dos botões de rádio para escolha do tipo de marcação. */
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
 * Confirmação da marcação do paciente como teste ou material de ensino (#47), e de
 * quando ela é desfeita. Nada é apagado: o diálogo informa que o paciente e os exames
 * continuam no tablet e que apenas os exames do médico logado recebem a marcação.
 */
export function MarcarPacienteDialog({
  visible,
  pedido,
  paciente,
  onConfirm,
  onCancel,
  onDesatualizado,
  onDone,
}: Readonly<MarcarPacienteDialogProps>) {
  const theme = useTheme();
  const form = useMemo(() => createAccountFormStyles(theme), [theme]);
  const opcao = useMemo(() => createOpcaoStyles(theme), [theme]);
  const [tipo, setTipo] = useState<TipoMarcacao | null>(null);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string>();
  const [gravando, setGravando] = useState(false);

  const marcar = pedido.acao === 'marcar';
  const botao = marcar ? 'Confirmar marcação' : 'Desfazer marcação';

  /** Restaura o estado interno ao fechar ou concluir a confirmação. */
  function limpar() {
    setTipo(null);
    setSenha('');
    setErro(undefined);
  }

  /** Cancela sem alterar os exames do paciente (cenário "marcação cancelada"). */
  function cancelar() {
    if (gravando) return;
    limpar();
    onCancel();
  }

  /** Valida tipo/senha e delega a gravação transacional para a regra de negócio. */
  async function confirmar() {
    if (gravando) return;
    if (marcar && tipo === null) {
      setErro(ESCOLHA_O_TIPO);
      return;
    }
    if (senha.length === 0) {
      setErro(SENHA_VAZIA);
      return;
    }
    setGravando(true);
    setErro(undefined);
    try {
      const resultado = await onConfirm(marcar ? tipo : null, senha);
      if (!resultado.feito) {
        if (resultado.desatualizado) {
          limpar();
          onDesatualizado(resultado.mensagem);
          return;
        }
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

  // Lista legível das marcações atuais para o texto ao desfazer.
  const rotuloAtual =
    !marcar && pedido.marcacoes.length > 0
      ? pedido.marcacoes.map((m) => ROTULO_MARCACAO[m]).join(' e ')
      : '';

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={cancelar}>
      <View style={form.backdrop}>
        <View style={form.dialog} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={form.dialogTitle}>
            {marcar ? 'Marcar este paciente?' : 'Desfazer a marcação do paciente?'}
          </Text>
          <Text style={form.dialogText}>
            {marcar
              ? `Os exames que você aplicou em ${paciente} recebem a marcação. Nada é apagado: o paciente e os exames continuam no tablet, e a exportação mostra a marcação.`
              : `Os exames que você aplicou em ${paciente} deixam de ser ${rotuloAtual} e voltam a contar como exames da pesquisa.`}
          </Text>

          {/* Escolha do tipo ("Teste" ou "Material de ensino") só aparece ao marcar. */}
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

          {/* Confirmação pela própria senha do médico antes de gravar a marcação. */}
          <FormField
            styles={form}
            label="CONFIRME COM A SUA SENHA"
            secureTextEntry
            autoComplete="current-password"
            value={senha}
            onChangeText={(texto: string) => {
              setSenha(texto);
              setErro(undefined);
            }}
            error={erro}
          />
          <Text style={form.hint}>
            {marcar
              ? 'A marcação fica registrada com o tipo, a data, a hora e o profissional. Exames de outros médicos não mudam.'
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
