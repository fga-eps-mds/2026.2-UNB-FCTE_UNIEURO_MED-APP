import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import HomeScreen, {
  CPF_SEARCH_FAILED_MESSAGE,
  LOADING_MESSAGE,
  LOAD_FAILED_MESSAGE,
  NOTICE_DURATION_MS,
} from '@/features/home/home-screen';
import type { PatientCpf, PatientSummary } from '@/features/home/patients';
import type { ResultadoExportacao } from '@/features/exportacao/exportacao';
import { FALHA_AO_EXPORTAR, NADA_A_EXPORTAR } from '@/features/exportacao/exportar-todos-dialog';

const profissional: SessionProfessional = {
  id: 1,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const pacientes: PatientSummary[] = [
  {
    id: 1,
    name: 'José Alves Martins',
    recordNumber: '2026-0184',
    lastExamAt: '2026-09-28T10:05:00',
    lastExamStatus: 'interrompido',
    examCount: 2,
  },
  {
    id: 2,
    name: 'Antônio Carlos Ferreira',
    recordNumber: '2026-0179',
    lastExamAt: '2026-10-05T14:32:00',
    lastExamStatus: 'concluido',
    examCount: 1,
  },
  {
    id: 3,
    name: 'Raimundo Nonato Costa',
    recordNumber: '2026-0166',
    lastExamAt: '2026-09-29T09:00:00',
    lastExamStatus: 'recusado',
    examCount: 1,
  },
];

const SALVO: ResultadoExportacao = {
  estado: 'salvo',
  arquivo: 'exames_2026-11-12_1430.xml',
  pacientes: 3,
  exames: 4,
};

function renderTela(
  patients: readonly PatientSummary[] = pacientes,
  sessao: SessionProfessional | null = profissional,
  exportAll: jest.Mock = jest.fn(async () => SALVO),
) {
  return render(
    <SessionProvider initialProfessional={sessao}>
      <HomeScreen patients={patients} exportAll={exportAll} />
    </SessionProvider>,
  );
}

const botoesDePaciente = () => screen.getAllByRole('button', { name: /, ficha / });

describe('HomeScreen', () => {
  describe('Cenário: tela inicial depois do login', () => {
    it('mostra o nome e o CRM do profissional autenticado', () => {
      renderTela();

      expect(screen.getByText('Ana Carolina Souza')).toBeOnTheScreen();
      expect(screen.getByText('CRM 12345/DF')).toBeOnTheScreen();
    });

    it('mostra os atalhos de novo exame, exportação, sincronização e configurações', () => {
      renderTela();

      expect(screen.getByRole('header', { name: 'Seus pacientes' })).toBeOnTheScreen();
      for (const nome of [
        'Novo exame',
        'Exportar todos (XML)',
        'Sincronizar tablets',
        'Configurações',
        'Sair',
      ]) {
        expect(screen.getByRole('button', { name: nome })).toBeOnTheScreen();
      }
    });

    it('resume quantos pacientes e exames o profissional tem', () => {
      renderTela();

      expect(screen.getByText('3 pacientes e 4 exames aplicados por você.')).toBeOnTheScreen();
    });
  });

  describe('Cenário: primeiro acesso', () => {
    it('informa que ainda não há pacientes e indica o botão de novo exame', () => {
      renderTela([]);

      expect(screen.getByRole('header', { name: 'Nenhum paciente ainda' })).toBeOnTheScreen();
      expect(screen.getByText(/Comece pelo botão Novo exame/)).toBeOnTheScreen();
      expect(screen.getByText('Nenhum exame aplicado ainda.')).toBeOnTheScreen();
    });

    it('não mostra a busca enquanto não há paciente', () => {
      renderTela([]);

      expect(screen.queryByLabelText('Buscar paciente')).toBeNull();
    });

    it('desabilita a exportação de todos enquanto não há exame', async () => {
      const user = userEvent.setup();
      renderTela([]);

      const exportar = screen.getByRole('button', { name: 'Exportar todos (XML)' });
      expect(exportar).toBeDisabled();

      await user.press(exportar);
      expect(screen.queryByTestId('aviso-rapido')).toBeNull();
    });

    it('mostra o paciente sem exame e mantém a exportação desabilitada', () => {
      renderTela([{ ...pacientes[0], lastExamAt: null, lastExamStatus: null, examCount: 0 }]);

      expect(screen.getByText('Sem exame')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Exportar todos (XML)' })).toBeDisabled();
    });
  });

  describe('lista de pacientes', () => {
    it('mostra primeiro o paciente com o exame mais recente', () => {
      renderTela();

      expect(botoesDePaciente().map((botao) => botao.props.accessibilityLabel)).toEqual([
        'Antônio Carlos Ferreira, ficha 2026-0179, último exame 05/10/2026, Concluído',
        'Raimundo Nonato Costa, ficha 2026-0166, último exame 29/09/2026, Recusou o termo',
        'José Alves Martins, ficha 2026-0184, último exame 28/09/2026, Interrompido',
      ]);
    });

    it('mostra a situação do último exame de cada paciente', () => {
      renderTela();

      expect(screen.getByText('Concluído')).toBeOnTheScreen();
      expect(screen.getByText('Interrompido')).toBeOnTheScreen();
      expect(screen.getByText('Recusou o termo')).toBeOnTheScreen();
    });

    it('mostra todas as colunas quando a tela é larga', () => {
      renderTela();

      fireEvent(screen.getByTestId('tela-inicial'), 'layout', {
        nativeEvent: { layout: { width: 1280, height: 800 } },
      });

      for (const coluna of ['PACIENTE', 'FICHA', 'ÚLTIMO EXAME', 'EXAMES']) {
        expect(screen.getByText(coluna)).toBeOnTheScreen();
      }
      expect(screen.getByText('2026-0184')).toBeOnTheScreen();
      expect(screen.queryByText('Ficha 2026-0184')).toBeNull();
    });

    it('deixa a exportação de um paciente para a tela dos exames dele', () => {
      renderTela();

      expect(screen.queryByRole('button', { name: /^Exportar os exames de/ })).toBeNull();
    });

    it('junta a ficha ao nome quando a tela é estreita', () => {
      renderTela();

      fireEvent(screen.getByTestId('tela-inicial'), 'layout', {
        nativeEvent: { layout: { width: 600, height: 960 } },
      });

      expect(screen.getByText('Ficha 2026-0184')).toBeOnTheScreen();
      expect(screen.queryByText('FICHA')).toBeNull();
    });
  });

  describe('Cenário: busca de paciente', () => {
    it('filtra por parte do nome, sem diferenciar acentos', async () => {
      const user = userEvent.setup();
      renderTela();

      await user.type(screen.getByLabelText('Buscar paciente'), 'antonio');

      expect(botoesDePaciente()).toHaveLength(1);
      expect(screen.getByText('Antônio Carlos Ferreira')).toBeOnTheScreen();
    });

    it('filtra pelo número da ficha', async () => {
      const user = userEvent.setup();
      renderTela();

      await user.type(screen.getByLabelText('Buscar paciente'), '0166');

      expect(botoesDePaciente()).toHaveLength(1);
      expect(screen.getByText('Raimundo Nonato Costa')).toBeOnTheScreen();
    });

    it('avisa quando nenhum paciente corresponde', async () => {
      const user = userEvent.setup();
      renderTela();

      await user.type(screen.getByLabelText('Buscar paciente'), 'Helena');

      expect(screen.getByText('Nenhum paciente encontrado para “Helena”.')).toBeOnTheScreen();
    });
  });

  describe('busca pelo CPF', () => {
    const cpfsDosPacientes: PatientCpf[] = [
      { patientId: 1, cpf: '12345678909' },
      { patientId: 2, cpf: '98765432100' },
    ];

    const tela = (
      loadPatientCpfs: () => Promise<PatientCpf[]>,
      patients: readonly PatientSummary[] = pacientes,
    ) => (
      <SessionProvider initialProfessional={profissional}>
        <HomeScreen patients={patients} loadPatientCpfs={loadPatientCpfs} />
      </SessionProvider>
    );

    it('encontra o paciente pelos primeiros dígitos do CPF, com ou sem pontuação', async () => {
      const user = userEvent.setup();
      render(tela(jest.fn().mockResolvedValue(cpfsDosPacientes)));

      await user.type(screen.getByLabelText('Buscar paciente'), '123.45');

      expect(await screen.findByText('José Alves Martins')).toBeOnTheScreen();
      expect(botoesDePaciente()).toHaveLength(1);
    });

    it('só lê os CPFs quando a busca tem dígitos, e uma vez só', async () => {
      const user = userEvent.setup();
      const loadPatientCpfs = jest.fn().mockResolvedValue(cpfsDosPacientes);
      render(tela(loadPatientCpfs));
      const busca = screen.getByLabelText('Buscar paciente');

      await user.type(busca, 'antonio');
      expect(loadPatientCpfs).not.toHaveBeenCalled();

      await user.clear(busca);
      await user.type(busca, '987');

      expect(await screen.findByText('Antônio Carlos Ferreira')).toBeOnTheScreen();
      expect(loadPatientCpfs).toHaveBeenCalledTimes(1);
    });

    it('lê os CPFs de novo quando a lista de pacientes muda', async () => {
      const user = userEvent.setup();
      const loadPatientCpfs = jest.fn().mockResolvedValue(cpfsDosPacientes);
      const { rerender } = render(tela(loadPatientCpfs));
      await user.type(screen.getByLabelText('Buscar paciente'), '123');
      await screen.findByText('José Alves Martins');

      rerender(tela(loadPatientCpfs, [...pacientes]));

      await waitFor(() => expect(loadPatientCpfs).toHaveBeenCalledTimes(2));
    });

    it('não usa os CPFs de uma leitura que termina depois de a lista mudar', async () => {
      const user = userEvent.setup();
      let terminarPrimeira!: (cpfs: PatientCpf[]) => void;
      const loadPatientCpfs = jest
        .fn()
        .mockReturnValueOnce(new Promise((resolve) => (terminarPrimeira = resolve)))
        .mockResolvedValueOnce([]);
      const { rerender } = render(tela(loadPatientCpfs));
      await user.type(screen.getByLabelText('Buscar paciente'), '123');

      rerender(tela(loadPatientCpfs, [...pacientes]));
      await waitFor(() => expect(loadPatientCpfs).toHaveBeenCalledTimes(2));
      await act(async () => terminarPrimeira(cpfsDosPacientes));

      expect(screen.queryByText('José Alves Martins')).toBeNull();
    });

    it('avisa quando os CPFs não puderam ser lidos e continua buscando pelo nome', async () => {
      const user = userEvent.setup();
      render(tela(jest.fn().mockRejectedValue(new Error('chave indisponível'))));
      const busca = screen.getByLabelText('Buscar paciente');

      await user.type(busca, '123');
      expect(await screen.findByText(CPF_SEARCH_FAILED_MESSAGE)).toBeOnTheScreen();

      await user.clear(busca);
      await user.type(busca, 'antonio');

      expect(screen.queryByText(CPF_SEARCH_FAILED_MESSAGE)).toBeNull();
      expect(screen.getByText('Antônio Carlos Ferreira')).toBeOnTheScreen();
    });
  });

  describe('Cenário: sincronizar tablets', () => {
    it('abre a sincronização entre tablets', async () => {
      const user = userEvent.setup();
      renderTela();

      await user.press(screen.getByRole('button', { name: 'Sincronizar tablets' }));

      expect(useRouter().push).toHaveBeenCalledWith('/sincronizar');
      expect(screen.queryByTestId('aviso-rapido')).toBeNull();
    });
  });

  describe('Cenário: tela aberta sem login', () => {
    it('volta para o login', () => {
      renderTela(pacientes, null);

      expect(useRouter().replace).toHaveBeenCalledWith('/');
      expect(screen.queryByText('Seus pacientes')).toBeNull();
    });
  });

  describe('Cenário: sair', () => {
    it('encerra a sessão e volta para o login', async () => {
      const user = userEvent.setup();
      renderTela();

      await user.press(screen.getByRole('button', { name: 'Sair' }));

      expect(useRouter().replace).toHaveBeenCalledWith('/');
      expect(screen.queryByText('Seus pacientes')).toBeNull();
    });
  });

  describe('atalhos', () => {
    it('abre as configurações', async () => {
      const user = userEvent.setup();
      renderTela();

      await user.press(screen.getByRole('button', { name: 'Configurações' }));

      expect(useRouter().push).toHaveBeenCalledWith('/settings');
    });

    it('o botão "Novo exame" abre o registro do atendimento', async () => {
      const user = userEvent.setup();
      renderTela();

      await user.press(screen.getByRole('button', { name: 'Novo exame' }));

      expect(useRouter().push).toHaveBeenCalledWith('/novo-exame');
      expect(screen.queryByTestId('aviso-rapido')).toBeNull();
    });

    it('sem a exportação ligada, o botão "Exportar todos (XML)" fica desabilitado', () => {
      render(
        <SessionProvider initialProfessional={profissional}>
          <HomeScreen patients={pacientes} />
        </SessionProvider>,
      );

      expect(screen.getByRole('button', { name: 'Exportar todos (XML)' })).toBeDisabled();
    });

    it('avisa que os exames do paciente chegam em uma próxima entrega', async () => {
      const user = userEvent.setup();
      renderTela();

      await user.press(botoesDePaciente()[0]);

      expect(screen.getByText(/exames do paciente aparecem aqui/)).toBeOnTheScreen();
    });
  });

  describe('exportar todos os exames (#22)', () => {
    it('confirma antes, com o total de exames e de pacientes', async () => {
      const user = userEvent.setup();
      const exportAll = jest.fn(async () => SALVO);
      renderTela(pacientes, profissional, exportAll);

      await user.press(screen.getByRole('button', { name: 'Exportar todos (XML)' }));

      expect(screen.getByRole('header', { name: 'Exportar todos os exames' })).toBeOnTheScreen();
      expect(screen.getByText(/reúne os 4 exames dos 3 pacientes que você/)).toBeOnTheScreen();
      expect(screen.getByText(/sem nome, CPF ou ficha/)).toBeOnTheScreen();
      expect(exportAll).not.toHaveBeenCalled();
    });

    it('salva com o profissional da sessão e avisa o nome do arquivo', async () => {
      const user = userEvent.setup();
      const exportAll = jest.fn(async () => SALVO);
      renderTela(pacientes, profissional, exportAll);

      await user.press(screen.getByRole('button', { name: 'Exportar todos (XML)' }));
      await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));

      expect(exportAll).toHaveBeenCalledWith(profissional);
      expect(screen.queryByRole('header', { name: 'Exportar todos os exames' })).toBeNull();
      expect(screen.getByText('Arquivo salvo: exames_2026-11-12_1430.xml')).toBeOnTheScreen();
    });

    it('fala no singular com um exame de um paciente', async () => {
      const user = userEvent.setup();
      renderTela([pacientes[1]]);

      await user.press(screen.getByRole('button', { name: 'Exportar todos (XML)' }));

      expect(screen.getByText(/reúne o 1 exame do 1 paciente que você/)).toBeOnTheScreen();
    });

    it('cancelar fecha sem exportar', async () => {
      const user = userEvent.setup();
      const exportAll = jest.fn(async () => SALVO);
      renderTela(pacientes, profissional, exportAll);

      await user.press(screen.getByRole('button', { name: 'Exportar todos (XML)' }));
      await user.press(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('header', { name: 'Exportar todos os exames' })).toBeNull();
      expect(exportAll).not.toHaveBeenCalled();
    });

    it('se o profissional desiste da pasta, o diálogo continua aberto e sem erro', async () => {
      const user = userEvent.setup();
      renderTela(
        pacientes,
        profissional,
        jest.fn(async () => ({ estado: 'cancelado' })),
      );

      await user.press(screen.getByRole('button', { name: 'Exportar todos (XML)' }));
      await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));

      expect(screen.getByRole('header', { name: 'Exportar todos os exames' })).toBeOnTheScreen();
      expect(screen.queryByLabelText(/^Erro\./)).toBeNull();
      expect(screen.queryByTestId('aviso-rapido')).toBeNull();
    });

    it('avisa quando não há exame no banco para exportar', async () => {
      const user = userEvent.setup();
      renderTela(
        pacientes,
        profissional,
        jest.fn(async () => ({ estado: 'vazio' })),
      );

      await user.press(screen.getByRole('button', { name: 'Exportar todos (XML)' }));
      await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));

      expect(screen.getByLabelText(`Erro. ${NADA_A_EXPORTAR}`)).toBeOnTheScreen();
    });

    it('avisa quando a gravação falha e deixa tentar de novo', async () => {
      const user = userEvent.setup();
      const exportAll = jest
        .fn()
        .mockRejectedValueOnce(new Error('disco cheio'))
        .mockResolvedValueOnce(SALVO);
      renderTela(pacientes, profissional, exportAll);

      await user.press(screen.getByRole('button', { name: 'Exportar todos (XML)' }));
      await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));
      expect(screen.getByLabelText(`Erro. ${FALHA_AO_EXPORTAR}`)).toBeOnTheScreen();

      await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));
      expect(screen.getByText('Arquivo salvo: exames_2026-11-12_1430.xml')).toBeOnTheScreen();
    });
  });

  describe('aviso rápido', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('é uma mensagem de informação, sem o alerta padrão do Android', () => {
      renderTela();

      fireEvent.press(botoesDePaciente()[0]);

      expect(screen.getByLabelText(/^Informação\. Os exames do paciente/)).toBeOnTheScreen();
    });

    it('some sozinho depois de 4 segundos', () => {
      renderTela();

      fireEvent.press(botoesDePaciente()[0]);
      act(() => jest.advanceTimersByTime(NOTICE_DURATION_MS - 1));
      expect(screen.getByTestId('aviso-rapido')).toBeOnTheScreen();

      act(() => jest.advanceTimersByTime(1));
      expect(screen.queryByTestId('aviso-rapido')).toBeNull();
    });

    it('troca a mensagem e reinicia a contagem a cada toque', async () => {
      renderTela();

      fireEvent.press(screen.getByRole('button', { name: 'Exportar todos (XML)' }));
      fireEvent.press(screen.getByRole('button', { name: 'Salvar arquivo' }));
      await act(async () => {});
      act(() => jest.advanceTimersByTime(3000));
      fireEvent.press(botoesDePaciente()[0]);

      expect(screen.queryByText(/Arquivo salvo/)).toBeNull();
      expect(screen.getByText(/exames do paciente aparecem aqui/)).toBeOnTheScreen();

      act(() => jest.advanceTimersByTime(3000));
      expect(screen.getByTestId('aviso-rapido')).toBeOnTheScreen();
      act(() => jest.advanceTimersByTime(1000));
      expect(screen.queryByTestId('aviso-rapido')).toBeNull();
    });
  });

  describe('leitura dos pacientes', () => {
    it('avisa quando os pacientes não puderam ser lidos', () => {
      render(
        <SessionProvider initialProfessional={profissional}>
          <HomeScreen patients={[]} loadFailed />
        </SessionProvider>,
      );

      expect(screen.getByText(LOAD_FAILED_MESSAGE)).toBeOnTheScreen();
    });

    it('não mostra o aviso quando a leitura deu certo', () => {
      renderTela();

      expect(screen.queryByText(LOAD_FAILED_MESSAGE)).toBeNull();
    });
  });

  describe('carregando', () => {
    const renderCarregando = (patients: readonly PatientSummary[]) =>
      render(
        <SessionProvider initialProfessional={profissional}>
          <HomeScreen patients={patients} loading />
        </SessionProvider>,
      );

    it('mostra que está carregando em vez de "Nenhum paciente ainda"', () => {
      renderCarregando([]);

      expect(screen.getByLabelText(LOADING_MESSAGE)).toBeOnTheScreen();
      expect(screen.getAllByText(LOADING_MESSAGE)).toHaveLength(1);
      expect(screen.queryByText('Nenhum paciente ainda')).toBeNull();
      expect(screen.queryByText('Nenhum exame aplicado ainda.')).toBeNull();
    });

    it('mostra a lista que já tem enquanto lê de novo', () => {
      renderCarregando(pacientes);

      expect(screen.getByText('José Alves Martins')).toBeOnTheScreen();
      expect(screen.queryByLabelText(LOADING_MESSAGE)).toBeNull();
    });
  });

  it('corta em uma linha o nome longo do profissional, sem esconder configurações e sair', () => {
    const nome =
      'Ana Carolina de Souza Albuquerque Figueiredo Cavalcanti Montenegro Vasconcelos Bittencourt Guimaraes';
    renderTela(pacientes, { ...profissional, name: nome });

    expect(screen.getByText(nome)).toHaveProp('numberOfLines', 1);
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeOnTheScreen();
  });
});
