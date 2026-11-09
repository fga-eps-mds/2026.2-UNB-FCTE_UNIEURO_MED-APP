import { getDatabase, LEGACY_DATABASE_MESSAGE } from '@/db/database';
import { DATABASE_KEY_MISSING_MESSAGE } from '@/db/database-key';
import { SQLCIPHER_UNAVAILABLE_MESSAGE } from '@/db/database-encryption';
import { databaseStartupMessage, initializeDatabase } from '@/features/auth/database-startup';

// Só a abertura é substituída; as mensagens vêm do módulo real, para o teste
// quebrar se o texto mostrado ao profissional mudar sem passar por aqui.
jest.mock('@/db/database', () => ({
  ...jest.requireActual<typeof import('@/db/database')>('@/db/database'),
  getDatabase: jest.fn(),
}));

const mockGetDatabase = jest.mocked(getDatabase);

const GENERIC_MESSAGE = 'Não foi possível abrir o banco de dados. Tente novamente.';

describe('initializeDatabase', () => {
  it('abre o banco na inicialização do aplicativo', async () => {
    mockGetDatabase.mockResolvedValue({} as Awaited<ReturnType<typeof getDatabase>>);

    await expect(initializeDatabase()).resolves.toBeUndefined();
    expect(mockGetDatabase).toHaveBeenCalledTimes(1);
  });

  it('repassa a falha de abertura para a tela decidir a mensagem', async () => {
    mockGetDatabase.mockRejectedValue(new Error(LEGACY_DATABASE_MESSAGE));

    await expect(initializeDatabase()).rejects.toThrow(LEGACY_DATABASE_MESSAGE);
  });
});

describe('databaseStartupMessage', () => {
  it('explica a necessidade de um build nativo com SQLCipher ao abrir no Expo Go', () => {
    expect(databaseStartupMessage(new Error(SQLCIPHER_UNAVAILABLE_MESSAGE))).toBe(
      SQLCIPHER_UNAVAILABLE_MESSAGE,
    );
  });
  it('pede para reinstalar quando encontra um banco de versão anterior', () => {
    expect(databaseStartupMessage(new Error(LEGACY_DATABASE_MESSAGE))).toBe(
      LEGACY_DATABASE_MESSAGE,
    );
  });

  it('avisa que a chave do banco existente não está disponível', () => {
    expect(databaseStartupMessage(new Error(DATABASE_KEY_MISSING_MESSAGE))).toBe(
      DATABASE_KEY_MISSING_MESSAGE,
    );
  });

  it('mostra uma mensagem genérica para outras falhas, sem expor detalhes técnicos', () => {
    expect(databaseStartupMessage(new Error('file is not a database'))).toBe(GENERIC_MESSAGE);
  });

  it('mostra a mensagem genérica quando o erro não é uma instância de Error', () => {
    expect(databaseStartupMessage('falha desconhecida')).toBe(GENERIC_MESSAGE);
  });
});
