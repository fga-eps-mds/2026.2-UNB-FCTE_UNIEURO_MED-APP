import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { returnToLogin, useSession } from '@/features/auth/session';
import { CpfResponsavelCampo } from '@/features/avaliacao/cpf-responsavel';
import { QuemAssinaEscolha } from '@/features/avaliacao/quem-assina';
import {
  UsoDadosPesquisaEscolha,
  type EscolhasUsoPesquisa,
} from '@/features/avaliacao/uso-dados-pesquisa-escolha';
import { TermoConsentimento } from '@/features/avaliacao/termo-consentimento';
import { createTermoStyles, getTermoLayout } from '@/features/avaliacao/termo-consentimento.styles';
import { TERMO_TCLE, type QuemAssina, type TermoTcle } from '@/features/avaliacao/termo-tcle';
import { parseCpf } from '@/features/shared/cpf';
import { useTheme } from '@/hooks/use-theme';

export const ETAPA_CONSENTIMENTO = 'Etapa 2 de 5 · Consentimento';

/** O que a assinatura e o registro da decisão precisam saber do termo. */
export type ContextoDecisao = {
  quemAssina: QuemAssina;
  /**
   * CPF do responsável legal, só com os 11 dígitos, quando ele assina e o CPF é
   * válido. É `null` para o paciente e enquanto o CPF estiver vazio ou inválido.
   */
  cpfResponsavel: string | null;
  versaoTermo: string;
  autorizaImagensPesquisa: boolean | null;
  autorizaDadosPesquisaFutura: boolean | null;
};

type TermoConsentimentoScreenProps = {
  /** Paciente do atendimento, para o profissional conferir quem está assinando. */
  paciente?: { nome: string; ficha: string };
  termo?: TermoTcle;
  /**
   * Área de assinatura, dentro do cartão da declaração, logo abaixo de "Quem assina"
   * (#21, parte do Eduardo). Fica fora da rolagem do termo.
   */
  assinatura?: ReactNode;
  /**
   * Botões de aceitar e recusar (#21, parte do Eduardo), abaixo do cartão. Ficam fora
   * da rolagem do termo, para o gesto da assinatura não disputar com ela.
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
  assinatura,
  acoes,
}: Readonly<TermoConsentimentoScreenProps>) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createTermoStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const layout = getTermoLayout(width);
  const [quemAssina, setQuemAssina] = useState<QuemAssina>('paciente');
  const [cpfResponsavelTexto, setCpfResponsavelTexto] = useState('');
  const [escolhasPesquisa, setEscolhasPesquisa] = useState<EscolhasUsoPesquisa>({
    autorizaImagensPesquisa: null,
    autorizaDadosPesquisaFutura: null,
  });

  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  if (!professional) return null;

  const margem = { paddingHorizontal: layout.margem };
  const responsavelAssina = quemAssina === 'responsavel_legal';
  // O CPF só vale para o responsável legal que assina; para o paciente, nem é lido.
  const cpfResponsavel = responsavelAssina ? parseCpf(cpfResponsavelTexto) : null;

  function escolherQuemAssina(valor: QuemAssina) {
    setQuemAssina(valor);
    // Ao voltar para "Paciente", o CPF digitado é descartado.
    if (valor === 'paciente') setCpfResponsavelTexto('');
  }

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
      <View
        // A chave força o layout a ser refeito ao girar o tablet.
        key={layout.duasColunas ? 'horizontal' : 'vertical'}
        style={[styles.corpo, margem, layout.duasColunas && styles.corpoDuasColunas]}>
        <TermoConsentimento styles={styles} termo={termo} layoutLateral={layout.duasColunas} />
        <View style={[styles.painel, layout.duasColunas && styles.painelLateral]}>
          <ScrollView
            accessibilityLabel="Escolhas, declaração e assinatura"
            contentContainerStyle={styles.painelConteudo}
            keyboardShouldPersistTaps="handled"
            style={[styles.painelRolagem, layout.duasColunas && styles.painelRolagemLateral]}>
            <UsoDadosPesquisaEscolha
              styles={styles}
              valores={escolhasPesquisa}
              onChange={setEscolhasPesquisa}
            />
            <View style={styles.cartaoDecisao}>
              <Text accessibilityRole="header" style={styles.declaracaoTitulo}>
                Declaração de consentimento
              </Text>
              <Text style={styles.declaracao}>{termo.declaracao}</Text>
              <QuemAssinaEscolha onChange={escolherQuemAssina} styles={styles} valor={quemAssina} />
              {responsavelAssina && (
                <CpfResponsavelCampo
                  onChange={setCpfResponsavelTexto}
                  styles={styles}
                  valor={cpfResponsavelTexto}
                />
              )}
              {assinatura}
            </View>
          </ScrollView>
          <View style={styles.rodape}>
            {acoes({
              quemAssina,
              cpfResponsavel,
              versaoTermo: termo.versao,
              ...escolhasPesquisa,
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
