# Integração da base CSS

1. Inspecionar a stack e os estilos atuais antes de importar.
2. Adaptar os tokens e classes aos padrões existentes; não apagar estilos úteis.
3. O CSS contém classes de apresentação, mas não implementa sozinho a lógica dos botões, navegação, permissões, chat ou agente.
4. O seletor de tema deve atualizar `data-theme` no elemento raiz e persistir a preferência através do sistema existente.
5. Os botões flutuantes devem ligar-se aos componentes e serviços reais.
6. Testar em desktop, tablet e telemóvel; validar contraste, foco, teclado e leitor de ecrã.
7. Não usar cores como único indicador de estado.
