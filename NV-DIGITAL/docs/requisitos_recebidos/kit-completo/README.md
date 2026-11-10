# NV.Digital — Kit completo de arquitetura e integração

## Este ZIP é
Um pacote de requisitos e orientação de arquitetura para trabalhar no **projeto real existente** do NV.Digital. Contém prompt mestre, mapa de módulos, matriz inicial de permissões, regras de segurança, critérios de teste, CSS base e imagem de referência visual.

## Este ZIP não é
- Não é uma aplicação hospitalar pronta.
- Não é uma demo nem um dashboard funcional.
- Não contém o código-fonte atual do NV.Digital, porque o projeto real não foi anexado nesta etapa.
- Não afirma que qualquer módulo esteja implementado no sistema real.
- Não substitui validação clínica, jurídica, de segurança ou operacional.

## Regra principal
**NÃO QUERO DEMO.** O GPT deve analisar o código real, preservar o que funciona, implementar o que falta e só remover itens comprovadamente sem uso. Se o projeto real não estiver anexado, deve pedi-lo antes de afirmar que alterou o software.

## Conteúdo
- `00_LEIA_PRIMEIRO/PROMPT_MESTRE_NV_DIGITAL.md` — instruções para o GPT Plus.
- `01_ARQUITETURA/ARQUITETURA_ALVO.md` — princípios de arquitetura.
- `01_ARQUITETURA/TREE_SISTEMA_NV_DIGITAL.md` — árvore-alvo detalhada de pastas e ficheiros; exige também a geração da árvore real após receber o projeto.
- `02_MATRIZ_PERMISSOES/MATRIZ_PERMISSOES.md` — perfis, ações e limites; precisa de validação institucional.
- `02_MATRIZ_PERMISSOES/matriz_permissoes_base.csv` — matriz em formato tabular editável.
- `03_MODULOS/` — um documento por módulo funcional.
- `04_DESIGN_SYSTEM/styles/nv-digital.css` — base visual para integrar/adaptar.
- `05_SEGURANCA/SEGURANCA_E_PRIVACIDADE.md` — segurança e dados clínicos.
- `06_TESTES_E_ACEITACAO/CRITERIOS_DE_ACEITACAO.md` — critérios de aceitação e testes.
- `07_REFERENCIAS_VISUAIS/referencia_biblioteca_componentes.jpg` — imagem fornecida como referência de componentes.

## Como usar
1. Faz uma cópia de segurança do projeto atual.
2. Envia este ZIP e o ZIP/repositório real do NV.Digital ao GPT Plus.
3. Pede para começar pelo inventário e auditoria, sem alterar ficheiros antes de mapear o projeto.
4. Exige testes e relatório das alterações.
5. Não aceites a eliminação de código ou dados sem evidência e plano de reversão.
6. Não partilhes segredos nem dados reais de pacientes no pacote.

O trabalho deve ser organizado por prioridade, dependências e critérios de aceitação; não há prazo imposto neste kit.

## Adaptação institucional incluída nesta versão
A pasta `08_ADAPTACAO_INSTITUCIONAL/` acrescenta requisitos específicos para:
- Hospital dos Queimados Presidente Julius Nyerere, Kilamba, Luanda.
- CETEP — Centro Especializado de Tratamento de Endemias e Pandemias (confirmar se esta é a instituição pretendida quando o pedido disser “CETP”).
- Arquitetura multiunidade, segregação de dados, fluxos e fases de implementação.

Esta atualização continua a ser um kit de arquitetura e requisitos. Para alterar o NV.Digital real, é necessário anexar o código-fonte/ZIP atual do projeto.
