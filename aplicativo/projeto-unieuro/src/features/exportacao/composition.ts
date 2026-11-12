import Constants from 'expo-constants';

import { exportRepository } from '@/db/export-repository';
import type { SessionProfessional } from '@/features/auth/session';
import { exportarExames } from '@/features/exportacao/exportacao';
import { salvarArquivoXml } from '@/features/exportacao/salvar-arquivo';

/** Liga a exportação ao banco e ao seletor de pastas, sem expor `@/db` às telas. */
export const exportarTodosOsExames = (profissional: SessionProfessional) =>
  exportarExames(
    {
      profissional,
      agora: new Date(),
      versaoAplicativo: Constants.expoConfig?.version ?? 'desconhecida',
    },
    exportRepository,
    salvarArquivoXml,
  );
