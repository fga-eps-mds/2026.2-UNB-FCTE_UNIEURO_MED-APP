import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import SuperusuarioRoute from '@/app/superusuario';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { verifyPassword } from '@/features/auth/password';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import {
  BOTAO_NOVO_SUPERUSUARIO,
  contaDesativada,
  senhaRedefinida,
  type ContasDosMedicosRepository,
} from '@/features/superusuario/contas-dos-medicos';
import { CARREGANDO_CONTAS } from '@/features/superusuario/tabela-contas';

import {
  ANA,
  BRUNO,
  SENHA_DE_TESTE,
  TAUIL,
  abrirTabletComSuperusuario,
  cpfProtector,
  type TabletDeTeste,
} from '../test-support/tablet';

// Contas dos médicos na área do superusuário. Com rota, hook,
// e a regra e o SQLite de verdade, com a trava do superusuário na consulta.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockRepository: ContasDosMedicosRepository;
jest.mock('@/features/superusuario/composition', () => ({
  get contasRepository() {
    return mockRepository;
  },
}));

let tablet: TabletDeTeste;

const sessao = async (email: string): Promise<SessionProfessional> => {
  const saved = (await tablet.repository.findByEmail(email))!;
  return {
    id: saved.id,
    name: saved.name,
    email: saved.email,
    crmNumber: saved.crmNumber,
    crmState: saved.crmState,
    superuser: saved.superuser,
  };
};

beforeEach(async () => {
  tablet = await abrirTabletComSuperusuario();
  mockRepository = tablet.repository;

  const attendances = createAttendanceRepository(async () => tablet.database, cpfProtector);
  const ana = await sessao(ANA.email);
  await attendances.createAttendance({
    patient: {
      name: 'José Alves Martins',
      cpf: '12345678909',
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'masculino',
    },
    professionalId: ana.id,
    startedAt: '2026-10-06T12:00:00.000Z',
  });
});

afterEach(async () => {
  await tablet.fechar();
});

const abrirArea = (professional: SessionProfessional) =>
  render(
    <SessionProvider initialProfessional={professional}>
      <SuperusuarioRoute />
    </SessionProvider>,
  );

describe('Cenário: visualizar médicos', () => {
  it('o superusuário vê as contas do tablet com a situação e os exames gravados no banco', async () => {
    abrirArea(await sessao(TAUIL.email));
    expect(screen.getByLabelText(CARREGANDO_CONTAS)).toBeOnTheScreen();

    expect(
      await screen.findByLabelText('Ana Carolina Souza, CRM 12345/DF, Ativa, 1 exame'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Bruno Lima, CRM 54321/GO, Ativa, 0 exames')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Carlos Bernardo Tauil, CRM 12771/DF, Superusuário, 0 exames'),
    ).toBeOnTheScreen();
  });

  it('a conta desativada aparece com o selo "Desativada"', async () => {
    const bruno = await sessao(BRUNO.email);
    await tablet.repository.deactivate(bruno.id, '2026-11-01T12:00:00.000Z');

    abrirArea(await sessao(TAUIL.email));

    expect(
      await screen.findByLabelText('Bruno Lima, CRM 54321/GO, Desativada, 0 exames'),
    ).toBeOnTheScreen();
  });

  it('busca pelo CRM gravado no banco', async () => {
    const user = userEvent.setup();
    abrirArea(await sessao(TAUIL.email));
    await screen.findByText('Ana Carolina Souza');

    await user.type(screen.getByLabelText('Buscar médico'), '54321');

    expect(screen.getByText('Bruno Lima')).toBeOnTheScreen();
    expect(screen.queryByText('Ana Carolina Souza')).toBeNull();
  });
});

describe('Cenário: desativar a conta de um médico', () => {
  const linhaDoBruno = (situacao: string) => `Bruno Lima, CRM 54321/GO, ${situacao}, 0 exames`;

  it('o superusuário desativa a conta e a tabela mostra o que o banco gravou', async () => {
    const user = userEvent.setup();
    abrirArea(await sessao(TAUIL.email));

    await user.press(
      await screen.findByRole('button', { name: 'Desativar a conta de Bruno Lima' }),
    );
    await user.press(screen.getByRole('button', { name: 'Desativar conta' }));

    expect(await screen.findByText(contaDesativada('Bruno Lima'))).toBeOnTheScreen();
    expect(await screen.findByLabelText(linhaDoBruno('Desativada'))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Desativar a conta de Bruno Lima' })).toBeNull();
    expect((await tablet.repository.findByEmail(BRUNO.email))!.active).toBe(false);
  });

  it('cancelar fecha o diálogo e a conta continua ativa', async () => {
    const user = userEvent.setup();
    abrirArea(await sessao(TAUIL.email));

    await user.press(
      await screen.findByRole('button', { name: 'Desativar a conta de Bruno Lima' }),
    );
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('header', { name: /^Desativar a conta de/ })).toBeNull();
    expect(screen.getByLabelText(linhaDoBruno('Ativa'))).toBeOnTheScreen();
  });

  it('o superusuário não tem como desativar a própria conta nem a de outro superusuário', async () => {
    abrirArea(await sessao(TAUIL.email));

    await screen.findByText('Ana Carolina Souza');
    expect(screen.queryByRole('button', { name: `Desativar a conta de ${TAUIL.name}` })).toBeNull();
  });
});

describe('Cenário: redefinir a senha de um médico', () => {
  const NOVA_SENHA = 'nova-senha-do-bruno';
  const senhaDoBrunoE = async (senha: string) =>
    verifyPassword(senha, (await tablet.repository.findByEmail(BRUNO.email))!.passwordHash);

  it('o superusuário troca a senha, e só a nova senha passa a valer', async () => {
    const user = userEvent.setup();
    abrirArea(await sessao(TAUIL.email));

    await user.press(
      await screen.findByRole('button', { name: 'Redefinir a senha de Bruno Lima' }),
    );
    await user.type(screen.getByLabelText('NOVA SENHA'), NOVA_SENHA);
    await user.type(screen.getByLabelText('CONFIRMAR NOVA SENHA'), NOVA_SENHA);
    await user.press(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByText(senhaRedefinida('Bruno Lima'))).toBeOnTheScreen();
    await expect(senhaDoBrunoE(NOVA_SENHA)).resolves.toBe(true);
    await expect(senhaDoBrunoE(SENHA_DE_TESTE)).resolves.toBe(false);
  });

  it('o superusuário não tem como trocar por aqui a própria senha', async () => {
    abrirArea(await sessao(TAUIL.email));

    await screen.findByText('Ana Carolina Souza');
    expect(screen.queryByRole('button', { name: `Redefinir a senha de ${TAUIL.name}` })).toBeNull();
  });
});

describe('Cenário: criar outro superusuário', () => {
  it('o superusuário abre o cadastro de um novo superusuário pela área', async () => {
    abrirArea(await sessao(TAUIL.email));

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: BOTAO_NOVO_SUPERUSUARIO }));

    expect(useRouter().push).toHaveBeenCalledWith('/novo-superusuario');
  });
});

describe('Cenário: acesso de um profissional comum', () => {
  it('um médico comum que chega pela rota não vê a área, e o banco não devolve conta nenhuma', async () => {
    const consultar = jest.spyOn(tablet.repository, 'listAccounts');
    const ana = await sessao(ANA.email);

    abrirArea(ana);

    // A tabela nem chega a montar, e o banco recusaria mesmo que alguém pedisse.
    expect(screen.queryByTestId('area-superusuario')).toBeNull();
    expect(screen.queryByText('Bruno Lima')).toBeNull();
    expect(consultar).not.toHaveBeenCalled();
    await expect(tablet.repository.listAccounts(ana.id)).resolves.toEqual([]);
  });
});
