import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert, Text } from 'react-native';

import type { AccountRepository } from '@/features/auth/account';
import { verifyPassword } from '@/features/auth/password';
import { SessionProvider, useSession, type SessionProfessional } from '@/features/auth/session';
import EditAccountScreen from '@/features/settings/edit-account-screen';
import {
  ANA,
  SENHA_DE_TESTE,
  abrirTabletComAnaEBruno,
  type TabletDeTeste,
} from '@/test-utils/professionals';

// A tela grava e lê de um SQLite de verdade: o teste vai da tela ao banco.

let tablet: TabletDeTeste;

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
});

afterEach(async () => {
  await tablet.database.closeAsync();
});

function SessaoAtual() {
  const { professional } = useSession();
  return <Text>{professional ? `Sessão: ${professional.name}` : 'Sem sessão'}</Text>;
}

function renderTela(
  sessao: SessionProfessional | null = { id: tablet.anaId, ...ANA },
  repository: AccountRepository = tablet.repository,
) {
  return render(
    <SessionProvider initialProfessional={sessao}>
      <EditAccountScreen repository={repository} />
      <SessaoAtual />
    </SessionProvider>,
  );
}

async function substituir(user: ReturnType<typeof userEvent.setup>, rotulo: string, texto: string) {
  const campo = screen.getByLabelText(rotulo);
  await user.clear(campo);
  if (texto) await user.type(campo, texto);
}

const contaDaAna = () => tablet.repository.findById(tablet.anaId);

describe('EditAccountScreen', () => {
  it('abre com os dados atuais e o CPF bloqueado, sem mostrar o número', () => {
    renderTela();

    expect(screen.getByRole('header', { name: 'Editar meus dados' })).toBeOnTheScreen();
    expect(screen.getByLabelText('NOME COMPLETO')).toHaveDisplayValue('Ana Carolina Souza');
    expect(screen.getByLabelText('E-MAIL')).toHaveDisplayValue('ana.souza@unieuro.com.br');
    expect(screen.getByLabelText('CRM')).toHaveDisplayValue('12345');
    expect(screen.getByLabelText('UF DO CRM')).toHaveDisplayValue('DF');
    expect(screen.getByLabelText('CPF não pode ser alterado')).toBeOnTheScreen();
    expect(screen.queryByText(/111\.?444\.?777/)).toBeNull();
  });

  it('dados atualizados: grava no banco, atualiza a sessão e volta para as configurações', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderTela();

    await substituir(user, 'NOME COMPLETO', 'Ana Souza');
    await substituir(user, 'CRM', '67890');
    await substituir(user, 'UF DO CRM', 'SP');
    await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA ATUAL'), SENHA_DE_TESTE);
    await user.press(screen.getByRole('button', { name: 'Salvar' }));

    await expect(contaDaAna()).resolves.toMatchObject({
      name: 'Ana Souza',
      crmNumber: '67890',
      crmState: 'SP',
    });
    expect(screen.getByText('Sessão: Ana Souza')).toBeOnTheScreen();
    expect(alerta).toHaveBeenCalledWith('Dados atualizados', expect.any(String));
    expect(useRouter().back).toHaveBeenCalled();
  });

  it('dado já usado por outra conta: avisa no campo e não altera o cadastro', async () => {
    const user = userEvent.setup();
    renderTela();

    await substituir(user, 'E-MAIL', 'bruno.lima@unieuro.com.br');
    await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA ATUAL'), SENHA_DE_TESTE);
    await user.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Este e-mail já está em uso por outra conta.')).toBeOnTheScreen();
    await expect(contaDaAna()).resolves.toMatchObject({ email: ANA.email });
    expect(useRouter().back).not.toHaveBeenCalled();
  });

  it('campo inválido na edição: indica cada campo a corrigir e não altera o cadastro', async () => {
    const user = userEvent.setup();
    renderTela();

    await substituir(user, 'NOME COMPLETO', '');
    await substituir(user, 'E-MAIL', 'ana@');
    await substituir(user, 'CRM', '12A45');
    await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA ATUAL'), SENHA_DE_TESTE);
    await user.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Preencha o nome.')).toBeOnTheScreen();
    expect(screen.getByText('Informe um e-mail válido.')).toBeOnTheScreen();
    expect(screen.getByText('O CRM tem só números.')).toBeOnTheScreen();
    await expect(contaDaAna()).resolves.toMatchObject(ANA);
  });

  it('senha atual incorreta: não altera os dados', async () => {
    const user = userEvent.setup();
    renderTela();

    await substituir(user, 'NOME COMPLETO', 'Outro Nome');
    await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA ATUAL'), 'senha-errada');
    await user.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('A senha atual não confere.')).toBeOnTheScreen();
    await expect(contaDaAna()).resolves.toMatchObject({ name: ANA.name });
  });

  it('troca de senha: passa a valer a nova senha e limpa os campos', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderTela();

    await user.type(screen.getByLabelText('SENHA ATUAL'), SENHA_DE_TESTE);
    await user.type(screen.getByLabelText('NOVA SENHA'), 'nova-senha-123');
    await user.type(screen.getByLabelText('CONFIRMAR NOVA SENHA'), 'nova-senha-123');
    await user.press(screen.getByRole('button', { name: 'Trocar senha' }));

    expect(alerta).toHaveBeenCalledWith('Senha alterada', expect.any(String));
    expect(screen.getByLabelText('NOVA SENHA')).toHaveDisplayValue('');
    const conta = await contaDaAna();
    await expect(verifyPassword('nova-senha-123', conta!.passwordHash)).resolves.toBe(true);
    await expect(verifyPassword(SENHA_DE_TESTE, conta!.passwordHash)).resolves.toBe(false);
  });

  it('senha atual incorreta: não troca a senha', async () => {
    const user = userEvent.setup();
    renderTela();

    await user.type(screen.getByLabelText('SENHA ATUAL'), 'senha-errada');
    await user.type(screen.getByLabelText('NOVA SENHA'), 'nova-senha-123');
    await user.type(screen.getByLabelText('CONFIRMAR NOVA SENHA'), 'nova-senha-123');
    await user.press(screen.getByRole('button', { name: 'Trocar senha' }));

    expect(screen.getByText('A senha atual não confere.')).toBeOnTheScreen();
    const conta = await contaDaAna();
    await expect(verifyPassword(SENHA_DE_TESTE, conta!.passwordHash)).resolves.toBe(true);
  });

  it('cancela a edição e volta para as configurações', async () => {
    const user = userEvent.setup();
    renderTela();

    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(useRouter().back).toHaveBeenCalled();
  });

  it('volta para as configurações pela barra do topo', async () => {
    const user = userEvent.setup();
    renderTela();

    await user.press(screen.getByRole('button', { name: 'Voltar para as configurações' }));

    expect(useRouter().back).toHaveBeenCalled();
  });

  it('volta para o login quando ninguém entrou', () => {
    renderTela(null);

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('header', { name: 'Editar meus dados' })).toBeNull();
  });

  describe('quando o banco falha', () => {
    const quebrado = () =>
      ({
        findById: jest.fn().mockRejectedValue(new Error('banco indisponível')),
      }) as unknown as AccountRepository;

    it('avisa ao salvar os dados', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      renderTela({ id: tablet.anaId, ...ANA }, quebrado());

      await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA ATUAL'), SENHA_DE_TESTE);
      await user.press(screen.getByRole('button', { name: 'Salvar' }));

      expect(alerta).toHaveBeenCalledWith('Não foi possível salvar', expect.any(String));
      expect(useRouter().back).not.toHaveBeenCalled();
    });

    it('avisa ao trocar a senha', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      renderTela({ id: tablet.anaId, ...ANA }, quebrado());

      await user.type(screen.getByLabelText('SENHA ATUAL'), SENHA_DE_TESTE);
      await user.type(screen.getByLabelText('NOVA SENHA'), 'nova-senha-123');
      await user.type(screen.getByLabelText('CONFIRMAR NOVA SENHA'), 'nova-senha-123');
      await user.press(screen.getByRole('button', { name: 'Trocar senha' }));

      expect(alerta).toHaveBeenCalledWith('Não foi possível salvar', expect.any(String));
    });
  });
});
