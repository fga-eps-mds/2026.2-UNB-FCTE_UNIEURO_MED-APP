import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import HomeScreen from '@/features/home/home-screen';
import type { PatientSummary } from '@/features/home/patients';

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

function renderTela(
  patients: readonly PatientSummary[] = pacientes,
  sessao: SessionProfessional | null = profissional,
) {
  return render(
    <SessionProvider initialProfessional={sessao}>
      <HomeScreen patients={patients} />
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
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      renderTela([]);

      const exportar = screen.getByRole('button', { name: 'Exportar todos (XML)' });
      expect(exportar).toBeDisabled();

      await user.press(exportar);
      expect(alerta).not.toHaveBeenCalled();
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

  describe('Cenário: sincronizar tablets', () => {
    it('informa que a sincronização ainda não está disponível', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      renderTela();

      await user.press(screen.getByRole('button', { name: 'Sincronizar tablets' }));

      expect(alerta).toHaveBeenCalledWith(
        'Sincronizar tablets',
        expect.stringMatching(/ainda não está disponível/),
      );
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

    it.each([
      ['Novo exame', 'Novo exame', /registro do atendimento/],
      ['Sincronizar tablets', 'Sincronizar tablets', /em estudo/],
      ['Exportar todos (XML)', 'Exportar todos (XML)', /exportação em XML/],
    ])('o botão "%s" avisa o que ainda falta', async (botao, titulo, mensagem) => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      renderTela();

      await user.press(screen.getByRole('button', { name: botao }));

      expect(alerta).toHaveBeenCalledWith(titulo, expect.stringMatching(mensagem));
    });

    it('avisa que os exames do paciente chegam em uma próxima entrega', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      renderTela();

      await user.press(botoesDePaciente()[0]);

      expect(alerta).toHaveBeenCalledWith(
        'Antônio Carlos Ferreira',
        expect.stringMatching(/exames do paciente/),
      );
    });
  });
});
