# 2026.2-UNB-FCTE_UNIEURO_MED-APP

Aplicativo Android do projeto MED, desenvolvido pela equipe de Engenharia de Produto de Software (EPS) em parceria com a **UNIEURO**. O app roda no tablet, 100% offline, e guarda os dados localmente em SQLite. Atualmente inclui o cadastro e o login do profissional e o menu principal.

## Tecnologias

- [Expo](https://docs.expo.dev/) SDK 57, com React Native 0.86 e React 19
- [Expo Router](https://docs.expo.dev/router/introduction/) para a navegação, baseada nos arquivos de `src/app/`
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) para o banco local
- [EAS Build](https://docs.expo.dev/build/introduction/) para gerar o APK
- Jest com `jest-expo` e Testing Library para os testes

## Estrutura

``` text
aplicativo/projeto-unieuro/
  assets/                   Recursos visuais do aplicativo
  src/
    app/                    Rotas do Expo Router
      _layout.tsx           Layout raiz, fontes e splash screen
      index.tsx             Login
      register.tsx          Cadastro do profissional
      menu.tsx              Menu principal
    constants/              Constantes compartilhadas e tema
    db/                     Esquema, migrações e acesso ao banco SQLite
    features/auth/          Telas, validação e senha do cadastro e do login
    hooks/                  Hooks reutilizáveis
  app.json                  Configuração do Expo
  eas.json                  Perfis de build do EAS
  package.json              Scripts e dependências
```

## Rodando localmente

Requer Node.js 22 (a mesma versão usada no CI) e npm. Os comandos abaixo são executados na pasta do aplicativo:

``` bash
cd aplicativo/projeto-unieuro
npm install
npm start
```

O `npm start` sobe o servidor de desenvolvimento do Expo (Metro) e mostra um QR code com as opções para abrir o app.

### Abrindo no tablet ou celular

1. Instale o [Expo Go](https://expo.dev/go) no aparelho Android. A versão do Expo Go precisa suportar o SDK 57.
2. Conecte o aparelho na mesma rede do computador.
3. Leia o QR code exibido no terminal pelo Expo Go.

Se a rede bloquear a conexão entre os dispositivos, por exemplo no Wi-Fi da universidade, use o túnel:

``` bash
npx expo start --tunnel
```

O aparelho precisa de rede só durante o desenvolvimento, para falar com o Metro. O APK gerado pelo EAS funciona sem internet.

### Executar por plataforma

``` bash
npm run android
npm run ios
npm run web
```

- Android: abre o app num emulador ativo ou num dispositivo conectado por USB.
- iOS: requer macOS com Xcode. O produto é entregue só para Android.
- Web: abre o app no navegador, útil para conferir telas. O banco SQLite tem limitações na web, então teste os fluxos com dados num aparelho ou emulador.

## Gerando o APK

O APK é gerado com o EAS Build, usando o perfil `preview` do `eas.json`, que produz um `.apk` para instalar direto no tablet, sem loja de aplicativos.

``` bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

É preciso entrar com uma conta Expo que tenha acesso ao projeto configurado em `app.json` (`extra.eas.projectId`). Ao final do build, o EAS mostra o link para baixar o APK.

Perfis disponíveis:

| Perfil        | Uso                                                  |
| ------------- | ---------------------------------------------------- |
| `development` | Build de desenvolvimento com development client      |
| `preview`     | APK de distribuição interna, usado nas entregas      |
| `production`  | Build de produção, com incremento automático de versão |

### Permissões e backup do APK

O APK de entrega não acessa a internet. Nos perfis `preview` e `production`, o `app.config.js` bloqueia a permissão `INTERNET` e as permissões que o modelo do Expo acrescenta sem uso. O build de desenvolvimento continua com a internet, porque precisa dela para falar com o Metro.

Em todos os perfis, o backup automático do Android fica desligado (`android.allowBackup: false`), e o plugin `plugins/with-data-extraction-rules.js` impede a transferência dos dados para outro aparelho no Android 12 ou mais novo. Assim, os dados do aplicativo não saem do tablet.

Para conferir o manifesto do APK de entrega sem passar pelo EAS:

``` bash
EAS_BUILD_PROFILE=preview npx expo prebuild --platform android --clean
```

O manifesto gerado fica em `android/app/src/main/AndroidManifest.xml`. A pasta `android/` não é versionada. O prebuild também troca os scripts `android` e `ios` do `package.json`; desfaça essa mudança antes de commitar.

## Verificação

Para verificar o código com o linter:

``` bash
npm run lint
```

Para executar os testes automatizados:

``` bash
npm test
```

Para gerar o relatório de cobertura em `coverage/lcov.info`, que é o arquivo lido pelo SonarCloud:

``` bash
npm run test:coverage
```

Se os testes falharem com `Cannot find module` vindo do Babel, verifique o caminho do repositório: a resolução de plugins do Babel não funciona quando algum diretório do caminho tem acento, como a pasta `Área de trabalho` do Linux em português. Clone em um caminho sem acento, por exemplo `~/dev`.

Se houver problemas relacionados ao cache do Expo, reinicie o servidor limpando-o:

``` bash
npx expo start --clear
```

## Como contribuir

1. Crie uma branch a partir da `develop`.
2. Faça as alterações no aplicativo em `aplicativo/projeto-unieuro/`.
3. Execute `npm run lint` e `npm test` dentro dessa pasta.
4. Abra um Pull Request para a `develop`, seguindo o [Guia de Contribuição](CONTRIBUTING.md).

## Licença

Consulte o arquivo [LICENSE](LICENSE).
