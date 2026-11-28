import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { BrandPalette } from '@/constants/theme';
import { FeedbackMessage } from '@/features/auth/feedback-message';
import ExamStatusChip from '@/features/home/exam-status-chip';
import {
  createHomeStyles,
  WIDE_LAYOUT_MIN_WIDTH,
  type HomeStyles,
} from '@/features/home/home.styles';
import {
  filtrarContas,
  SITUACAO_LABEL,
  SITUACAO_TONE,
  type LinhaConta,
} from '@/features/superusuario/contas';
import { useTheme } from '@/hooks/use-theme';

export const CARREGANDO_CONTAS = 'Carregando as contas dos médicos.';
export const FALHA_AO_CARREGAR_CONTAS =
  'Não foi possível carregar as contas. Volte ao início e abra a área de novo.';
export const SEM_CONTAS = 'Nenhuma conta cadastrada neste tablet.';

const local = StyleSheet.create({
  bloco: { gap: 16 },
  busca: { gap: 8 },
  // As ações ficam numa linha própria, embaixo dos dados, para não apertar as colunas.
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
});

type TabelaContasProps = {
  contas: readonly LinhaConta[];
  loading?: boolean;
  loadFailed?: boolean;
  /** Sem as ações, a tabela só lista as contas. */
  onDesativar?: (linha: LinhaConta) => void;
  onRedefinirSenha?: (linha: LinhaConta) => void;
};

/**
 * Busca e tabela das contas dos médicos na área do superusuário.
 * Recebe as linhas prontas e a busca filtra na memória, sem voltar ao banco.
 */
export function TabelaContas({
  contas,
  loading = false,
  loadFailed = false,
  onDesativar,
  onRedefinirSenha,
}: Readonly<TabelaContasProps>) {
  const theme = useTheme();
  const styles = useMemo(() => createHomeStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_LAYOUT_MIN_WIDTH;
  const [busca, setBusca] = useState('');
  const visiveis = useMemo(() => filtrarContas(contas, busca), [contas, busca]);
  const temContas = contas.length > 0;

  return (
    <View style={local.bloco}>
      {/* Sem contas não há o que buscar. */}
      {temContas && (
        <View style={local.busca}>
          <Text style={styles.columnLabel}>BUSCAR MÉDICO</Text>
          <TextInput
            accessibilityLabel="Buscar médico"
            placeholder="Nome, CRM ou e-mail"
            placeholderTextColor={theme.placeholder}
            value={busca}
            onChangeText={setBusca}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.search}
          />
        </View>
      )}

      {loadFailed && <FeedbackMessage kind="error" message={FALHA_AO_CARREGAR_CONTAS} />}

      <View style={styles.listCard}>
        {loading && !temContas ? (
          <View style={styles.empty} accessible accessibilityLabel={CARREGANDO_CONTAS}>
            <ActivityIndicator color={theme.primary} size="large" />
            <Text style={styles.emptyText}>{CARREGANDO_CONTAS}</Text>
          </View>
        ) : !temContas ? (
          // Depois de uma falha, o aviso acima já explica a lista vazia.
          !loadFailed && <Text style={styles.noResults}>{SEM_CONTAS}</Text>
        ) : (
          <>
            {isWide && <CabecalhoContas styles={styles} />}
            {visiveis.length === 0 ? (
              <Text style={styles.noResults}>Nenhum médico encontrado para “{busca.trim()}”.</Text>
            ) : (
              visiveis.map((linha, indice) => (
                <LinhaDaTabela
                  key={linha.id}
                  linha={linha}
                  isWide={isWide}
                  showDivider={indice > 0}
                  styles={styles}
                  onDesativar={onDesativar}
                  onRedefinirSenha={onRedefinirSenha}
                />
              ))
            )}
          </>
        )}
      </View>
    </View>
  );
}

function CabecalhoContas({ styles }: Readonly<{ styles: HomeStyles }>) {
  return (
    <View style={styles.columnHeader}>
      <Text style={[styles.columnLabel, styles.colName]}>MÉDICO</Text>
      <Text style={[styles.columnLabel, styles.colRecord]}>CRM</Text>
      <Text style={[styles.columnLabel, styles.colLastExam]}>SITUAÇÃO</Text>
      <Text style={[styles.columnLabel, styles.colCount]}>EXAMES</Text>
    </View>
  );
}

type LinhaDaTabelaProps = {
  linha: LinhaConta;
  isWide: boolean;
  showDivider: boolean;
  styles: HomeStyles;
  onDesativar?: (linha: LinhaConta) => void;
  onRedefinirSenha?: (linha: LinhaConta) => void;
};

function LinhaDaTabela({
  linha,
  isWide,
  showDivider,
  styles,
  onDesativar,
  onRedefinirSenha,
}: Readonly<LinhaDaTabelaProps>) {
  const situacao = SITUACAO_LABEL[linha.situacao];
  const desativar = linha.podeDesativar ? onDesativar : undefined;
  const redefinirSenha = linha.podeRedefinirSenha ? onRedefinirSenha : undefined;
  const exames = linha.exames === 1 ? '1 exame' : `${linha.exames} exames`;

  return (
    <View>
      {showDivider && <View style={styles.separator} />}
      {/* O leitor de tela lê a linha inteira de uma vez, na ordem das colunas. */}
      <View
        style={styles.row}
        accessible
        accessibilityLabel={`${linha.nome}, CRM ${linha.crm}, ${situacao}, ${exames}`}>
        <View style={styles.rowMain}>
          <View style={styles.colName}>
            <Text style={styles.patientName}>{linha.nome}</Text>
            {!isWide && <Text style={styles.cellSecondary}>CRM {linha.crm}</Text>}
          </View>
          {isWide && <Text style={[styles.record, styles.colRecord]}>{linha.crm}</Text>}
          <View style={styles.colLastExam}>
            <ExamStatusChip tone={SITUACAO_TONE[linha.situacao]} label={situacao} />
          </View>
          <Text style={[styles.count, styles.colCount]}>{linha.exames}</Text>
        </View>
      </View>
      {(redefinirSenha || desativar) && (
        <View style={local.acoes}>
          {redefinirSenha && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Redefinir a senha de ${linha.nome}`}
              onPress={() => redefinirSenha(linha)}
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
              <Text style={styles.textButtonText}>Redefinir senha</Text>
            </Pressable>
          )}
          {desativar && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Desativar a conta de ${linha.nome}`}
              onPress={() => desativar(linha)}
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
              <Text style={[styles.textButtonText, { color: BrandPalette.deepWine }]}>
                Desativar
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
