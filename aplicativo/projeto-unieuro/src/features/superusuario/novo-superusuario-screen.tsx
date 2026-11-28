import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import { WIDE_LAYOUT_MIN_WIDTH } from '@/features/home/home.styles';
import { createAccountFormStyles } from '@/features/settings/account-form.styles';
import { FormField } from '@/features/settings/form-field';
import { createSettingsStyles } from '@/features/settings/settings.styles';
import { formatCpfInput } from '@/features/shared/cpf';
import { MAX_NAME_LENGTH } from '@/features/shared/name';
import { useSomenteSuperusuario } from '@/features/superusuario/acesso';
import {
  criarSuperusuario,
  type CriacaoRepository,
  type NovoSuperusuarioErros,
  type NovoSuperusuarioInput,
} from '@/features/superusuario/criar-superusuario';
import { useTheme } from '@/hooks/use-theme';

export const SUPERUSUARIO_CRIADO =
  'Superusuário criado. A nova conta já pode entrar com o e-mail e a senha cadastrados.';
export const FALHA_AO_CRIAR =
  'Não foi possível criar o superusuário. Tente de novo. Se o erro continuar, reinicie o aplicativo.';

const vazio: NovoSuperusuarioInput = {
  name: '',
  email: '',
  crm: '',
  cpf: '',
  password: '',
  passwordConfirmation: '',
};

type Aviso = { kind: 'error' | 'success'; message: string };

type NovoSuperusuarioScreenProps = { repository: CriacaoRepository };

/**
 * "Novo superusuário", só um superusuário cadastra outro. Os campos
 * são os do cadastro comum. Um médico comum não chega aqui, nem pela rota.
 */
export default function NovoSuperusuarioScreen({ repository }: NovoSuperusuarioScreenProps) {
  const router = useRouter();
  const profissional = useSomenteSuperusuario();
  const theme = useTheme();
  const styles = useMemo(() => createSettingsStyles(theme), [theme]);
  const form = useMemo(() => createAccountFormStyles(theme), [theme]);
  const isWide = useWindowDimensions().width >= WIDE_LAYOUT_MIN_WIDTH;
  const [valores, setValores] = useState(vazio);
  const [erros, setErros] = useState<NovoSuperusuarioErros>({});
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  if (!profissional) return null;

  const editar =
    (campo: keyof NovoSuperusuarioInput, mascara?: (texto: string) => string) =>
    (texto: string) => {
      setValores((atual) => ({ ...atual, [campo]: mascara ? mascara(texto) : texto }));
      setErros((atual) => ({ ...atual, [campo]: undefined }));
    };

  async function criar() {
    if (enviando || !profissional) return;
    setEnviando(true);
    setAviso(null);
    try {
      const resultado = await criarSuperusuario(profissional.id, valores, repository);
      if (!resultado.success) {
        const { geral, ...campos } = resultado.errors;
        setErros(campos);
        if (geral) setAviso({ kind: 'error', message: geral });
        return;
      }
      setErros({});
      setValores(vazio);
      setAviso({ kind: 'success', message: SUPERUSUARIO_CRIADO });
    } catch {
      setAviso({ kind: 'error', message: FALHA_AO_CRIAR });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.topBar, isWide && styles.topBarWide]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para a área do superusuário"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Área do superusuário</Text>
        </Pressable>
        <View style={styles.accountText}>
          <Text style={styles.professionalName} numberOfLines={1}>
            {profissional.name}
          </Text>
          <Text style={styles.label}>Superusuário</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>
          Novo superusuário
        </Text>
        <Text style={form.subtitle}>
          Cadastre outro responsável pela pesquisa. A nova conta vê os exames de todos e gerencia as
          contas deste tablet. Os médicos continuam se cadastrando pela tela de cadastro.
        </Text>

        <View style={styles.card}>
          <FormField
            styles={form}
            label="NOME COMPLETO"
            autoCapitalize="words"
            autoComplete="name"
            maxLength={MAX_NAME_LENGTH}
            value={valores.name}
            onChangeText={editar('name')}
            error={erros.name}
          />
          <FormField
            styles={form}
            label="E-MAIL"
            autoComplete="email"
            keyboardType="email-address"
            value={valores.email}
            onChangeText={editar('email')}
            error={erros.email}
          />
          <View style={form.row}>
            <FormField
              styles={form}
              label="CRM"
              containerStyle={form.rowItem}
              placeholder="12345/DF"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={20}
              value={valores.crm}
              onChangeText={editar('crm')}
              error={erros.crm}
            />
            <FormField
              styles={form}
              label="CPF"
              containerStyle={form.rowItem}
              placeholder="000.000.000-00"
              keyboardType="numeric"
              autoComplete="off"
              maxLength={14}
              value={valores.cpf}
              onChangeText={editar('cpf', formatCpfInput)}
              error={erros.cpf}
            />
          </View>
          <View style={form.row}>
            <FormField
              styles={form}
              label="SENHA"
              containerStyle={form.rowItem}
              secureTextEntry
              autoComplete="new-password"
              value={valores.password}
              onChangeText={editar('password')}
              error={erros.password}
            />
            <FormField
              styles={form}
              label="CONFIRMAR SENHA"
              containerStyle={form.rowItem}
              secureTextEntry
              autoComplete="new-password"
              value={valores.passwordConfirmation}
              onChangeText={editar('passwordConfirmation')}
              error={erros.passwordConfirmation}
            />
          </View>
          <Text style={form.hint}>Combine a senha com quem vai usar a conta.</Text>
          <View style={form.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [form.secondaryButton, pressed && styles.pressed]}>
              <Text style={form.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Criar superusuário"
              accessibilityState={{ busy: enviando, disabled: enviando }}
              disabled={enviando}
              onPress={criar}
              style={({ pressed }) => [
                form.primaryButton,
                (pressed || enviando) && styles.pressed,
              ]}>
              {enviando ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={form.primaryButtonText}>Criar superusuário</Text>
              )}
            </Pressable>
          </View>
          {aviso && <FeedbackMessage {...aviso} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
