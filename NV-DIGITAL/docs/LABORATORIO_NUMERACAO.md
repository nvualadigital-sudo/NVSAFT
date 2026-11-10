# Laboratório: numeração por empresa

Edição `2026.11.03-netlify.2`. Inclui o projecto completo da edição Netlify anterior e esta melhoria do Laboratório.

## O que muda

Os novos processos, pedidos e recipientes recebem referências curtas, atribuídas pela base de dados da instituição. Pode configurar `LAB`, `ULTRA`, `LAICISA` ou outra sigla de 2 a 10 letras/números, começando por uma letra. São aceites letras A–Z sem acentos; a interface converte para maiúsculas.

Exemplo de uma empresa sem referências anteriores, com um paciente e um pedido de um único exame:

| Registo | Referência de exemplo | Utilização |
|---|---|---|
| Processo | `ULTRA/001` | Identificação permanente do paciente nesta empresa |
| Pedido | `ULTRA/002` | Um conjunto de exames solicitado num atendimento |
| Amostra/recipiente | `ULTRA/003` | Identificação física do tubo; texto e QR na etiqueta |

A sequência é partilhada pelos três tipos dentro da mesma empresa: as referências são distintas. Se houver vários tubos, cada um recebe uma referência. Um novo atendimento do mesmo paciente conserva o seu processo e cria novas referências para o pedido e as amostras. Outras empresas têm a sua própria sequência e não recebem os dados desta empresa.

## Onde configurar

Entre com um administrador ou gestor da empresa e abra **Laboratório → Numeração**. Defina o prefixo e carregue em **Guardar prefixo**. Sem configuração manual, o sistema sugere uma palavra curta a partir do nome da empresa; usa `LAB` quando não encontra uma palavra válida.

Mudar o prefixo aplica-se apenas às próximas referências e não reinicia a sequência. Por exemplo, depois de `ULTRA/120`, a próxima pode ser `LAB/121`. Não existe opção de reutilizar ou apagar números emitidos. A sequência cresce para `/1000` quando necessário.

## Histórico e rastreabilidade

- Os números antigos permanecem intactos, pesquisáveis e imprimíveis. A migração não renumera pacientes, pedidos, tubos ou documentos emitidos.
- Os números curtos já existentes são reservados para evitar reutilização; por exemplo, `ULTRA/1` também reserva a forma `ULTRA/001`.
- A pesquisa de pedidos aceita nome, processo, referência do pedido ou código da amostra. Os resultados prontos também podem ser encontrados pelas suas referências.
- A etiqueta mostra o código completo do tubo e codifica a mesma referência no QR, sem dados pessoais adicionais no QR. Nome e segundo identificador continuam na etiqueta para conferência.
- Os relatórios de resultados emitidos pelo circuito apresentam o pedido e a amostra associados ao resultado validado. Em resultados antigos sem essa ligação, a referência antiga do paciente é identificada como histórica.
- Recepção, enfermagem e aprovação de novos pacientes do portal usam a atribuição central do processo. Os dados clínicos continuam sujeitos às permissões da empresa.

As chaves técnicas internas mantêm-se; a referência curta é o código operacional. A referência, por si só, não concede acesso aos dados de um paciente nem permite pesquisar noutra instituição.

## Aplicar a actualização

Consulte [ACTUALIZAR_NETLIFY.md](ACTUALIZAR_NETLIFY.md). A mudança inclui a migração `20261103_lab_referencias_institucionais.sql`, a API e a interface. Ensaiar primeiro numa base de teste permite confirmar o comportamento com o histórico da instituição.

1. Aplique o código com a simulação do instalador e a opção correspondente à sua versão.
2. Execute `pnpm install --frozen-lockfile` e `pnpm db:migrate` no ambiente com acesso à base configurada.
3. Compile e publique a API actualizada; confirme `/api/readyz`.
4. Compile e publique a interface na Netlify.
5. Configure o prefixo na empresa de teste e confirme o circuito abaixo.

Esta entrega não executa uma migração na sua base Neon nem publica o site automaticamente.

## Conferência na instituição de teste

1. Registe um paciente novo. Confirme que aparece uma referência curta e que não é pedida digitação manual do processo.
2. Crie um pedido com um exame aprovado do catálogo institucional. Confirme as referências distintas do processo, pedido e tubo.
3. Pesquise o pedido pelas três referências e faça a leitura do QR da etiqueta.
4. Siga o circuito de colheita, recepção, processamento, revisão e autorização com os perfis habilitados. Confirme no relatório o código do tubo efectivamente usado.
5. Abra um registo antigo. Confirme que conserva o código anterior e que a pesquisa ainda o encontra.
6. Entre noutra empresa e confirme que as pesquisas não devolvem os registos da primeira.

A verificação automática inclui migrações numa base local de teste, isolamento institucional, preservação histórica, reenvio de pedidos, reversão de transacções, passagem para quatro dígitos e descodificação do QR da etiqueta. A impressão física e a leitura com o equipamento da instituição devem ser conferidas no ensaio acima.
