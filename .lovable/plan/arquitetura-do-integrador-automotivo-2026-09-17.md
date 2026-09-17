# Arquitetura do Integrador Automotivo

## Decisões confirmadas
- Primeira entrega: motor do integrador + Mercado Livre como prova de conceito.
- Acesso da equipe: Google e e-mail/senha, com contas individuais.
- Transição: catálogo, fotos, leads, feed e links públicos atuais continuam funcionando.
- API própria: privada, consumida apenas pelo painel, trabalhadores da fila e conectores nesta fase.
- Princípio: um estoque canônico; cada plataforma é apenas um destino independente.

## A. Arquitetura completa

```text
Site público ─────┐
Painel da equipe ─┼──> Camada de aplicação / API privada v1
Automação interna ┘                 │
                                    ▼
                         Estoque central multiloja
                                    │
                     Transação + evento de saída (outbox)
                                    │
                                    ▼
                         Fila persistente de sincronização
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
   MercadoLivreConnector     NaPistaConnector       Outros conectores
              │                     │                     │
              ▼                     ▼                     ▼
       API Mercado Livre        API Na Pista           APIs oficiais
              │                     │                     │
              └──────────── webhooks / resultados ──────┘
                                    │
                                    ▼
                     IDs externos, status, logs e leads
```

### Camadas
1. **Domínio canônico:** empresas, lojas, usuários, veículos, mídias, leads e regras independentes de portais.
2. **Aplicação:** cadastro, alteração de status, publicação, sincronização e consulta de resultados.
3. **API privada v1:** contratos versionados e validados; nenhuma regra de portal dentro das rotas.
4. **Motor:** cria tarefas idempotentes por veículo, loja, plataforma e operação.
5. **Conectores:** autenticação, transformação e comunicação específicas de cada plataforma.
6. **Infraestrutura:** banco, armazenamento, criptografia, fila, agendador, webhooks, auditoria e observabilidade.

O projeto atual já oferece uma base útil, mas hoje possui estoque de uma loja, dados como preço/km/ano em texto, vendedor no código, senha administrativa global e gravação do catálogo inteiro de uma vez. A evolução será incremental, sem criar um segundo estoque concorrente.

## B. Fluxos principais

### Cadastro ou alteração
```text
Usuário autorizado
  → valida modelo canônico
  → grava veículo e revisão
  → grava eventos na outbox na mesma transação
  → confirma imediatamente ao usuário
  → processador cria um job por integração ativa
  → conector transforma o veículo
  → API externa
  → salva ID externo, status, resposta sanitizada e log
```

### Venda
```text
status interno = SOLD
  → evento VEHICLE_SOLD
  → para cada integração ativa:
      encerrar, pausar ou remover conforme capacidade oficial
  → plataforma sem operação comprovada: NEEDS_MANUAL_ACTION
```

### Webhook
```text
Plataforma → /api/public/webhooks/v1/{platform}
  → validar assinatura/origem oficial
  → persistir evento bruto com deduplicação
  → responder rapidamente
  → processar assíncrono
  → atualizar anúncio/lead/status
  → registrar auditoria
```

## C. Estrutura do banco de dados

### Identidade e multiloja
- `organizations`: empresa controladora.
- `stores`: lojas pertencentes a uma empresa; fuso, endereço e configurações.
- `profiles`: identidade exibível do usuário.
- `user_roles`: papel separado por usuário e loja (`admin`, `manager`, `seller`, `integration_operator`).
- RLS obrigatória por `organization_id`/`store_id`; nenhuma autorização baseada no navegador.

### Estoque canônico
- `vehicles`: UUID interno imutável, código curto por loja, `brand`, `model`, `version`, `manufacture_year`, `model_year`, `price_cents`, `mileage_km`, `color`, `fuel`, `transmission`, `doors`, `description`, `plate`, `vin`, `location_id`, `seller_id`, `status`, timestamps e versão otimista.
- `vehicle_features`: opcionais normalizados.
- `vehicle_media`: tipo, ordem, arquivo interno, checksum, dimensões/duração e estado de processamento.
- `vehicle_status_history`: histórico de disponível, reservado, vendido, arquivado.

O UUID atual será preservado. Campos legados (`name`, `year`, `km`, `price`, `images`) permanecerão durante a transição; serão preenchidos em paralelo até o catálogo público usar somente o modelo canônico.

### Integrações
- `platforms`: catálogo de plataformas e versão do conector.
- `store_integrations`: integração habilitada por loja, estado, capacidades e última verificação.
- `integration_credentials`: envelope criptografado, versão da chave, validade e identificação mascarada; nunca retornará o segredo ao navegador.
- `vehicle_integrations`: veículo interno + plataforma + ID externo + status + última sincronização + hash da versão enviada.
- `media_integrations`: mídia interna + plataforma + ID/URL externa + status.
- `sync_jobs`: fila persistente, operação, prioridade, tentativa, próxima execução, bloqueio e idempotency key.
- `sync_logs`: histórico imutável com duração, HTTP, resultado, erro sanitizado e correlation ID.
- `webhook_events`: payload recebido, deduplicação, validação, processamento e retenção.

### Leads
- Evoluir `leads` com `store_id`, `vehicle_id`, `platform_id`, `external_id`, contato, origem, status, responsável e timestamps.
- Deduplicação por plataforma + ID externo; dados pessoais com acesso restrito e política de retenção.

## D. Contrato dos conectores

```text
Connector
├── id / version / capabilities
├── validateConfiguration()
├── authorize() / refreshCredentials()
├── mapVehicle(canonicalVehicle)
├── create() / read() / update() / delete()
├── publish() / pause() / activate() / sync()
├── uploadPhoto() / uploadVideo()
├── normalizeError()
└── verifyAndParseWebhook()
```

Cada conector declara capacidades. Operações não comprovadas retornam `UNSUPPORTED`, sem simulação. Transformadores ficam versionados por plataforma, com testes de contrato e amostras oficiais anonimizadas.

## E. Modelo padrão do veículo
- IDs: UUID interno imutável e código sequencial apenas para exibição.
- Valores tipados: preço em centavos, km inteiro e anos inteiros; não usar texto formatado como fonte de verdade.
- Taxonomias: marca/modelo/versão e enums internos; códigos externos ficam em tabelas de mapeamento.
- Mídia: arquivos internos são a origem; URLs/IDs dos portais são derivados.
- Status internos: `DRAFT`, `AVAILABLE`, `RESERVED`, `SOLD`, `ARCHIVED`.
- Validação separa requisito interno de requisito de cada portal. Um campo ausente pode bloquear apenas um destino.

## F. Autenticação e credenciais
- Usuários entram por Google ou e-mail/senha; cada ação valida sessão, loja e papel no servidor.
- Credenciais das plataformas são criptografadas no backend com envelope encryption; a chave mestra fica no cofre seguro do ambiente e suporta rotação.
- O painel mostra somente estado, expiração e trechos mascarados. Alterar uma credencial exige nova digitação; a anterior nunca é revelada.
- OAuth usa `state` de uso único, PKCE quando suportado, callback público validado e tokens ligados à loja correta.
- Refresh tokens são renovados no servidor com controle de concorrência.
- Logs removem tokens, senhas, documentos e dados pessoais.
- A credencial da Na Pista enviada anteriormente no chat deve ser revogada/trocada antes do uso definitivo.

## G. Fila de sincronização
- Padrão **transactional outbox**: veículo e evento são gravados juntos, impedindo perda entre salvar e enfileirar.
- Um job por `store + vehicle + platform + operation + vehicle_version`.
- Locks com prazo evitam processamento duplo; idempotency key evita anúncio duplicado.
- Concorrência e limite são independentes por plataforma/loja.
- Backoff exponencial com jitter; respeitar `Retry-After`.
- `429`, `500`, `502`, `503`, `504` e falhas de rede: retentativa.
- `401`: uma tentativa de refresh; persistindo, integração bloqueada e alerta.
- `400` e `403`: erro definitivo, sem loop; exigir correção/autorização.
- Após o máximo de tentativas: dead-letter com botão de reprocessar.

## H. Logs e auditoria
- Log operacional: data, loja, veículo, plataforma, operação, tentativa, duração, HTTP e resultado.
- Auditoria: ator, ação, valores alterados, origem e correlation ID.
- Resposta externa armazenada de forma sanitizada e com retenção definida.
- Dashboard agrega contagens; logs completos possuem filtros por loja, veículo, plataforma e período.

## I. Tratamento de erros
- Categorias: `VALIDATION`, `AUTHENTICATION`, `AUTHORIZATION`, `RATE_LIMIT`, `TEMPORARY_PROVIDER`, `PERMANENT_PROVIDER`, `NETWORK`, `UNSUPPORTED`, `INTERNAL`.
- Mensagem amigável no painel + detalhe técnico sanitizado no log.
- Circuit breaker por plataforma evita avalanche quando um portal cai.
- Alertas para credencial vencida, backlog crescente, dead-letter e webhook inválido.
- Reconciliação periódica compara estado interno e externo quando a API permitir leitura.

## J. Informações necessárias por plataforma
Solicitar, sempre por canal seguro:
1. documentação oficial e versão; URL de produção e homologação;
2. contrato/comprovação comercial e código da loja/revenda;
3. mecanismo de autenticação e credenciais correspondentes;
4. redirect URIs, escopos OAuth e prazo dos tokens;
5. schemas de veículo, catálogos/taxonomias e campos obrigatórios;
6. contratos de fotos, vídeos, status, leads e webhooks;
7. rate limits, paginação, idempotência e códigos de erro;
8. assinatura de webhook e política de reentrega;
9. exigência de IP fixo/allowlist — se existir, será necessário contratar saída com IP estático;
10. sandbox, massa de testes, homologação, SLA, suporte, certificação e custos.

Para o Mercado Livre, serão necessários aplicativo de desenvolvedor, Client ID, Client Secret, redirect URI autorizada, conta vendedora apta à vertical de veículos, pacote comercial, autorização OAuth e usuários de teste. A documentação oficial confirma OAuth 2.0, renovação de token, recursos de veículos, perguntas/contatos e notificações: [tokens](https://developers.mercadolivre.com.br/pt_br/publicacao-de-produtos/obtencao-do-access-token), [categorias e atributos](https://developers.mercadolivre.com.br/pt_br/variacoes/categorias-e-atributos-veiculos), [localização](https://developers.mercadolivre.com.br/pt_br/variacoes/localizacao-de-veiculos), [contatos](https://developers.mercadolivre.com.br/pt_br/enderecos-do-usuario/automovel-gerenciamento-de-contatos), [notificações](https://developers.mercadolivre.com.br/en_us/users-addresses/products-receive-notifications) e [testes](https://developers.mercadolivre.com.br/en_us/users-addresses/start-testing).

## K. Matriz inicial de compatibilidade comprovada

| Plataforma | API/doc oficial | Auth | Publicar/atualizar | Fotos | Vídeos | Encerrar | Leads | Webhook |
|---|---|---|---|---|---|---|---|---|
| Mercado Livre | Sim | OAuth 2.0 + refresh | Parcialmente confirmado para veículos | Sim | NÃO CONFIRMADO BR | Parcial; contrato exato a validar | Sim | Sim |
| OLX | Sim | OAuth 2.0 | Sim | Sim | NÃO CONFIRMADO | Sim | NÃO CONFIRMADO | Sim |
| Webmotors | Sim | OAuth Client ID/Secret | Sim | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | Sim | NÃO CONFIRMADO |
| iCarros | Sim, parcial | OAuth 2.0 | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO |
| MobiAuto | Portal técnico existe, conteúdo restrito | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO |
| Na Pista | Não localizada publicamente | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO |
| Apisa | Não localizada | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO |
| Pialto | Não localizada | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO |
| Autoline | Não localizada publicamente | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO |

Fontes oficiais adicionais: [OLX Developers](https://developers.olx.com.br/anuncio/api/home.html), [Webmotors Developers](https://portal-webmotors.sensedia.com/api-portal/documentacao), [iCarros API](https://www.icarros.com.br/apidocs/) e [MobiAuto Open API](https://open-api.mobiauto.com.br/swagger-ui.html). Não serão criados conectores para itens `NÃO CONFIRMADO` sem documentação/contrato oficial fornecido pela plataforma.

## Certificação e homologação
- Mercado Livre possui programa regional de parceiros com critérios de qualidade e volume; a documentação regional localizada cita GMV mensal mínimo no Brasil, mas custos, número mínimo de clientes e uma certificação exclusiva da vertical de veículos permanecem **NÃO CONFIRMADOS**. Referências: [Central de Partners Brasil](https://centrodepartners.mercadolivre.com.br/) e [Developer Partner Program regional](https://developers.mercadolibre.com.co/developer-partner-program).
- OLX exige cadastro/liberação do aplicativo pelo canal de integradores.
- Webmotors exige relação comercial, aplicativo e processo de homologação.
- Para as demais, requisitos comerciais e técnicos permanecem `NÃO CONFIRMADO` até resposta oficial.

## Painel do integrador
- Visão geral: total, publicados, pendentes, erros, leads e plataformas conectadas.
- Estoque: cadastro canônico, mídia, qualidade dos dados e status por plataforma.
- Integrações: conexão, capacidades, validade da credencial e teste de saúde.
- Fila: pendentes, em processamento, retentativas e dead-letter.
- Logs: filtros e detalhe sanitizado.
- Leads: origem, veículo, responsável e estágio.

## API privada v1
- `POST/GET /api/v1/vehicles`
- `GET/PUT/DELETE /api/v1/vehicles/{id}`
- `POST /api/v1/vehicles/{id}/publish`
- `POST /api/v1/vehicles/{id}/sync`
- `GET /api/v1/vehicles/{id}/integrations`
- `GET /api/v1/integrations`
- `GET /api/v1/integrations/{platform}/status`

Todas exigem autenticação e escopo de loja. O painel usará funções internas tipadas sobre os mesmos serviços; não duplicaremos regras entre tela e API.

## Sequência de implementação aprovada para a fase 1
1. Criar identidade, empresas, lojas, papéis e isolamento por loja.
2. Evoluir o estoque existente para o modelo canônico, com migração compatível e revisão dos dados incompletos.
3. Criar serviços de domínio e API privada v1 com CRUD granular e controle de concorrência.
4. Implementar cofre criptografado de credenciais, auditoria e rotação.
5. Implementar interface de conectores e registro de capacidades.
6. Implementar outbox, fila persistente, retry, dead-letter e reconciliação.
7. Implementar logs, métricas e painel de integrações.
8. Implementar OAuth e conector Mercado Livre somente nos recursos confirmados oficialmente.
9. Validar com usuários de teste, depois homologar com uma conta comercial apta.
10. Migrar o catálogo público para leitura canônica e retirar campos legados apenas após comparação integral.

## Critérios de aceite da primeira fase
- Nenhuma interrupção ou quebra dos links/feed atuais.
- Isolamento comprovado entre lojas e papéis.
- Credenciais nunca aparecem em resposta, log ou navegador.
- Salvar veículo e criar evento é atômico; jobs não duplicam anúncios.
- Falhas temporárias são reprocessadas; falhas definitivas ficam acionáveis.
- Mercado Livre conecta por OAuth, renova token e sincroniza apenas operações oficialmente validadas.
- Dashboard e logs explicam o estado de cada veículo em cada plataforma.
- Testes cobrem mapeamento, idempotência, retry, RLS, webhook e migração dos dados atuais.

## Fora da primeira fase
- Conectores reais de Na Pista, Apisa, Pialto, MobiAuto, OLX, iCarros, Webmotors e Autoline.
- API para parceiros externos e emissão de chaves de terceiros.
- Certificação comercial das plataformas; o sistema será preparado, mas aprovação depende de cada empresa.