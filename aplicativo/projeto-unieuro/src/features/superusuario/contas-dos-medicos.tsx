import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import { useSession } from '@/features/auth/session';
import { createHomeStyles } from '@/features/home/home.styles';
import type { ContasRepository, LinhaConta } from '@/features/superusuario/contas';
import type { DesativacaoRepository } from '@/features/superusuario/desativar-conta';
import { DesativarContaDialog } from '@/features/superusuario/desativar-conta-dialog';
import type { RedefinicaoRepository } from '@/features/superusuario/redefinir-senha';
import { RedefinirSenhaDialog } from '@/features/superusuario/redefinir-senha-dialog';
import { TabelaContas } from '@/features/superusuario/tabela-contas';
import { useContas } from '@/features/superusuario/use-contas';
import { useTheme } from '@/hooks/use-theme';

export type ContasDosMedicosRepository = ContasRepository &
  DesativacaoRepository &
  RedefinicaoRepository;

export const BOTAO_NOVO_SUPERUSUARIO = 'Novo superusuário';

export const contaDesativada = (nome: string) =>
  `A conta de ${nome} foi desativada. Os exames dela continuam no tablet.`;

export const senhaRedefinida = (nome: string) =>
  `A senha de ${nome} foi redefinida. Ela já vale no próximo acesso.`;

const local = StyleSheet.create({
  bloco: { gap: 16 },
});

type ContasDosMedicosProps = {
  repository: ContasDosMedicosRepository;
};

/**
 * Contas dos médicos na área do superusuário, a tabela com a busca e as ações
 * de cada conta, que abrem um diálogo de confirmação.
 */
export function ContasDosMedicos({ repository }: Readonly<ContasDosMedicosProps>) {
  const router = useRouter();
  const theme = useTheme();
  const home = useMemo(() => createHomeStyles(theme), [theme]);
  const { professional } = useSession();
  const { contas, loading, loadFailed, recarregar } = useContas(repository);
  const [desativando, setDesativando] = useState<LinhaConta | null>(null);
  const [redefinindo, setRedefinindo] = useState<LinhaConta | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // A área só aparece para o superusuário com sessão, então isto não acontece na prática.
  if (!professional) return null;

  function abrirDesativacao(conta: LinhaConta) {
    setAviso(null);
    setDesativando(conta);
  }

  function abrirRedefinicao(conta: LinhaConta) {
    setAviso(null);
    setRedefinindo(conta);
  }

  // A senha não aparece na tabela, então não há o que recarregar.
  function concluirRedefinicao(conta: LinhaConta) {
    setRedefinindo(null);
    setAviso(senhaRedefinida(conta.nome));
  }

  function concluirDesativacao(conta: LinhaConta) {
    setDesativando(null);
    setAviso(contaDesativada(conta.nome));
    recarregar();
  }

  return (
    <View style={local.bloco}>
      {/* Só um superusuário cadastra outro. Os médicos se cadastram sozinhos */}
      <View style={home.toolbarActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/novo-superusuario')}
          style={({ pressed }) => [home.outlineButton, pressed && home.pressed]}>
          <Text style={home.outlineButtonText}>{BOTAO_NOVO_SUPERUSUARIO}</Text>
        </Pressable>
      </View>
      {aviso && <FeedbackMessage kind="success" message={aviso} />}
      <TabelaContas
        contas={contas}
        loading={loading}
        loadFailed={loadFailed}
        onDesativar={abrirDesativacao}
        onRedefinirSenha={abrirRedefinicao}
      />
      <DesativarContaDialog
        conta={desativando}
        superusuarioId={professional.id}
        repository={repository}
        onCancel={() => setDesativando(null)}
        onDesativada={concluirDesativacao}
      />
      <RedefinirSenhaDialog
        conta={redefinindo}
        superusuarioId={professional.id}
        repository={repository}
        onCancel={() => setRedefinindo(null)}
        onRedefinida={concluirRedefinicao}
      />
    </View>
  );
}
