# Matriz de preparação — não é certificado de conformidade

Data: 03/11/2026, revisão 2. Âmbito: facturação nativa NVUALASOFT, homologação FE 2.0 e SAF-T(AO) de facturação 1.01_01. Os testes usam empresas fictícias, chaves temporárias e respostas HTTP controladas. Não foram usados dados clínicos reais nem efectuados envios à AGT.

| Requisito / circuito | Implementação e evidência local | Condição externa ou limite |
|---|---|---|
| Identificação do produtor | Assistente local, minutas, dados Modelo 8 e manifesto público | Preencher os dados verdadeiros, confirmar titularidade e poderes; formulário oficial e assinatura do representante |
| Par de chaves do produtor | FE RSA 4096/RS256 e chave legada SAF-T separada; permissões privadas; recusa de sobreposição | Comunicar/registar as chaves públicas e respectivas versões; guardar cópia privada |
| Chave e NIF do contribuinte | Mapa por UUID/NIF, chave distinta da do produtor e bloqueio de NIF divergente | Obtenção da chave/credenciais segundo procedimento da AGT |
| Autenticação e transporte | Basic Auth, TLS, destino HML fixo, sem redireccionamentos, limite de resposta e timeout | Confirmar atribuição e validade das credenciais de homologação |
| Isolamento por empresa | Perfis, séries, pedidos, consultas, auditoria e XML filtrados pelo UUID autenticado; testes A/B | Requer controlo das credenciais da própria instalação; sem certificação de segurança externa |
| Numeração | Só séries confirmadas, reserva atómica, limites/ano e recusa de reenvio | Aceitação da série/estabelecimento pela AGT; contingência de produção fora do âmbito |
| Assinatura FE | JWS RS256 do software e documento, incluindo os totais; testes de alteração e chave errada | Ensaio de interoperabilidade com a AGT ainda não executado |
| Arredondamento | Política FE 2.0 explícita, base crédito truncada, débito por excesso, IVA por excesso, descontos em cêntimos; preview/seguro alinhados | Créditos com quantidades fraccionárias continuam sujeitos ao limite da factura original; casos de divergência de 1 cêntimo ficam bloqueados, para não creditar além da origem |
| Tipos nativos | FT, FR, FG, NC e RG; PF em documentos de conferência do SAF-T | Não cria tipos de negócio adicionais como autofacturação, adiantamentos ou documentos de transporte |
| Recibos | Origem da mesma empresa, repartição base/IVA congelada e SAF-T de recebimentos. Recibo parcial local imprimível e diagnóstico JSON separado com os totais originais e o rateio local | Envio FE de recibos parciais bloqueado até confirmação da regra de totais de origem com a AGT |
| Recepção/validação AGT | Pedido recebido separado de validação; correspondência de requestID, NIF, todos os números e estados | HTTP 200 sem resultado conclusivo não é aceitação fiscal |
| Falhas de rede | Pedido imutável guardado antes do HTTP, envio único, consulta e reconciliação sem reenvio | Consulta 2.0 aceita apenas um resultado válido que coincida com os dados assinados. Penalização, anulação ou divergência ficam para confirmação; não reenvia automaticamente |
| Rejeição/correcção | FT em aberto e sem seguro: original preservado, novo número, correcção de nome/NIF/morada, mesma conta, `documentStatus=C` com `rejectedDocumentNo`. Sem reenvio ou pagamento automático | Exige rejeição confirmada por documento. Duplicados, respostas inconclusivas, facturas já pagas ou com seguro e correcções de linhas/valores ficam para análise. Falta ensaio externo |
| Serviços de consulta | Obter estado, consultar factura, listar séries e listar facturas preparados/assinados | Respostas efectivas e permissões dependem da AGT |
| Confirmação pelo adquirente | Contrato da tabela de parâmetros 2.0: C/R, AD/ND/LD e linhas; assinatura NIF + número | A página oficial contém um exemplo diferente (percentagens globais). Confirmar contrato activo com a AGT antes de ensaiar este serviço; não assumir equivalência |
| SAF-T | XML 1.01_01 de facturação, XSD fixado por SHA-256, validação offline, sem entidades externas; testes FT/FR/FG/NC/PF/RC | Confirmar XSD e aceitação pela AGT; sem contabilidade geral/inventário. Bloqueia períodos com substituições até confirmar como reportar o original e a substituta |
| Assinatura SAF-T | Hash encadeado RSA1024/SHA1 de novos documentos configurados; anteriores não reescritos | Não se confunde com JWS RS256; exportações sem assinatura são ensaio com advertências |
| Impressão | A4/58/80 mm, indicação de ensaio, estado HML, identificação de chave e quatro caracteres da assinatura de ensaio; NC apresenta valores absolutos | Não imprime uma certificação presumida; validação física e aprovação do modelo pela AGT pendentes |
| QR fiscal | Diagnóstico da URL oficial e PNG 350×350 descodificado em teste, com versão suficiente, UTF-8 byte e M. QR e barras internos conservados na impressão | A URL excede a capacidade da versão 4/M. O PNG de ensaio não tem logótipo e não entra na impressão; confirmar a versão e o logótipo do QR fiscal com a AGT |
| Produção | Bloqueada no servidor e sem destino de produção configurável | Só poderá ser desenvolvida/activada após resolver as pendências e obter a certificação/adesão aplicáveis |

Não assinar uma declaração de conformidade integral a partir desta matriz. O pacote entrega código de preparação e homologação com testes locais; a conclusão da certificação exige resolver os pontos pendentes, ensaiar no serviço real de homologação e obter a decisão da AGT.
