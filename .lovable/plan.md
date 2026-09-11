# Feed de estoque para AutoSíntese

## Objetivo
Entregar o estoque completo em `https://miguelveiculosfsa.com/feed/estoque.json`, no formato rígido aceito pelo CRM.

## Implementação
- Manter a resposta como um array JSON puro, pública, sem paginação e sem cache longo.
- Consultar os veículos no momento de cada requisição e responder HTTP 500 se a consulta falhar.
- Manter IDs estáveis e converter preço, quilometragem e anos para números.
- Enviar somente campos existentes ou inferidos com segurança; não inventar dados.
- Criar endereços permanentes de foto terminados em `.jpg`, sem token público, preservando a ordem do álbum.
- Servir os bytes da imagem por trás desse endereço estável, renovando internamente o acesso ao armazenamento quando necessário.

## Validação
- Confirmar HTTP 200 e `Content-Type: application/json` sem login.
- Confirmar que a resposta começa com `[` e contém o estoque inteiro.
- Confirmar que todos os valores são numéricos e não contêm `R$`.
- Abrir a primeira foto sem autenticação e confirmar resposta de imagem JPEG.
- Testar com identificação de navegador automatizado e verificar a compilação do site.
