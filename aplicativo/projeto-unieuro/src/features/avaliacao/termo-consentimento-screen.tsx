import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { returnToLogin, useSession } from '@/features/auth/session';
import { QuemAssinaEscolha } from '@/features/avaliacao/quem-assina';
import { TermoConsentimento } from '@/features/avaliacao/termo-consentimento';
import { createTermoStyles, getTermoLayout } from '@/features/avaliacao/termo-consentimento.styles';
import { TERMO_TCLE, type QuemAssina, type TermoTcle } from '@/features/avaliacao/termo-tcle';
import { useTheme } from '@/hooks/use-theme';

export const ETAPA_CONSENTIMENTO = 'Etapa 2 de 5 · Consentimento';

/** O que a assinatura e o registro da decisão precisam saber do termo. */
export type ContextoDecisao = {
  quemAssina: QuemAssina;
  versaoTermo: string;
};

type TermoConsentimentoScreenProps = {
  /** Paciente do atendimento, para o profissional conferir quem está assinando. */
  paciente?: { nome: string; ficha: string };
  termo?: TermoTcle;
  /**
   * Área de assinatura e botões de aceitar e recusar (#21, parte do Eduardo). Fica
   * fora da rolagem do termo, para o gesto da assinatura não disputar com ela.
   */
  acoes: (contexto: ContextoDecisao) => ReactNode;
};

/**
 * Tela do termo de consentimento (#21). Mostra o termo e a escolha de quem assina;
 * a decisão é tomada nas ações recebidas. Nenhuma tarefa de desenho abre a partir
 * daqui antes do aceite.
 */
export default function TermoConsentimentoScreen({
  paciente,
  termo = TERMO_TCLE,
  acoes,
}: TermoConsentimentoScreenProps) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createTermoStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const layout = getTermoLayout(width);
  const [quemAssina, setQuemAssina] = useState<QuemAssina>('paciente');

  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  if (!professional) return null;

  const margem = { paddingHorizontal: layout.margem };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.cabecalho, margem]}>
        {paciente && (
          <Text style={styles.paciente}>
            {paciente.nome} · Ficha {paciente.ficha}
          </Text>
        )}
        <Text style={styles.etapa}>{ETAPA_CONSENTIMENTO}</Text>
      </View>
      <View style={[styles.corpo, margem, layout.duasColunas && styles.corpoDuasColunas]}>
        <TermoConsentimento styles={styles} termo={termo} />
        <View style={[styles.colunaDecisao, layout.duasColunas && styles.colunaDecisaoLateral]}>
          <View style={styles.cartaoDecisao}>
            <Text accessibilityRole="header" style={styles.declaracaoTitulo}>
              Declaração de consentimento
            </Text>
            <Text style={styles.declaracao}>{termo.declaracao}</Text>
            <QuemAssinaEscolha onChange={setQuemAssina} styles={styles} valor={quemAssina} />
          </View>
          {acoes({ quemAssina, versaoTermo: termo.versao })}
        </View>
      </View>
    </SafeAreaView>
  );
}
