# Revisão do POS: catálogo e Farmácia — 05/11/2026

## Problema encontrado

O POS financeiro atribuia os sectores «Comércio», «Farmácia», «Restaurante» e «Serviços» pelo nome e descrição dos artigos. Isso levava um exame ou uma consulta que mencionasse «hospital», «saúde» ou «medicamentos» a aparecer erradamente em «Farmácia». As categorias não reflectiam o catálogo da empresa.

## Correcção implementada

- Sectores visíveis: «Todos», «Comércio (EXAMES-LAB)», «Farmácia».
- Um produto entra na secção Farmácia quando a **categoria cadastrada** identifica medicamento ou produto farmacêutico. Os restantes produtos activos continuam no Comércio (EXAMES-LAB), sem perder registos de categorias anteriores.
- Aparece um segundo filtro com **categorias reais existentes nos artigos activos da empresa**; não foram criadas categorias por defeito.
- Alterar o sector limpa a categoria anteriormente escolhida; a pesquisa por nome, código, código de barras e categoria continua disponível.
- O POS da Farmácia mostra um aviso accionável quando faltam receitas clínicas activas ou lotes farmacêuticos na instituição.

## Distinção importante entre os dois balcões

O POS financeiro em `Facturação` regista documentos fiscais e consulta o catálogo financeiro. O **POS da Farmácia**, em `Farmácia → Balcão POS`, usa receitas recebidas dos médicos e lotes individuais, com saldo de formação e rastreabilidade próprios. A simples apresentação de um medicamento no catálogo financeiro **não valida automaticamente** uma receita nem movimenta o lote do balcão clínico.

**A farmácia clínica ainda está em modo de formação, sem validade fiscal.** Não utilizar os seus documentos de ensaio como facturas homologadas. Antes de pedir emissão real integrada, é necessário definir e ensaiar a reconciliação transaccional entre receita, lote, stock real, documento fiscal e devolução. Nenhuma tabela Neon foi alterada nesta edição.

Se o balcão de Farmácia aparecer vazio, verificar:

1. A instituição activa e as permissões do operador.
2. Receitas válidas emitidas pelo módulo Médico e recebidas na Farmácia.
3. Lotes activos, não expirados e com stock na instituição.
4. A execução de `pnpm db:status` e a disponibilidade da API correcta; não utilizar a Neon de produção para ensaios.

## Validação

- Testes do catálogo POS: sector estrito, exame hospitalar não classificado como medicamento, categorias vindas dos artigos activos.
- Testes totais: 205 aprovados.
- Compilação de API/TypeScript/frontend: concluída.
- Pendentes: teste visual no navegador, ensaio com receitas/lotes reais em base de teste, confirmação do fluxo fiscal pela equipa e publicação autorizada.
