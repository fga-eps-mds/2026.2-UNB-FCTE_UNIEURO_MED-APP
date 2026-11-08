import { getDatabase, LEGACY_DATABASE_MESSAGE } from '@/db/database';
import { DATABASE_KEY_MISSING_MESSAGE } from '@/db/database-key';
import { SQLCIPHER_UNAVAILABLE_MESSAGE } from '@/db/database-encryption';

export async function initializeDatabase(): Promise<void> {
  await getDatabase();
}

export function databaseStartupMessage(error: unknown): string {
  if (
    error instanceof Error &&
    [LEGACY_DATABASE_MESSAGE, DATABASE_KEY_MISSING_MESSAGE, SQLCIPHER_UNAVAILABLE_MESSAGE].includes(
      error.message,
    )
  ) {
    return error.message;
  }
  return 'Não foi possível abrir o banco de dados. Tente novamente.';
}
