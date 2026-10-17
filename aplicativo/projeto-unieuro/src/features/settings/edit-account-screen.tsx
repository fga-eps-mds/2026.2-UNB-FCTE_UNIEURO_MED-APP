import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  changePassword,
  updateProfile,
  type AccountProfile,
  type AccountRepository,
  type PasswordChangeInput,
  type PasswordErrors,
  type ProfileErrors,
} from '@/features/auth/account';
import { formatCrm, useSession } from '@/features/auth/session';
import { WIDE_LAYOUT_MIN_WIDTH } from '@/features/home/home.styles';
import { createAccountFormStyles } from '@/features/settings/account-form.styles';
import { FormField } from '@/features/settings/form-field';
import { createSettingsStyles } from '@/features/settings/settings.styles';
import { useTheme } from '@/hooks/use-theme';

const emptyPasswordChange: PasswordChangeInput = {
  currentPassword: '',
  newPassword: '',
  confirmation: '',
};

const showUnexpectedError = () =>
  Alert.alert(
    'Não foi possível salvar',
    'Tente de novo. Se o erro continuar, reinicie o aplicativo.',
  );

type EditAccountScreenProps = { repository: AccountRepository };

/**
 * "Editar meus dados" (#5): corrige o nome, o e-mail e o CRM e troca a senha.
 * As duas ações pedem a senha atual. O CPF não muda e não aparece na tela.
 */
export default function EditAccountScreen({ repository }: EditAccountScreenProps) {
  const router = useRouter();
  const { professional, signIn } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createSettingsStyles(theme), [theme]);
  const form = useMemo(() => createAccountFormStyles(theme), [theme]);
  const isWide = useWindowDimensions().width >= WIDE_LAYOUT_MIN_WIDTH;

  const [profile, setProfile] = useState<AccountProfile>(() => ({
    name: professional?.name ?? '',
    email: professional?.email ?? '',
    crmNumber: professional?.crmNumber ?? '',
    crmState: professional?.crmState ?? '',
  }));
  const [profilePassword, setProfilePassword] = useState('');
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordChange, setPasswordChange] = useState(emptyPasswordChange);
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!professional) router.replace('/');
  }, [professional, router]);

  if (!professional) return null;

  const editProfile = (field: keyof AccountProfile) => (value: string) =>
    setProfile((current) => ({ ...current, [field]: value }));

  const editPassword = (field: keyof PasswordChangeInput) => (value: string) =>
    setPasswordChange((current) => ({ ...current, [field]: value }));

  async function saveProfile() {
    if (savingProfile || !professional) return;
    setSavingProfile(true);
    try {
      const result = await updateProfile(professional.id, profile, profilePassword, repository);
      if (!result.success) {
        setProfileErrors(result.errors);
        return;
      }
      setProfileErrors({});
      signIn(result.profile);
      Alert.alert('Dados atualizados', 'Os novos dados já valem para os próximos exames.');
      router.back();
    } catch {
      showUnexpectedError();
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (savingPassword || !professional) return;
    setSavingPassword(true);
    try {
      const result = await changePassword(professional.id, passwordChange, repository);
      if (!result.success) {
        setPasswordErrors(result.errors);
        return;
      }
      setPasswordErrors({});
      setPasswordChange(emptyPasswordChange);
      Alert.alert('Senha alterada', 'Use a nova senha na próxima vez que entrar.');
    } catch {
      showUnexpectedError();
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.topBar, isWide && styles.topBarWide]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para as configurações"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Configurações</Text>
        </Pressable>
        <View style={styles.accountText}>
          <Text style={styles.professionalName}>{professional.name}</Text>
          <Text style={styles.label}>CRM {formatCrm(professional)}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>
          Editar meus dados
        </Text>
        <Text style={form.subtitle}>
          As mudanças valem para os próximos exames. Os exames já aplicados continuam com o seu
          registro.
        </Text>

        <View style={styles.grid}>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Dados do cadastro
            </Text>
            <FormField
              styles={form}
              label="NOME COMPLETO"
              autoCapitalize="words"
              autoComplete="name"
              value={profile.name}
              onChangeText={editProfile('name')}
              error={profileErrors.name}
            />
            <FormField
              styles={form}
              label="E-MAIL"
              autoComplete="email"
              keyboardType="email-address"
              value={profile.email}
              onChangeText={editProfile('email')}
              error={profileErrors.email}
            />
            <View style={form.row}>
              <FormField
                styles={form}
                label="CRM"
                keyboardType="numeric"
                maxLength={10}
                value={profile.crmNumber}
                onChangeText={editProfile('crmNumber')}
                error={profileErrors.crmNumber}
              />
              <FormField
                styles={form}
                label="UF DO CRM"
                autoCapitalize="characters"
                maxLength={2}
                value={profile.crmState}
                onChangeText={editProfile('crmState')}
                error={profileErrors.crmState}
              />
            </View>
            <View style={form.field}>
              <Text style={form.label}>CPF</Text>
              <View
                style={form.lockedInput}
                accessible
                accessibilityLabel="CPF não pode ser alterado">
                <Text style={form.lockedText}>000.000.000-00</Text>
                <Text style={form.lockedHint}>Não pode ser alterado</Text>
              </View>
            </View>
            <View style={form.actions}>
              <FormField
                styles={form}
                label="CONFIRME COM A SUA SENHA ATUAL"
                secureTextEntry
                autoComplete="current-password"
                value={profilePassword}
                onChangeText={setProfilePassword}
                error={profileErrors.currentPassword}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [form.secondaryButton, pressed && styles.pressed]}>
                <Text style={form.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Salvar"
                accessibilityState={{ busy: savingProfile, disabled: savingProfile }}
                disabled={savingProfile}
                onPress={saveProfile}
                style={({ pressed }) => [
                  form.primaryButton,
                  (pressed || savingProfile) && styles.pressed,
                ]}>
                {savingProfile ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <Text style={form.primaryButtonText}>Salvar</Text>
                )}
              </Pressable>
            </View>
            <Text style={form.hint}>
              Se o e-mail ou o CRM já forem de outra conta do tablet, nada é alterado.
            </Text>
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Trocar a senha
            </Text>
            <FormField
              styles={form}
              label="SENHA ATUAL"
              secureTextEntry
              autoComplete="current-password"
              value={passwordChange.currentPassword}
              onChangeText={editPassword('currentPassword')}
              error={passwordErrors.currentPassword}
            />
            <FormField
              styles={form}
              label="NOVA SENHA"
              secureTextEntry
              autoComplete="new-password"
              value={passwordChange.newPassword}
              onChangeText={editPassword('newPassword')}
              error={passwordErrors.newPassword}
            />
            <FormField
              styles={form}
              label="CONFIRMAR NOVA SENHA"
              secureTextEntry
              autoComplete="new-password"
              value={passwordChange.confirmation}
              onChangeText={editPassword('confirmation')}
              error={passwordErrors.confirmation}
            />
            <Text style={form.hint}>A nova senha segue as mesmas regras do cadastro.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trocar senha"
              accessibilityState={{ busy: savingPassword, disabled: savingPassword }}
              disabled={savingPassword}
              onPress={savePassword}
              style={({ pressed }) => [
                form.primaryButton,
                (pressed || savingPassword) && styles.pressed,
              ]}>
              {savingPassword ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={form.primaryButtonText}>Trocar senha</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
