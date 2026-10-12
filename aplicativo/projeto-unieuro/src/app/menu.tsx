import HomeScreen from '@/features/home/home-screen';

// A lista começa vazia: os pacientes passam a existir com o registro do
// atendimento (#7), que cria a tabela e a consulta dos pacientes de cada
// profissional. Até lá, a tela mostra o estado de primeiro acesso.
export default function HomeRoute() {
  return <HomeScreen patients={[]} />;
}
