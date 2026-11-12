import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { emptySummary, type ImportSummary } from '@/features/sincronizacao/apply-package';
import type { PackageTransport } from '@/features/sincronizacao/file-transport';
import SyncScreen from '@/features/sincronizacao/sync-screen';
import { REFUSAL_MESSAGES, type ImportResult } from '@/features/sincronizacao/sync-service';

// A tela recebe o serviço pronto; banco e Keystore não são usados.
jest.mock('@/db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const CODE = 'ABCD-EFGH-JK23';
const SENHA = 'senha-da-ana';

const profissional: SessionProfessional = {
  id: 1,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const summary = (change: (summary: ImportSummary) => void = () => undefined) => {
  const value = emptySummary();
  change(value);
  return value;
};

function createService(
  importResult: ImportResult = {
    ok: true,
    summary: summary((s) => {
      s.professionals.inserted = 1;
      s.patients.inserted = 2;
    }),
  },
) {
  return {
    exportPackage: jest.fn(async () => ({
      code: CODE,
      fileName: 'med-sincronizacao.medsync',
      contents: 'pacote-cifrado',
      sent: 3,
    })),
    importPackage: jest.fn(async () => importResult),
    lastReceivedAt: jest.fn(async (): Promise<string | null> => null),
    describeLocal: jest.fn(async () => ({
      deviceId: 'aaaaaaaa-0000-4000-8000-000000000000',
      schemaVersion: 4,
      vector: {},
    })),
    preparePackageFor: jest.fn(async () => '{}'),
    applyPackageJson: jest.fn(async () => importResult),
  };
}

function createTransport(
  received: string | null = 'pacote-recebido',
): jest.Mocked<PackageTransport> {
  return {
    send: jest.fn<Promise<void>, [string, string]>(async () => undefined),
    receive: jest.fn<Promise<string | null>, []>(async () => received),
  };
}

const confirmPassword = jest.fn(async (_email: string, password: string) => password === SENHA);

function renderTela({
  service = createService(),
  transport = createTransport(),
  sessao = profissional as SessionProfessional | null,
} = {}) {
  render(
    <SessionProvider initialProfessional={sessao}>
      <SyncScreen
        service={service}
        transport={transport}
        nearby={null}
        confirmPassword={confirmPassword}
      />
    </SessionProvider>,
  );
  return { service, transport };
}

describe('SyncScreen', () => {
  it('sem profissional autenticado, volta para o login', () => {
    renderTela({ sessao: null });

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('header', { name: 'Sincronizar tablets' })).toBeNull();
  });

  it('mostra o profissional da sessão e as formas de sincronizar, com títulos para leitores de tela', async () => {
    renderTela();

    expect(screen.getByRole('header', { name: 'Sincronizar tablets' })).toBeOnTheScreen();
    expect(screen.getByText('Ana Carolina Souza')).toBeOnTheScreen();
    expect(screen.getByText('CRM 12345/DF')).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Sincronizar com tablet próximo' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Enviar por arquivo' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Receber arquivo' })).toBeOnTheScreen();
    expect(
      await screen.findByText('Este tablet ainda não recebeu dados de outro.'),
    ).toBeOnTheScreen();
  });

  it('sem o módulo do Nearby, explica que a troca com tablet próximo precisa do APK', async () => {
    renderTela();

    expect(screen.getByText(/precisa do aplicativo instalado pelo APK/)).toBeOnTheScreen();
    await screen.findByText('Este tablet ainda não recebeu dados de outro.');
  });

  it('informa o último recebimento de dados', async () => {
    const service = createService();
    service.lastReceivedAt.mockResolvedValue('2026-10-05T18:20:00');

    renderTela({ service });

    expect(
      await screen.findByText('Último recebimento de dados: 05/10/2026 às 18:20.'),
    ).toBeOnTheScreen();
  });

  it('continua funcionando quando não consegue ler o histórico', async () => {
    const service = createService();
    service.lastReceivedAt.mockRejectedValueOnce(new Error('banco indisponível'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    renderTela({ service });

    await waitFor(() => expect(log).toHaveBeenCalled());
    expect(screen.getByText('Este tablet ainda não recebeu dados de outro.')).toBeOnTheScreen();
    log.mockRestore();
  });

  it('volta para o início', async () => {
    const user = userEvent.setup();
    renderTela();

    await user.press(screen.getByRole('button', { name: 'Voltar para o início' }));

    expect(useRouter().back).toHaveBeenCalled();
  });

  it('encerra a sessão pelo "Sair" e volta para o login', async () => {
    const user = userEvent.setup();
    renderTela();

    await user.press(screen.getByRole('button', { name: 'Sair' }));

    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });

  describe('enviar por arquivo', () => {
    const gerar = async (user: ReturnType<typeof userEvent.setup>, senha?: string) => {
      if (senha) await user.type(screen.getByLabelText('Senha para gerar o pacote'), senha);
      await user.press(screen.getByRole('button', { name: 'Gerar e enviar pacote' }));
    };

    it('com a senha certa, gera o pacote, mostra o código e entrega o arquivo ao compartilhamento', async () => {
      const user = userEvent.setup();
      const { service, transport } = renderTela();

      await gerar(user, SENHA);

      expect(await screen.findByLabelText(`Código do pacote: ${CODE}`)).toBeOnTheScreen();
      expect(screen.getByText(/3 registros no pacote/)).toBeOnTheScreen();
      expect(confirmPassword).toHaveBeenCalledWith(profissional.email, SENHA);
      expect(service.exportPackage).toHaveBeenCalled();
      expect(transport.send).toHaveBeenCalledWith('med-sincronizacao.medsync', 'pacote-cifrado');
      expect(screen.getByLabelText('Senha para gerar o pacote').props.value).toBe('');
    });

    it('fala em um registro no singular', async () => {
      const user = userEvent.setup();
      const service = createService();
      service.exportPackage.mockResolvedValueOnce({
        code: CODE,
        fileName: 'x.medsync',
        contents: 'c',
        sent: 1,
      });
      renderTela({ service });

      await gerar(user, SENHA);

      expect(await screen.findByText(/^1 registro no pacote/)).toBeOnTheScreen();
    });

    it('sem a senha, não gera nada', async () => {
      const user = userEvent.setup();
      const { service } = renderTela();

      await gerar(user);

      expect(await screen.findByText('Digite a sua senha para continuar.')).toBeOnTheScreen();
      expect(confirmPassword).not.toHaveBeenCalled();
      expect(service.exportPackage).not.toHaveBeenCalled();
    });

    it('com a senha errada, não gera nada', async () => {
      const user = userEvent.setup();
      const { service, transport } = renderTela();

      await gerar(user, 'senha-errada');

      expect(await screen.findByText(/Senha incorreta/)).toBeOnTheScreen();
      expect(service.exportPackage).not.toHaveBeenCalled();
      expect(transport.send).not.toHaveBeenCalled();
    });

    it('avisa quando não consegue gerar ou enviar', async () => {
      const user = userEvent.setup();
      const transport = createTransport();
      transport.send.mockRejectedValueOnce(new Error('sem compartilhamento'));
      const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      renderTela({ transport });

      await gerar(user, SENHA);

      expect(
        await screen.findByText('Não foi possível gerar ou enviar o pacote.'),
      ).toBeOnTheScreen();
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });
  });

  describe('receber arquivo', () => {
    const importar = async (
      user: ReturnType<typeof userEvent.setup>,
      { code = CODE, senha = SENHA }: { code?: string; senha?: string } = {},
    ) => {
      if (code) await user.type(screen.getByLabelText('Código do pacote'), code);
      if (senha) await user.type(screen.getByLabelText('Senha para importar o pacote'), senha);
      await user.press(screen.getByRole('button', { name: 'Escolher pacote e importar' }));
    };

    it('importa o arquivo escolhido com o código digitado e mostra o resumo', async () => {
      const user = userEvent.setup();
      const service = createService();
      service.lastReceivedAt
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('2026-10-05T18:20:00');
      const { transport } = renderTela({ service });

      await importar(user);

      expect(await screen.findByText('Pacote importado.')).toBeOnTheScreen();
      expect(
        screen.getByText('Recebidos: 1 profissional novo e 2 pacientes novos.'),
      ).toBeOnTheScreen();
      expect(confirmPassword).toHaveBeenCalledWith(profissional.email, SENHA);
      expect(transport.receive).toHaveBeenCalled();
      expect(service.importPackage).toHaveBeenCalledWith('pacote-recebido', CODE);
      expect(
        await screen.findByText('Último recebimento de dados: 05/10/2026 às 18:20.'),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText('Código do pacote').props.value).toBe('');
    });

    it('pede o código antes de abrir o seletor de arquivos', async () => {
      const user = userEvent.setup();
      const { transport } = renderTela();

      await importar(user, { code: 'ABC' });

      expect(
        await screen.findByText('Digite o código de 12 caracteres exibido no outro tablet.'),
      ).toBeOnTheScreen();
      expect(transport.receive).not.toHaveBeenCalled();
    });

    it('com a senha errada, não abre o seletor de arquivos', async () => {
      const user = userEvent.setup();
      const { transport } = renderTela();

      await importar(user, { senha: 'senha-errada' });

      expect(await screen.findByText(/Senha incorreta/)).toBeOnTheScreen();
      expect(transport.receive).not.toHaveBeenCalled();
    });

    it('avisa quando o tablet já tinha tudo', async () => {
      const user = userEvent.setup();
      renderTela({
        service: createService({ ok: true, summary: summary((s) => (s.skipped = 4)) }),
      });

      await importar(user);

      expect(
        await screen.findByText('Este tablet já tinha todos os dados do outro.'),
      ).toBeOnTheScreen();
    });

    it('mostra o motivo quando o pacote é recusado', async () => {
      const user = userEvent.setup();
      renderTela({
        service: createService({
          ok: false,
          reason: 'codigo_incorreto',
          message: REFUSAL_MESSAGES.codigo_incorreto,
        }),
      });

      await importar(user);

      expect(await screen.findByText(REFUSAL_MESSAGES.codigo_incorreto)).toBeOnTheScreen();
    });

    it('não faz nada quando o profissional desiste de escolher o arquivo', async () => {
      const user = userEvent.setup();
      const { service } = renderTela({ transport: createTransport(null) });

      await importar(user);

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Escolher pacote e importar' }),
        ).not.toBeDisabled(),
      );
      expect(service.importPackage).not.toHaveBeenCalled();
      expect(screen.queryByText('Pacote importado.')).toBeNull();
    });

    it('avisa quando não consegue ler o arquivo', async () => {
      const user = userEvent.setup();
      const transport = createTransport();
      transport.receive.mockRejectedValueOnce(new Error('sem permissão'));
      const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      renderTela({ transport });

      await importar(user);

      expect(
        await screen.findByText('Não foi possível ler o arquivo escolhido.'),
      ).toBeOnTheScreen();
      log.mockRestore();
    });

    it('avisa sem travar a tela quando a importação lança um erro inesperado', async () => {
      const user = userEvent.setup();
      const service = createService();
      service.importPackage.mockRejectedValueOnce(new Error('inesperado'));
      const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      renderTela({ service });

      await importar(user);

      expect(await screen.findByText(REFUSAL_MESSAGES.erro)).toBeOnTheScreen();
      log.mockRestore();
    });
  });
});
