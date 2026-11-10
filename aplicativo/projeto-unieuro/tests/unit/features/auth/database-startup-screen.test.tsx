import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { hideAsync } from 'expo-splash-screen';

import RootLayout from '@/app/_layout';
import { initializeDatabase } from '@/features/auth/database-startup';

jest.mock('@/features/auth/database-startup', () => ({
  initializeDatabase: jest.fn(),
  databaseStartupMessage: () => 'Falha ao abrir o banco.',
}));

jest.mock('expo-router', () => ({
  Stack: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'Rotas do aplicativo');
  },
}));

const mockInitialize = jest.mocked(initializeDatabase);

it('mantém a abertura protegida enquanto o banco está carregando', () => {
  mockInitialize.mockImplementationOnce(() => new Promise(() => undefined));

  render(<RootLayout />);

  expect(screen.queryByText('Rotas do aplicativo')).toBeNull();
  expect(hideAsync).not.toHaveBeenCalled();
});

it('mostra a falha e só libera as rotas depois de uma nova tentativa bem-sucedida', async () => {
  mockInitialize.mockRejectedValueOnce(new Error('falha')).mockResolvedValueOnce(undefined);

  render(<RootLayout />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao abrir o banco.');
  expect(screen.queryByText('Rotas do aplicativo')).toBeNull();
  await waitFor(() => expect(hideAsync).toHaveBeenCalled());

  fireEvent.press(screen.getByRole('button', { name: /tentar novamente/i }));

  expect(await screen.findByText('Rotas do aplicativo')).toBeOnTheScreen();
  expect(mockInitialize).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});
