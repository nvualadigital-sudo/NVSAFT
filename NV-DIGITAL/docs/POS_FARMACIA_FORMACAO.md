# POS e balcão da Farmácia — formação

O POS em **Financeiro → Facturamento → POS** calcula o desconto e o IVA com a mesma regra de arredondamento usada pelo servidor. O desconto fixo em Kz faz parte do pedido de emissão. A impressão automática do talão e os botões **Talão** e **A4** usam a mesma reserva no servidor para identificar original e segunda via.

## Ensaio no balcão da Farmácia

1. Use uma empresa e um paciente de teste. Em **Médicos → Prescrições**, crie uma receita activa com o medicamento identificado pela apresentação e pela concentração. Em **Farmácia → Produtos e lotes**, prepare um lote de teste com o mesmo nome, validade futura, stock disponível e preço de venda.
2. Em **Farmácia → Balcão POS**, abra o caixa de ensaio e prepare o saldo de ensaio do lote. A quantidade inicial não pode ultrapassar o saldo disponível na Farmácia. Cada lote tem uma inicialização.
3. Seleccione a receita, o medicamento, o lote e a quantidade. Pode usar mais de um lote desde que o total respeite o saldo da receita e de cada lote. Introduza o desconto em Kz e use **Conferir total**.
4. Confira nome, concentração, apresentação, validade e quantidade. Introduza o numerário de ensaio ou uma referência fictícia do TPA/banco. Seleccione o papel e conclua. A factura-recibo e a saída de stock de ensaio são guardadas juntas. A reimpressão fica em **Minhas vendas de formação**.
5. Compare o saldo de ensaio com o stock clínico em **Produtos e lotes**. Só o saldo de ensaio deve ter diminuído. Feche o caixa de ensaio após contar o numerário simulado. Diferenças para operadores de Farmácia usam a aprovação já existente por gestor.

Apenas administrador, gestor e farmacêutico podem operar este balcão, com acesso restrito à própria empresa. O perfil de farmacêutico não recebe acesso à Facturação geral. O caixa de formação da Farmácia usa um terminal reservado, separado do caixa geral do mesmo operador. Feche um caixa antes de abrir outro.

O exercício não regista entrega clínica, não desconta existências reais e não envia à AGT. Os documentos deste balcão não entram na exportação SAF-T de homologação. A taxa de IVA usada aqui é a taxa de ensaio configurada na instituição. O TPA e a transferência são registados manualmente; o sistema não comunica com o banco. A devolução com acerto de caixa e stock e a persistência de carrinhos pausados do POS geral ficam fora desta revisão.
