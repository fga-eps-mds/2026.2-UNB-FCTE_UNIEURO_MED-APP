import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { toLinhaConta, type ContaProfissional } from '@/features/superusuario/contas';
import {
  CARREGANDO_CONTAS,
  FALHA_AO_CARREGAR_CONTAS,
  SEM_CONTAS,
  TabelaContas,
} from '@/features/superusuario/tabela-contas';

const conta = (dados: Partial<ContaProfissional>): ContaProfissional => ({
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
  active: true,
  superuser: false,
  examCount: 12,
  ...dados,
});

const contas = [
  conta({}),
  conta({
    id: 8,
    name: 'Juliana Mendes Costa',
    email: 'juliana.costa@unieuro.com.br',
    crmNumber: '34567',
    crmState: 'GO',
    active: false,
    examCount: 3,
  }),
  conta({
    id: 1,
    name: 'Carlos Bernardo Tauil',
    email: 'carlos.tauil@unieuro.com.br',
    crmNumber: '12771',
    superuser: true,
    examCount: 1,
  }),
].map(toLinhaConta);

const larguraOriginal = Dimensions.get('window');

function naLargura(width: number) {
  act(() => Dimensions.set({ window: { ...larguraOriginal, width } }));
}

afterEach(() => {
  act(() => Dimensions.set({ window: larguraOriginal }));
});

describe('Cenário: visualizar médicos', () => {
  it('mostra uma linha por conta, com o nome, o CRM, a situação e os exames', () => {
    render(<TabelaContas contas={contas} />);

    expect(
      screen.getByLabelText('Ana Carolina Souza, CRM 12345/DF, Ativa, 12 exames'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Juliana Mendes Costa, CRM 34567/GO, Desativada, 3 exames'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Carlos Bernardo Tauil, CRM 12771/DF, Superusuário, 1 exame'),
    ).toBeTruthy();
  });

  it('mostra o selo de cada situação', () => {
    render(<TabelaContas contas={contas} />);

    expect(screen.getAllByTestId('situacao')).toHaveLength(3);
    expect(screen.getByText('Ativa')).toBeTruthy();
    expect(screen.getByText('Desativada')).toBeTruthy();
    expect(screen.getByText('Superusuário')).toBeTruthy();
  });

  it('na tela larga, mostra os títulos das colunas e o CRM numa coluna própria', () => {
    naLargura(1280);
    render(<TabelaContas contas={contas} />);

    for (const titulo of ['MÉDICO', 'CRM', 'SITUAÇÃO', 'EXAMES']) {
      expect(screen.getByText(titulo)).toBeTruthy();
    }
    expect(screen.getByText('12345/DF')).toBeTruthy();
  });

  it('na tela estreita, sem os títulos, o CRM fica embaixo do nome', () => {
    naLargura(600);
    render(<TabelaContas contas={contas} />);

    expect(screen.queryByText('SITUAÇÃO')).toBeNull();
    expect(screen.getByText('CRM 12345/DF')).toBeTruthy();
  });
});

describe('Buscar médico', () => {
  it('filtra a tabela pelo que é digitado', () => {
    render(<TabelaContas contas={contas} />);

    fireEvent.changeText(screen.getByLabelText('Buscar médico'), 'juliana');

    expect(screen.getByText('Juliana Mendes Costa')).toBeTruthy();
    expect(screen.queryByText('Ana Carolina Souza')).toBeNull();
    expect(screen.queryByText('Carlos Bernardo Tauil')).toBeNull();
  });

  it('avisa quando ninguém bate com a busca', () => {
    render(<TabelaContas contas={contas} />);

    fireEvent.changeText(screen.getByLabelText('Buscar médico'), '  Marcos  ');

    expect(screen.getByText('Nenhum médico encontrado para “Marcos”.')).toBeTruthy();
  });

  it('sem contas, não mostra a busca', () => {
    render(<TabelaContas contas={[]} />);

    expect(screen.queryByLabelText('Buscar médico')).toBeNull();
    expect(screen.getByText(SEM_CONTAS)).toBeTruthy();
  });
});

describe('ações da conta', () => {
  it('oferece desativar só a conta ativa de um médico', () => {
    render(<TabelaContas contas={contas} onDesativar={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Desativar a conta de Ana Carolina Souza' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Desativar a conta de/ })).toHaveLength(1);
  });

  it('entrega a linha escolhida para quem abre a desativação', () => {
    const onDesativar = jest.fn();
    render(<TabelaContas contas={contas} onDesativar={onDesativar} />);

    fireEvent.press(
      screen.getByRole('button', { name: 'Desativar a conta de Ana Carolina Souza' }),
    );

    expect(onDesativar).toHaveBeenCalledWith(contas[0]);
  });

  it('oferece redefinir a senha só da conta ativa de um médico', () => {
    const onRedefinirSenha = jest.fn();
    render(<TabelaContas contas={contas} onRedefinirSenha={onRedefinirSenha} />);

    expect(screen.getAllByRole('button', { name: /^Redefinir a senha de/ })).toHaveLength(1);
    fireEvent.press(
      screen.getByRole('button', { name: 'Redefinir a senha de Ana Carolina Souza' }),
    );

    expect(onRedefinirSenha).toHaveBeenCalledWith(contas[0]);
  });

  it('mostra só a ação que recebeu', () => {
    render(<TabelaContas contas={contas} onRedefinirSenha={jest.fn()} />);

    expect(screen.queryByRole('button', { name: /^Desativar a conta de/ })).toBeNull();
  });

  it('sem as ações, só lista as contas', () => {
    render(<TabelaContas contas={contas} />);

    expect(screen.queryByRole('button', { name: /^Desativar a conta de/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Redefinir a senha de/ })).toBeNull();
  });
});

describe('carregando e falha', () => {
  it('mostra que está carregando enquanto a primeira leitura não termina', () => {
    render(<TabelaContas contas={[]} loading />);

    expect(screen.getByLabelText(CARREGANDO_CONTAS)).toBeTruthy();
    expect(screen.queryByText(SEM_CONTAS)).toBeNull();
  });

  it('avisa a falha e não diz que não há contas', () => {
    render(<TabelaContas contas={[]} loadFailed />);

    expect(screen.getByText(FALHA_AO_CARREGAR_CONTAS)).toBeTruthy();
    expect(screen.queryByText(SEM_CONTAS)).toBeNull();
  });

  it('depois de uma falha ao recarregar, mantém a tabela que já estava na tela', () => {
    render(<TabelaContas contas={contas} loadFailed />);

    expect(screen.getByText(FALHA_AO_CARREGAR_CONTAS)).toBeTruthy();
    expect(screen.getByText('Ana Carolina Souza')).toBeTruthy();
  });
});
