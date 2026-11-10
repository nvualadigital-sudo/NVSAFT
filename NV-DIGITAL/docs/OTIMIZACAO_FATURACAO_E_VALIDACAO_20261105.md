# NV-DIGITAL — Facturação rápida e validação laboratorial visível

Edição `2026.11.05-netlify.8` · 05/11/2026

## Facturação

- O servidor continua a guardar, calcular, numerar e auditar documentos fiscais; a confirmação da emissão não é substituída por uma operação exclusivamente local.
- O ecrã deixará de executar a consulta completa `/billing-v2/state` a cada 7 segundos. Enquanto visível, usa intervalo de 60 segundos e actualização ao regressar à janela.
- Ao guardar um rascunho, o resultado confirmado pela API actualiza a lista em memória e dispensa uma nova consulta global.
- Depois de emitir uma factura, o documento confirmado é mostrado imediatamente. Produtos, caixa e saldos são sincronizados pouco depois, sem bloquear a apresentação ou repetir a emissão.
- O histórico dos 100 últimos caixas encerrados continua disponível, mas os movimentos são consultados em lote, numa única consulta agrupada por sessão.
- Os ecrãs de emissão e POS passam a carregar os respectivos componentes quando são abertos, reduzindo o código inicial descarregado para entrar no módulo.
- Emissão e pagamentos continuam idempotentes, com transacções e bloqueios de concorrência no servidor.

O primeiro carregamento da facturação ainda consulta o catálogo e os documentos existentes. A paginação de facturas e pesquisas no servidor poderá ser acrescentada numa optimização posterior sem eliminar históricos ou totais da interface actual.

## Laboratório — Resultados Prontos / Revisão

- A lista mostra **Validar** nos resultados pendentes de validação técnica e **Libertar** nos que aguardam libertação final.
- Nos resultados manuais, ao abrir a ficha, o botão da etapa é visível mesmo sem permissão, mas fica desactivado com uma mensagem que orienta o funcionário para a gestão das habilitações.
- Nos resultados ligados a uma amostra rastreada, a acção encaminha para o circuito, onde a validação mantém as verificações de amostra, controlo de qualidade e autoria.
- O administrador sem habilitação profissional e concessão vigente **não** recebe poderes de validação por usar uma conta administrativa. As permissões são atribuídas a profissionais autorizados em Administração → Funcionários.
- Resultados críticos exigem a competência adicional já criada, e o autor não pode validar a própria introdução quando é requerida validação independente.
- O histórico e o PDF interno provisório permanecem disponíveis antes da libertação.

## Instalação e ensaio

Instale primeiro numa branch de ensaio, use a simulação `actualizar.py --check` e confirme o fluxo com contas separadas de técnico, validador e libertador, com dados fictícios.

Nenhum ficheiro desta edição exige migração adicional. A instalação e publicação reais no Codespaces, Neon e Netlify não foram executadas automaticamente.
