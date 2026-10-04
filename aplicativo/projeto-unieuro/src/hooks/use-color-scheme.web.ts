import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// Não há nada para observar: o valor só muda da renderização estática para a do cliente.
const subscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 *
 * O `useSyncExternalStore` devolve `false` na renderização estática e na hidratação e
 * `true` no cliente, sem o `setState` dentro de efeito que o lint aponta.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
