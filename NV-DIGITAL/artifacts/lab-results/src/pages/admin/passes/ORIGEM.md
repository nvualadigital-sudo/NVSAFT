# Origem dos modelos de passes

`modelos-originais.html` recupera a estrutura e o CSS do ficheiro `NVUALASOFT/artifacts/lab-results/src/pages/PASS DA APP.HTML`, no ZIP original fornecido pelo utilizador. Conserva os 80 modelos, opções gráficas, frente e verso e geração em lote.

As adaptações integram os dados da instituição e do funcionário seleccionado, retiram valores fictícios de identificação, escapam nomes importados e separam preferências por empresa. O designer executa num iframe sem acesso à sessão da aplicação.

`runtime.mjs` fornece as bibliotecas pelo próprio projecto. `scripts/build-pass-vendor.mjs` compila-as para `public/vendor/passes-runtime.js` antes de iniciar ou compilar a interface. Os avisos de licença das bibliotecas são mantidos no ficheiro gerado. Não é necessário instalar componentes adicionais no computador do utilizador.
