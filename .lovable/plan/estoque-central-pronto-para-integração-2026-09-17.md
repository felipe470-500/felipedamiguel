# Estoque central pronto para integração

## Diagnóstico do que existe hoje

Os 110 veículos cadastrados têm apenas os campos antigos de texto livre
(`nome`, `ano`, `km`, `preço`, `tag`, `fotos`, `placa`, `descrição`).
Os campos estruturados já existem no banco, mas estão **todos vazios**:
marca, modelo, versão, ano de fabricação, ano do modelo, preço em centavos,
quilometragem, cor, combustível, câmbio, portas, chassi, localização.

Por isso o veículo 017 retornou "Marca não preenchida; Modelo não preenchido;
Ano não preenchido". A validação está certa — falta o cadastro estruturado,
a tela para preenchê-lo e os dados da loja.

### Já existe
Marca, modelo, versão, ano de fabricação, ano do modelo, quilometragem,
preço, cor, combustível, câmbio, portas, placa, chassi, descrição, status,
fotos e vídeos (tabela de mídia), opcionais (tabela de itens do veículo).

### Falta criar
- Carroceria (sedã, hatch, SUV, picape…) no veículo.
- Ficha completa da loja: razão social, CNPJ, telefone, WhatsApp, e-mail,
  CEP, endereço, número, bairro, cidade, estado, país, latitude, longitude.
- Registro de requisitos por plataforma (o "checklist de integração").
- Preenchimento dos campos estruturados dos 110 veículos atuais.

### Precisa mudar
O painel de veículos hoje só edita texto livre. Passa a editar a ficha
completa e a mostrar o que falta.

## O que será construído

### 1. Ficha da loja
Nova tela **Configurações da loja** no painel, com todos os campos de
identificação, contato e endereço, incluindo latitude e longitude.
Os dados ficam ligados à loja e são usados automaticamente por qualquer
integração — nunca mais veículo por veículo.

### 2. Cadastro de veículo completo
A tela de edição ganha os campos estruturados: marca, modelo, versão,
ano de fabricação, ano do modelo, quilometragem, preço, cor, combustível,
câmbio, carroceria, portas, opcionais, descrição, fotos, vídeos e status.
Combustível, câmbio, carroceria e cor viram listas de opções padronizadas,
para não gerar variações de escrita que quebram as plataformas.

### 3. Validador central (vale para todas as plataformas)
Um único motor de validação:

```text
ESTOQUE CENTRAL -> VALIDADOR -> REGRAS DA PLATAFORMA -> CONECTOR -> API
```

- **Regras gerais**: campos mínimos do estoque (marca, modelo, ano, preço,
  km, fotos, status).
- **Regras por plataforma**: cada conector declara sua própria lista, com
  requisitos do veículo e requisitos da loja.
- O Mercado Livre passa a ser só o primeiro conjunto de regras registrado;
  Na Pista, OLX, Webmotors etc. entram depois sem mexer no motor.

Ao salvar ou editar, se faltar algo o painel mostra:

```text
Este veículo não está pronto para integração.
Faltando:
  Marca
  Modelo
  Ano
  Fotos  (ok)
```

### 4. Painel de prontidão
Em cada veículo, um bloco por plataforma:

```text
FIAT STRADA 2023
Mercado Livre   Pronto
Na Pista        Faltam informações
Apisa           Não configurado
```

Clicando na plataforma, a lista exata de pendências (do veículo e da loja).
Na página do Mercado Livre, a lista de veículos passa a mostrar
"Pronto para publicação" / "Pendências" com o detalhe.

### 5. Bloqueio antes do envio
O envio para a API só acontece depois do validador aprovar. Se faltar
qualquer requisito, nada é enviado e o usuário vê exatamente o que corrigir.
O botão de sincronizar fica desativado enquanto houver pendência.

### 6. Mapeamento explícito
O conector do Mercado Livre passa a ter uma tabela de correspondência
declarada (nosso campo -> campo exigido pela plataforma, com conversão de
valores como combustível e câmbio), em vez de montagem espalhada no código.

### 7. Preenchimento dos veículos atuais
Um passo de migração tenta deduzir marca, modelo, ano, quilometragem e preço
a partir do texto já cadastrado dos 110 veículos, sem apagar nada. O que não
for deduzido com segurança aparece como pendência no painel de prontidão,
para revisão manual.

## Detalhes técnicos

- Migração: coluna `body_type` em `vehicles`; nova tabela `store_profiles`
  (1:1 com `stores`) com identificação, contato e endereço/geo, com GRANT e
  RLS por `has_store_role`; tabela `platform_requirements` (ou definição em
  código versionada por conector) para o checklist; backfill dos campos
  canônicos a partir de `name/year/km/price`.
- `src/lib/integrator/validation.ts`: tipos `RequirementCheck`,
  `ReadinessReport`, motor genérico `evaluateReadiness(vehicle, store, rules)`.
- Cada conector exporta `requirements` (veículo + loja) e um `fieldMap`;
  `mercadolivre/mapping.ts` migra para esse formato e
  `validateForMercadoLivre` passa a derivar das regras.
- `service.server.ts` roda `evaluateReadiness` antes de qualquer chamada HTTP
  e devolve as pendências estruturadas.
- Novas server functions: `getStoreProfileFn` / `saveStoreProfileFn` e
  `getVehiclesReadinessFn`; rota `/_authenticated/configuracoes-loja`.
- Painel `/admin`: formulário de veículo estendido + bloco de prontidão.
