import { exportRepository } from '@/db/export-repository';
import type { SessionProfessional } from '@/features/auth/session';
import { exportarExamesDoPaciente, exportarTodosOsExames } from '@/features/exportacao/composition';
import { exportarExames } from '@/features/exportacao/exportacao';
import { salvarArquivoXml } from '@/features/exportacao/salvar-arquivo';

jest.mock('@/features/exportacao/exportacao', () => ({
  exportarExames: jest.fn(async () => ({ estado: 'cancelado' })),
}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.4.0' } }));

const ana: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

describe('composição da exportação', () => {
  it('liga a regra ao banco, ao seletor de pastas e à versão do aplicativo', async () => {
    await exportarTodosOsExames(ana);

    expect(exportarExames).toHaveBeenCalledWith(
      { profissional: ana, agora: expect.any(Date), versaoAplicativo: '1.4.0' },
      exportRepository,
      salvarArquivoXml,
    );
  });

  it('exportar todos não pede um paciente', async () => {
    jest.mocked(exportarExames).mockClear();
    await exportarTodosOsExames(ana);

    expect(jest.mocked(exportarExames).mock.calls[0][0]).not.toHaveProperty('pacienteId');
  });

  it('exportar um paciente pede só ele, com o mesmo banco e o mesmo seletor de pastas', async () => {
    jest.mocked(exportarExames).mockClear();
    await exportarExamesDoPaciente(ana, 42);

    expect(exportarExames).toHaveBeenCalledTimes(1);
    expect(exportarExames).toHaveBeenCalledWith(
      { profissional: ana, pacienteId: 42, agora: expect.any(Date), versaoAplicativo: '1.4.0' },
      exportRepository,
      salvarArquivoXml,
    );
  });
});
