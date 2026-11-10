# Validação da actualização — 28/10/2026

| Verificação | Resultado |
|---|---|
| Suite `pnpm test` | 125 testes aprovados, sem falhas, testes ignorados ou pendentes. |
| TypeScript e compilação | `pnpm build` inclui a verificação de tipos e a compilação da API e da interface. Concluído. |
| Interface | Oito cenários exercitados em DOM controlado, com os componentes reais e respostas de teste delimitadas. |
| Instalação e restauro | Nove cenários aprovados, incluindo conflitos, integridade e conservação de alterações locais. |
| Migrações | Instalação numa base local vazia, repetição sem reaplicar e rollback de uma migração falhada exercitados pela suite. As migrações anteriores foram comparadas byte a byte com a versão anterior. |
| Entrega | ZIP completo e incremental conferidos; sem credenciais reais, dependências instaladas, compilações ou cópias locais. |

Os testes de API executam os pedidos HTTP e SQL sobre PostgreSQL local via PGlite, com dados fictícios separados por instituição. Incluem referência a paciente de outra empresa, permissões de escrita, revisões antigas, pagamento repetido, pagamento acima do saldo, IVA/arredondamentos, notas de crédito com cobertura antiga, glosas, extractos com saldo anterior, facturas particulares e conservação da identidade nos documentos.

Os cenários de interface conferem categoria/especialidade e edição sem substituir a palavra-passe, selecção geográfica em cascata, simulação explícita do seguro, navegação da cobrança, XLSX aberto novamente com valores numéricos, neutralização de fórmulas em CSV/XLSX e impressão de PDF/documento médico com o autor correcto. Não substituem a aceitação funcional pelos profissionais nem testes num navegador e equipamentos reais.

O instalador foi aplicado a uma cópia da versão com Facturação Integrada e Escalas/Salários, incluindo exactamente os cinco ficheiros enviados, com alterações locais adicionais. Conservou o Login e `App.tsx`, integrou uma alteração local compatível, recusou conflitos antes de escrever, verificou SHA-256, bloqueou ligações simbólicas e permitiu repor a cópia. Recusou também um restauro que apagaria alterações posteriores.

A suite conserva o limite de dois ficheiros de teste em simultâneo da versão enviada. Os cenários de base usam PostgreSQL local via PGlite. Não foi efectuado um ensaio de carga, uma homologação externa ou uma migração na base Neon de produção. A migração dessa base é uma etapa da instalação no ambiente do utilizador.

## Verificação da integração actual

Foram conservados os testes recebidos da Facturação Integrada e Escalas/Salários e acrescentados cenários de ligação às seguradoras. Verificaram-se cálculo por linha e desconto fixo com cêntimos, cobertura congelada após mudança do contrato, recibo parcial com sessão aberta, referência bancária, repetição do mesmo pedido, recusa de montante excessivo e instituição alheia, notas de crédito por índice de acto, saldos separados por pagador e imutabilidade da factura. Um movimento manual não pode converter uma factura de ensaio em entrada na contabilidade real.

A interface foi exercitada também na página nativa real: paciente, item do catálogo, contrato, validação e emissão sem pagamento integral indevido. A cobrança envia o recibo parcial ao motor nativo, mantendo a chave do pedido e identificando homologação. Os oito cenários usam DOM controlado; não houve um teste novo de rede WebRTC, impressão em equipamento, som físico ou aceitação clínica.

A consulta directa ao chat «Saudação cordial» não esteve disponível. A integração usa os pacotes recuperados de Facturação Integrada e Escalas/Salários e os cinco ficheiros actuais anexados pelo utilizador. Não se afirma ter lido ficheiros remotos do Codespaces nem ter actualizado a base Neon.
