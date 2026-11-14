import { professionalRepository } from '@/db/professional-repository';
import { confirmPassword, nearbyApi, syncService } from '@/features/sincronizacao/composition';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

describe('composição da feature de sincronização', () => {
  it('oferece o serviço de sincronização completo', () => {
    expect(Object.keys(syncService).sort()).toEqual([
      'describeLocal',
      'exportPackage',
      'importPackage',
      'lastReceivedAt',
      'prepareBatchesFor',
      'receiveBatches',
    ]);
  });

  it('não tem o Nearby fora do aplicativo instalado, como no Expo Go', () => {
    expect(nearbyApi).toBeNull();
  });

  it('confere a senha pela conta guardada no banco', async () => {
    const findByEmail = jest
      .spyOn(professionalRepository, 'findByEmail')
      .mockResolvedValueOnce(null);

    await expect(confirmPassword('ana.souza@unieuro.com.br', 'senha')).resolves.toBe(false);
    expect(findByEmail).toHaveBeenCalledWith('ana.souza@unieuro.com.br');
    findByEmail.mockRestore();
  });
});
