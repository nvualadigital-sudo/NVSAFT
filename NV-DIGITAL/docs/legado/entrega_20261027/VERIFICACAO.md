# Verificação da entrega — 27/10/2026

## Executado

- `pnpm test`: 34 testes aprovados, zero falhas. HTTP real com Supertest e sessões JWT; PostgreSQL embutido com dados fictícios locais. Também testes de migração, cifragem, leitura de documentos e resumo financeiro.
- `pnpm build`: TypeScript e compilação da API e da interface concluídos. Há avisos de sourcemap de componentes Radix (label/avatar/select), sem falha da compilação.
- Migração de rastreabilidade executada primeiro em branch do Neon; 16 tabelas e 24 chaves estrangeiras verificadas; aplicada na produção autorizada e branch temporário removido.
- Conferência do Neon: 24 pacientes, 11 facturas, 31 resultados; zero pedidos e autorizações de teste inseridos no circuito novo.
- Instalação numa base vazia, repetição com preservação de registos, rollback em erro e detecção de alteração de migração aplicadas testados em PGlite.
- Cópia cifrada: ida/volta, chave errada e adulteração testadas. Importação: dados reais do ficheiro são preservados; formato inválido/múltiplos registos/preço inválido são recusados.
- Removida a função que fabricava dados de BI/produto e consolidado o assistente financeiro no componente comum.

O registo da verificação de arranque do servidor compilado fica em evidencias/arranque.json; a saída de testes em evidencias/testes.txt.

## Não executado / não afirmar como concluído

- Testes visuais e de interacção em navegador: o navegador Chromium não estava instalado e a tentativa de download falhou por arquivo incompleto. Não foram produzidas screenshots de funcionamento.
- Ensaio com impressoras, etiquetas, leitores, tubos/frasco reais ou analisadores; não foi confirmada leitura física de um QR impresso.
- Homologação com médicos, enfermagem, laboratório, farmácia ou direcção; não foi confirmado um checklist oficial MINSA.
- Teste de carga, auditoria de segurança independente, revisão de dependências por CVE, MFA/SSO, assinatura qualificada ou certificação fiscal.
- pg_dump/pg_restore do hospital, teste de recuperação no alojamento ou compromisso RTO/RPO. O teste de cifragem não substitui um restauro integral.
- Chamada real a fornecedor de IA, reconhecimento/síntese de voz nos computadores locais, comunicação bancária, epidemiológica oficial, HL7/FHIR ou PACS/DICOM.
- Publicação/substituição do código no Replit.

Os dois registos legados com paciente inexistente foram preservados para revisão documental, sem associação por suposição. Ver REVISAO_DADOS.md. A matriz de estado por módulo prevalece sobre uma interpretação genérica de “completo”.
