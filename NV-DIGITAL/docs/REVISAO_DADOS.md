# Registos anteriores com associação pendente

Na verificação de 27/10/2026, um resultado e uma factura do schema public tinham paciente_id preenchido, mas esse paciente já não existia na tabela de pacientes. Não foram encontradas referências a pacientes de outra empresa nesses dois casos.

Os registos foram preservados. As novas chaves estrangeiras usam NOT VALID para não apagar nem impedir a migração por causa do legado; validam novas relações/alterações. A aplicação filtra os registos sem uma associação válida nas listagens e disponibiliza ao administrador uma contagem dos itens retidos da sua própria instituição.

A correcção exige conferência documental pela instituição proprietária. Não mudar empresa_id, não criar pacientes fictícios e não associar por mera semelhança do nome. Confirmar a identidade, manter o número e os valores da factura e registar a rectificação administrativa com trilho de auditoria. Depois dessa revisão pode ser planeada a validação integral das constraints, que ainda não foi efectuada nesta entrega.

Os schemas de outras aplicações, incluindo xlbeans, não foram migrados, apagados nem fundidos com o processo clínico do NVUALASOFT.
