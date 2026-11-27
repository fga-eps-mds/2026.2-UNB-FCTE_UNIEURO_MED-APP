import {
  collectRegistrationFieldErrors,
  registerProfessional,
  validateRegistration,
  type NewProfessional,
  type ProfessionalRepository,
  type RegistrationFieldErrors,
  type RegistrationInput,
} from '@/features/auth/registration';
import {
  CONFIRME_COM_A_SUA_SENHA,
  SENHA_DO_SUPERUSUARIO_ERRADA,
  senhaDoSuperusuarioConfere,
  type ConfirmacaoRepository,
} from '@/features/superusuario/confirmacao';

export type CriacaoRepository = ConfirmacaoRepository &
  Omit<ProfessionalRepository, 'insert'> & {
    /** Só cria a conta se quem pede é superusuário com a conta ativa. */
    insertSuperuser(professional: NewProfessional, actorId: number): Promise<boolean>;
  };

export type NovoSuperusuarioInput = RegistrationInput & { senhaDoSuperusuario: string };

export type NovoSuperusuarioErros = RegistrationFieldErrors & {
  senhaDoSuperusuario?: string;
  geral?: string;
};

export type NovoSuperusuarioResultado =
  | { success: true }
  | { success: false; errors: NovoSuperusuarioErros };

export const SUPERUSUARIO_NAO_CRIADO =
  'Não foi possível criar o superusuário. Volte ao início e abra a área de novo.';

/**
 * "só um superusuário cadastra outro
 * Os dados e as regras são os do cadastro comum. Os médicos continuam se cadastrando
 * sozinhos, pela tela de cadastro.
 */
export async function criarSuperusuario(
  superusuarioId: number,
  { senhaDoSuperusuario, ...dados }: NovoSuperusuarioInput,
  repository: CriacaoRepository,
): Promise<NovoSuperusuarioResultado> {
  const errors: NovoSuperusuarioErros = collectRegistrationFieldErrors(dados);
  if (!senhaDoSuperusuario) errors.senhaDoSuperusuario = CONFIRME_COM_A_SUA_SENHA;
  if (Object.keys(errors).length > 0) return { success: false, errors };

  const validacao = validateRegistration(dados);
  if (!validacao.valid) return { success: false, errors: { geral: validacao.message } };

  // A senha é conferida antes da busca por e-mail, CRM e CPF repetidos, para que a tela
  // não sirva para descobrir quem está cadastrado no tablet.
  if (!(await senhaDoSuperusuarioConfere(superusuarioId, senhaDoSuperusuario, repository))) {
    return { success: false, errors: { senhaDoSuperusuario: SENHA_DO_SUPERUSUARIO_ERRADA } };
  }

  // O mesmo caminho do cadastro comum, com a checagem dos repetidos e o hash da senha.
  // a conta nasce superusuário, com o registro de quem a criou.
  let criado = false;
  const resultado = await registerProfessional(validacao.registration, {
    emailExists: (email) => repository.emailExists(email),
    crmExists: (numero, uf) => repository.crmExists(numero, uf),
    cpfExists: (cpf) => repository.cpfExists(cpf),
    insert: async (profissional) => {
      criado = await repository.insertSuperuser(profissional, superusuarioId);
    },
  });
  if (!resultado.success) {
    return { success: false, errors: { [resultado.field ?? 'geral']: resultado.message } };
  }
  if (!criado) return { success: false, errors: { geral: SUPERUSUARIO_NAO_CRIADO } };
  return { success: true };
}
