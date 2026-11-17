import type { SQLiteDatabase } from 'expo-sqlite';

import type { CpfProtector } from '@/db/cpf-protection';
import { cpfProtector } from '@/db/cpf-runtime';
import { getDatabase } from '@/db/database';

export type ProfessionalInsert = {
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
  cpf: string;
  passwordHash: string;
  createdAt: string;
};

/** O CPF não faz parte da leitura comum: use `getCpf`, que o decifra sob demanda. */
export type Professional = {
  id: number;
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  deactivatedAt: string | null;
  /** Responsável pela pesquisa: vê os atendimentos de todos os profissionais (#49). */
  superuser: boolean;
  /**
   * Quem concedeu o perfil de superusuário. `null` num superusuário quer dizer
   * administrador inicial do tablet; num médico, é sempre `null`.
   */
  superuserGrantedBy: number | null;
};

export type ProfessionalProfile = {
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
};

type ProfessionalRow = {
  id: number;
  nome: string;
  email: string;
  crm_numero: string;
  uf_crm: string;
  senha_hash: string;
  criacao: string;
  last_update: string;
  ativo: number;
  desativacao: string | null;
  perfil: string;
  superusuario_por: number | null;
};

const SELECT_PROFESSIONAL =
  'SELECT id, nome, email, crm_numero, uf_crm, senha_hash, criacao, last_update, ativo, desativacao, perfil, superusuario_por FROM profissional';

const INSERT_COLUMNS =
  'nome, email, crm_numero, uf_crm, cpf_cifrado, cpf_indice, senha_hash, criacao, last_update, perfil';

// Conta de superusuário (#49). Sem quem peça (`actorId` nulo), é a conta do
// administrador, criada uma única vez: só entra se o tablet nunca teve um
// superusuário. Com quem peça, só entra se ele for superusuário com a conta ativa.
// A condição vai no próprio INSERT, para valer por qualquer caminho do código e
// para dois pedidos ao mesmo tempo não criarem dois administradores.
const INSERT_SUPERUSER = `INSERT INTO profissional (${INSERT_COLUMNS}, superusuario_por)
  SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'superusuario', ?
  WHERE CASE WHEN ? IS NULL
    THEN NOT EXISTS (SELECT 1 FROM profissional WHERE perfil = 'superusuario')
    ELSE EXISTS (SELECT 1 FROM profissional WHERE id = ? AND perfil = 'superusuario' AND ativo = 1)
  END`;

const toProfessional = (row: ProfessionalRow): Professional => ({
  id: row.id,
  name: row.nome,
  email: row.email,
  crmNumber: row.crm_numero,
  crmState: row.uf_crm,
  passwordHash: row.senha_hash,
  createdAt: row.criacao,
  updatedAt: row.last_update,
  active: row.ativo === 1,
  deactivatedAt: row.desativacao,
  superuser: row.perfil === 'superusuario',
  superuserGrantedBy: row.superusuario_por,
});

/**
 * Acesso à tabela `profissional`. Atende ao `ProfessionalRepository` usado no
 * cadastro, às consultas de que o login precisa e ao `AccountRepository` da
 * manutenção da conta.
 *
 * A conexão e o protetor de CPF são recebidos como parâmetro para que os testes
 * possam trocá-los. O e-mail é comparado sem diferenciar maiúsculas, pela
 * `COLLATE NOCASE` da coluna. O CPF nunca é gravado em texto: o banco guarda o
 * CPF cifrado e um índice de busca, e a checagem de duplicidade usa o índice.
 *
 * O perfil de superusuário (#49) segue o que o PO pediu em 09/11: um cadastro
 * master, que é a conta do administrador (`insertSuperuser` sem quem peça), e
 * depois disso um superusuário só nasce de outro superusuário (`insertSuperuser`
 * com quem peça, ou `promoteToSuperuser`). O cadastro comum (`insert`) cria
 * sempre um médico. Os dois caminhos gravam quem concedeu o perfil
 * (`superuserGrantedBy`): vazio é o administrador inicial.
 */
export function createProfessionalRepository(
  open: () => Promise<SQLiteDatabase> = getDatabase,
  protector: CpfProtector = cpfProtector,
) {
  const findFirst = async (where: string, ...params: (string | number)[]) => {
    const database = await open();
    const row = await database.getFirstAsync<ProfessionalRow>(
      `${SELECT_PROFESSIONAL} WHERE ${where} LIMIT 1`,
      params,
    );
    return row ? toProfessional(row) : null;
  };

  const encryptCpf = (cpf: string) =>
    Promise.all([protector.encrypt(cpf), protector.blindIndex(cpf)]);

  const insertParams = (
    professional: ProfessionalInsert,
    cpfCifrado: string,
    cpfIndice: string,
  ) => [
    professional.name,
    professional.email,
    professional.crmNumber,
    professional.crmState,
    cpfCifrado,
    cpfIndice,
    professional.passwordHash,
    professional.createdAt,
    professional.createdAt,
  ];

  return {
    async emailExists(email: string): Promise<boolean> {
      const database = await open();
      const row = await database.getFirstAsync(
        'SELECT 1 FROM profissional WHERE email = ? LIMIT 1',
        [email.trim()],
      );
      return row !== null;
    },

    async crmExists(crmNumber: string, crmState: string): Promise<boolean> {
      const database = await open();
      const row = await database.getFirstAsync(
        'SELECT 1 FROM profissional WHERE crm_numero = ? AND uf_crm = ? LIMIT 1',
        [crmNumber, crmState],
      );
      return row !== null;
    },

    async cpfExists(cpf: string): Promise<boolean> {
      const database = await open();
      const row = await database.getFirstAsync(
        'SELECT 1 FROM profissional WHERE cpf_indice = ? LIMIT 1',
        [await protector.blindIndex(cpf)],
      );
      return row !== null;
    },

    async getCpf(id: number): Promise<string | null> {
      const database = await open();
      const row = await database.getFirstAsync<{ cpf_cifrado: string }>(
        'SELECT cpf_cifrado FROM profissional WHERE id = ? LIMIT 1',
        [id],
      );
      return row ? protector.decrypt(row.cpf_cifrado) : null;
    },

    /** Cadastro comum: a conta nasce sempre como médico. */
    async insert(professional: ProfessionalInsert): Promise<void> {
      const database = await open();
      const [cpfCifrado, cpfIndice] = await encryptCpf(professional.cpf);
      await database.runAsync(
        `INSERT INTO profissional (${INSERT_COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'medico')`,
        insertParams(professional, cpfCifrado, cpfIndice),
      );
    },

    /** Se o tablet já teve um superusuário. Sem ele, a tela oferece criar o administrador. */
    async hasSuperuser(): Promise<boolean> {
      const database = await open();
      const row = await database.getFirstAsync(
        "SELECT 1 FROM profissional WHERE perfil = 'superusuario' LIMIT 1",
      );
      return row !== null;
    },

    /**
     * Cria uma conta de superusuário. Com `actorId` nulo, é a conta do
     * administrador e só é criada se o tablet nunca teve superusuário; com
     * `actorId`, só se quem pede é superusuário com a conta ativa. Devolve `false`
     * quando a conta não foi criada.
     */
    async insertSuperuser(
      professional: ProfessionalInsert,
      actorId: number | null,
    ): Promise<boolean> {
      const database = await open();
      const [cpfCifrado, cpfIndice] = await encryptCpf(professional.cpf);
      const result = await database.runAsync(INSERT_SUPERUSER, [
        ...insertParams(professional, cpfCifrado, cpfIndice),
        actorId,
        actorId,
        actorId,
      ]);
      return result.changes > 0;
    },

    findByEmail(email: string): Promise<Professional | null> {
      return findFirst('email = ?', email.trim());
    },

    findById(id: number): Promise<Professional | null> {
      return findFirst('id = ?', id);
    },

    async emailInUseByOther(email: string, id: number): Promise<boolean> {
      const database = await open();
      const row = await database.getFirstAsync(
        'SELECT 1 FROM profissional WHERE email = ? AND id <> ? LIMIT 1',
        [email.trim(), id],
      );
      return row !== null;
    },

    async crmInUseByOther(crmNumber: string, crmState: string, id: number): Promise<boolean> {
      const database = await open();
      const row = await database.getFirstAsync(
        'SELECT 1 FROM profissional WHERE crm_numero = ? AND uf_crm = ? AND id <> ? LIMIT 1',
        [crmNumber, crmState, id],
      );
      return row !== null;
    },

    async updateProfile(id: number, profile: ProfessionalProfile, updatedAt: string) {
      const database = await open();
      await database.runAsync(
        `UPDATE profissional SET nome = ?, email = ?, crm_numero = ?, uf_crm = ?, last_update = ?
         WHERE id = ?`,
        [profile.name, profile.email, profile.crmNumber, profile.crmState, updatedAt, id],
      );
    },

    async updatePasswordHash(id: number, passwordHash: string, updatedAt: string) {
      const database = await open();
      await database.runAsync(
        'UPDATE profissional SET senha_hash = ?, last_update = ? WHERE id = ?',
        [passwordHash, updatedAt, id],
      );
    },

    /**
     * Torna a conta `targetId` superusuário, a pedido de `actorId`. Só acontece se
     * quem pede é um superusuário com a conta ativa e se a conta promovida também
     * está ativa: a condição vai no próprio UPDATE, para valer por qualquer caminho
     * do código. Devolve `false` quando nada mudou.
     */
    async promoteToSuperuser(
      targetId: number,
      actorId: number,
      updatedAt: string,
    ): Promise<boolean> {
      const database = await open();
      const result = await database.runAsync(
        `UPDATE profissional SET perfil = 'superusuario', superusuario_por = ?, last_update = ?
         WHERE id = ? AND ativo = 1 AND perfil = 'medico'
           AND EXISTS (SELECT 1 FROM profissional
                       WHERE id = ? AND perfil = 'superusuario' AND ativo = 1)`,
        [actorId, updatedAt, targetId, actorId],
      );
      return result.changes > 0;
    },

    /**
     * Desativa a conta sem apagar o registro: os exames aplicados por ela
     * continuam ligados ao profissional. Uma conta já desativada não muda.
     */
    async deactivate(id: number, deactivatedAt: string) {
      const database = await open();
      await database.runAsync(
        `UPDATE profissional SET ativo = 0, desativacao = ?, last_update = ?
         WHERE id = ? AND ativo = 1`,
        [deactivatedAt, deactivatedAt, id],
      );
    },
  };
}

export type SqliteProfessionalRepository = ReturnType<typeof createProfessionalRepository>;

export const professionalRepository = createProfessionalRepository();
