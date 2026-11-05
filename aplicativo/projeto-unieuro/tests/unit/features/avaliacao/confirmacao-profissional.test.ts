import {
  DIGITOS_INCOMPLETOS,
  DIGITOS_INCORRETOS,
  DIGITOS_VAZIOS,
  confirmarProfissional,
  type ProfessionalCpfRepository,
} from '@/features/avaliacao/confirmacao-profissional';

const ID_PROFISSIONAL = 7;
const CPF_PROTEGIDO = '11144477735';

function criarRepositorio(cpf: string | null = CPF_PROTEGIDO): ProfessionalCpfRepository {
  return { getCpf: jest.fn(async () => cpf) };
}

describe('confirmarProfissional', () => {
  it('confirma pelos quatro primeiros dígitos do CPF protegido do profissional da sessão', async () => {
    const repositorio = criarRepositorio();

    await expect(confirmarProfissional('1114', ID_PROFISSIONAL, repositorio)).resolves.toEqual({
      confirmado: true,
    });
    expect(repositorio.getCpf).toHaveBeenCalledWith(ID_PROFISSIONAL);
  });

  it('recusa dígitos incorretos sem revelar os dígitos esperados', async () => {
    const resultado = await confirmarProfissional('9999', ID_PROFISSIONAL, criarRepositorio());

    expect(resultado).toEqual({ confirmado: false, mensagem: DIGITOS_INCORRETOS });
    expect(DIGITOS_INCORRETOS).not.toContain('1114');
    expect(DIGITOS_INCORRETOS).not.toContain(CPF_PROTEGIDO);
  });

  it.each([
    ['', DIGITOS_VAZIOS],
    ['1', DIGITOS_INCOMPLETOS],
    ['111', DIGITOS_INCOMPLETOS],
    ['11a4', DIGITOS_INCOMPLETOS],
    ['11144', DIGITOS_INCOMPLETOS],
  ])('recusa entrada %p sem ler o CPF protegido', async (digitos, mensagem) => {
    const repositorio = criarRepositorio();

    await expect(confirmarProfissional(digitos, ID_PROFISSIONAL, repositorio)).resolves.toEqual({
      confirmado: false,
      mensagem,
    });
    expect(repositorio.getCpf).not.toHaveBeenCalled();
  });

  it.each([null, '', '1114'])(
    'informa falha de leitura para CPF indisponível ou inválido',
    async (cpf) => {
      await expect(
        confirmarProfissional('1114', ID_PROFISSIONAL, criarRepositorio(cpf)),
      ).rejects.toThrow('CPF do profissional da sessão indisponível.');
    },
  );
});
