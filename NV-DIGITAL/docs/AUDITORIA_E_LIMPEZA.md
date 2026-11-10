# Auditoria e limpeza

Ponto de restauro: NVUALASOFT_Integrado.zip da entrega anterior; hashes da base conservados durante esta revisão. Os dois kits são requisitos complementares, não aplicações. Não apagar tabelas/dados nem reconstruir a stack.

Candidatos: atalhos separados Ginecologia/Nutrição/Cardiologia, que importam o mesmo Medico; retirar apenas do menu e conservar os ficheiros por compatibilidade. ModuloEmDesenvolvimento: pesquisar usos antes de remover. Resultados antigos: preservar histórico, distinguir dos novos resultados com rastreabilidade; impedir que a API antiga altere resultados validados no novo circuito. Nenhum dado clínico deve ser convertido por suposição.

Não remover catálogos e protocolos antigos em massa: precisam revisão por instituição. Reversão: voltar ao código do ZIP anterior mantendo as migrações aditivas, sem apagar os registos criados. Parar as escritas antes de qualquer restauro.

## Execução desta revisão

Retirados do menu os placeholders hospitalar/escolar e o modelo informativo de enfermagem. Wrappers médicos continuam como ficheiros de compatibilidade, mas o menu usa Atendimento Clínico único. Os imports lazy de lançamentos antigos foram retirados da navegação activa; o arquivo continua disponível no código.

Evidência de simulação: a função handleFileChange da facturação usava um atraso e preenchia um nome/BI fixos e preços/stock aleatórios. Foi substituída por lerCadastro, que lê os bytes e recusa dados não reconhecidos; o teste de importação verifica esse comportamento. A versão anterior foi preservada em legado/faturacao-antes-da-leitura-real.zip.

Retirado o assistente local de respostas por palavras-chave da facturação e ligado o atalho ao componente comum, sem fingir uma resposta de IA. Corrigidas as configurações que apresentavam sucesso sem esperar o servidor e a acção de importação de backup que só anunciava desenvolvimento. O backup real tem comandos próprios com cifragem e destino de ensaio isolado.

Nenhuma tabela/dado foi eliminado. O restauro do código anterior deve preservar o schema aditivo e os registos entretanto criados. As três migrações anteriores não foram reescritas.

Retirado o script gerar-schema.js depois de confirmar ausência de referências no projecto; tinha um fallback de ligação com credenciais. A geração do schema é agora scripts/generate-base.ts e as alterações executam-se exclusivamente por migrações. O segredo não foi arquivado no pacote.

No pacote final foram retirados os exportadores/sincronizadores antigos entre Neon/Replit, ficheiros vazios e saídas de schema/logs da raiz: não são referenciados pelos comandos de execução. As páginas soltas Salarios.tsx e ResumoFinanceiro.tsx da raiz foram preservadas em legado/paginas-soltas-raiz.zip; a navegação utiliza as versões dentro de src/pages. O ZIP não leva dumps nem scripts de cópia de dados entre bancos.
