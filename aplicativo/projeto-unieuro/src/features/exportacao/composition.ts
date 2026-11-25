import Constants from 'expo-constants';

import { exportRepository } from '@/db/export-repository';
import type { SessionProfessional } from '@/features/auth/session';
import { exportarExames } from '@/features/exportacao/exportacao';
import { salvarArquivoXml } from '@/features/exportacao/salvar-arquivo';

const pedido = (profissional: SessionProfessional) => ({
  profissional,
  agora: new Date(),
  versaoAplicativo: Constants.expoConfig?.version ?? 'desconhecida',
});

/** Liga a exportação ao banco e ao seletor de pastas, sem expor `@/db` às telas. */
export const exportarTodosOsExames = (profissional: SessionProfessional) =>
  exportarExames(pedido(profissional), exportRepository, salvarArquivoXml);

/**
 * Exportação de um único paciente (#22): o mesmo gerador e o mesmo esquema da
 * exportação de todos, só com os exames que `profissional` aplicou nesse paciente.
 */
export const exportarExamesDoPaciente = (profissional: SessionProfessional, pacienteId: number) =>
  exportarExames({ ...pedido(profissional), pacienteId }, exportRepository, salvarArquivoXml);
