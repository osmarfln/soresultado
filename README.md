# soresultados

# PRD ESTRUTURADO - PLATAFORMA "JOGOS ONLINE"

## 1. Visão Geral

A plataforma "Jogos Online" é uma solução tecnológica abrangente e automatizada para coleta, validação, publicação e distribuição em tempo real dos resultados oficiais do Jogo do Bicho do Rio de Janeiro (PT-Rio). O sistema foi projetado desde sua arquitetura fundamental para resolver problemas críticos de confiabilidade, velocidade e acessibilidade que afetam milhões de usuários diários no Brasil. Atualmente, apostadores, desenvolvedores de aplicativos e portais de apostas enfrentam dispersão de informações, fontes não confiáveis que frequentemente publicam dados inconsistentes ou atrasados, falta de um histórico estruturado e consultável, e ausência de uma interface programática (API) padronizada para integração automatizada. Essa fragmentação gera incerteza, perda de oportunidades e dependência de processos manuais suscetíveis a erros.

A solução proposta ataca esses problemas através de uma arquitetura multicamada robusta. No núcleo, um sistema de robôs coletores paralelos em Python, executando de forma assíncrona, vasculha simultaneamente mais de 10 fontes primárias e secundárias de resultados a cada sorteio. Os dados extraídos passam por um rigoroso processo de validação cruzada, onde um resultado só é confirmado e persistido no banco de dados histórico PostgreSQL após coincidência entre múltiplas fontes independentes, garantindo precisão absoluta. Imediatamente após a validação, um backend em Node.js expõe os dados através de uma API RESTful, enquanto um frontend moderno em Next.js e React atualiza a interface do usuário em tempo real via WebSocket, apresentando os resultados em um portal web otimizado para SEO e experiência do usuário.

O público-alvo é diversificado e massivo. Inclui o **usuário final apostador**, que busca consultar resultados de forma rápida, confiável e em qualquer dispositivo; os **afiliados e portais de apostas**, que necessitam de um feed de dados validado para embasar seus serviços; e os **desenvolvedores e empresas de tecnologia**, que demandam uma API estável e documentada para criar aplicativos, integrações e análises secundárias. A dor principal de todos esses perfis é a falta de uma fonte única de verdade, automatizada e em tempo real.

Os principais diferenciais da plataforma são: **Validação por Consenso**, onde a confiabilidade é garantida pela concordância de múltiplas fontes, eliminando erros humanos ou de digitação; **Velocidade Sub-5s**, com robôs paralelos que coletam e publicam resultados em tempo quase real, superando a concorrência; **Infraestrutura Escalável**, projetada para lidar com centenas de milhares de visitas diárias através de CDN, cache Redis e balanceamento de carga; **SEO Massivo Estruturado**, com geração automática de milhares de páginas otimizadas (por data, horário, bicho) para dominar o tráfego orgânico de busca; e **Ecossistema Completo**, que vai além da simples exibição, oferecendo API pública, histórico completo e módulos avançados de estatística e análise de tendências para usuários avançados.

## 2. Funcionalidades

### 2.1 Perfis de Usuário e Acesso

| Perfil | Método de Registro | Permissões | Acessos e Recursos Principais |

|---|---|---|---|

| **Administrador do Sistema** | Convite direto via email corporativo. | Controle total (CRUD) sobre todos os módulos, dados e configurações. | Painel de administração completo, gestão de todos os usuários, configuração global dos robôs e fontes, auditoria de logs de sistema, acesso a todos os relatórios financeiros e de tráfego, gestão de segurança e backups. |

| **Gerente de Conteúdo/SEO** | Registro interno com aprovação de Admin. | Gerenciamento de conteúdo frontend, páginas e metadados. Sem acesso a robôs ou banco bruto. | Dashboard de performance de tráfego (Google Analytics, Search Console), editor de meta tags e títulos para páginas geradas, gestão de blogs ou artigos relacionados, módulo de estatísticas públicas. |

| **Desenvolvedor/Cliente API** | Autocadastro no portal com email e confirmação. Gera API Key. | Acesso somente-leitura aos endpoints públicos da API, dentro dos limites de rate estabelecidos. | Dashboard da API para monitorar uso e quotas, documentação interativa (Swagger/OpenAPI), gerenciamento de chaves de API, histórico de chamadas, acesso aos endpoints de resultados e histórico. |

| **Usuário Premium (Futuro)** | Upgrade via plano pago no site. | Acesso a estatísticas avançadas, alertas personalizados e dados históricos completos para download. | Painel com gráficos de frequência e atraso de bichos, ferramentas de análise de tendências, configuração de notificações por email/telegram para resultados, exportação de dados em CSV/JSON. |

| **Usuário Visitante (Público)** | Acesso livre, sem registro. | Acesso de leitura a todas as funcionalidades públicas do site. | Visualização dos resultados do dia e por horário, consulta ao histórico básico (últimos 30 dias), acesso às estatísticas básicas (mais sorteados do dia/mês), uso das ferramentas de busca e filtro simples. |

| **Robô/Sistema de Coleta** | Autenticação interna via token de serviço. | Permissão específica para escrita no banco de dados apenas na tabela de resultados brutos e logs de coleta. | Execução dos scripts de scraping agendados, acesso à lista configurada de URLs-fonte, permissão para inserir dados validados no banco de staging, registro de logs de sucesso/falha por fonte. |

### 2.2 Módulos do Sistema

1.  **Módulo de Coleta e Validação (Backend)**: Núcleo do sistema. Gerencia uma frota de 10+ robôs em Python (asyncio/aiohttp) que executam em paralelo. Agenda coletas nos 6 horários oficiais do PT-Rio, extrai dados de múltiplas fontes, aplica regras de validação cruzada e persiste apenas resultados confirmados. Inclui painel de monitoramento em tempo real do status de cada robô e fonte2.  **Módulo de Banco de Dados Histórico**: Base PostgreSQL otimizada para consultas rápidas. Armazena todos os resultados validados desde o início da operação, com tabelas para horários, resultados, logs de fontes e metadados. Suporta consultas complexas para estatísticas e histórico. Inclui jobs de backup automatizado e otimização.

3.  **Módulo de API Pública (Backend)**: Interface Node.js + Express que expõe os dados de forma segura e performática. Oferece endpoints RESTful para resultados atuais, históricos, por horário e estatísticas. Implementa rate limiting, cache Redis, documentação Swagger e autenticação via API Key para planos diferenciados.

4.  **Módulo do Portal Web (Frontend)**: Aplicação Next.js com React e Tailwind CSS. Apresenta os resultados de forma responsiva e instantânea (via WebSocket). Inclui páginas principais (home, horários, histórico) e milhares de páginas estáticas geradas para SEO (ex: `/resultado-pt-rio-14h-2024-03-11`).

5.  **Módulo de Administração (Backoffice)**: Painel seguro para administradores e gerentes. Permite gestão de usuários, configuração de fontes de coleta, visualização de logs do sistema, monitoramento de saúde da API e acesso a métricas de negócio (tráfego, performance de SEO).

6.  **Módulo de Estatísticas e Análises**: Processa o banco histórico para gerar insights. Mostra bichos e grupos mais sorteados por período, bichos mais atrasados, frequências, gráficos de tendência e heatmaps. Disponível em níveis diferentes para usuários visitantes e premium.

7.  **Módulo de SEO e Conteúdo Automático**: Sistema que gera e gerencia automaticamente o conteúdo estático do site. Cria páginas otimizadas para palavras-chave de alto volume, gerencia sitemaps XML, meta tags e estrutura de links internos para maximizar a visibilidade nos mecanismos de busca.

8.  **Módulo de Notificações em Tempo Real**: Serviço que propaga mudanças. Utiliza WebSocket para atualizar o frontend no momento exato da publicação de um novo resultado. Suporta (na versão premium) notificações por email, SMS ou Telegram baseadas em preferências do usuário.

9.  **Módulo de Monitoramento e Alertas**: Supervisiona a saúde de toda a plataforma. Monitora uptime dos robôs, latência da API, uso do banco de dados e tráfego. Dispara alertas (email, Slack) para a equipe em caso de falha na coleta, queda de fonte primária ou problemas de performance.

10. **Módulo de Segurança e Auditoria**: Controla o acesso e rastreia ações. Gerencia autenticação, autorização (RBAC), logs de acesso à API, logs de ações administrativas e proteção contra ataques comuns (DDoS, SQL injection) via configurações no API Gateway e CDN.

### 2.3 Páginas Principais da Interface

| Página | Módulo Principal | Descrição | Elementos-Chave da Interface |

|---|---|---|---|

| **Home / Resultado do Dia** | Portal Web | Página inicial com foco nos resultados mais recentes e acesso rápido. | Cabeçalho com navegação e busca, banner do último resultado confirmado, cards com os 6 horários do dia (com status "Aguardando", "Ao Vivo" ou "Concluído"), tabela resumo do dia, acesso rápido ao histórico e estatísticas. |

| **Detalhe do Horário (ex: PT 14h)** | Portal Web | Página dedicada a um sorteio específico, otimizada para SEO. | Título com data e horário, tabela detalhada com os 5 prêmios (milhar, grupo, bicho), contagem regressiva para o próximo sorteio, card com estatísticas daquele horário, gráfico de frequência dos bichos naquele horário. |

| **Histórico Completo** | Portal Web & Banco de Dados | Interface para consulta de resultados passados com filtros avançados. | Filtros por data (calendário), horário (dropdown), grupo/bicho (dropdown), tabela de resultados paginada, opção de exportar consulta (para premium), linha do tempo visual dos sorteios. |

| **Estatísticas Avançadas** | Módulo de Estatísticas | Painel com dados analíticos processados a partir do histórico. | Abas para "Bichos Mais Sorteados", "Bichos em Atraso", "Frequência por Grupo", gráficos de barra e pizza interativos, seletores de período (dia, semana, mês, ano, personalizado). |

| **Dashboard de Administração** | Módulo de Administração | Painel de controle interno para a equipe operacional. | Widgets com KPIs (visitas, sucesso da coleta, uso da API), gráfico de status dos robôs em tempo real, lista de alertas recentes, menu lateral para acessar gestão de usuários, fontes e logs. |

| **Documentação da API** | Módulo de API Pública | Portal para desenvolvedores integrarem com o sistema. | Documentação interativa com exemplos de código (cURL, JS, Python), playground para testar endpoints, área do cliente para gerenciar API Keys, status de saúde dos serviços. |

| **Página de Busca por Data** | SEO e Conteúdo Automático | Página estática gerada para cada data (ex: /11-03-2024). | Lista completa de todos os sorteios daquela data, tabelas consolidadas, meta tags específicas para a data, links para dias anterior e posterior. |

| **Página de Perfil do Usuário** | (Futuro - Premium) | Área do cliente para usuários registrados. | Informações da conta, configurações de notificação, histórico de acessos às estatísticas avançadas, gerenciamento da assinatura premium. |

| **Configuração de Fontes** | Módulo de Administração | Interface para gerenciar as URLs e prioridades dos sites fonte. | Lista de fontes primárias e secundárias com status de saúde, opção para adicionar/remover/editar URLs, configuração de timeout e prioridade de validação. |

| **Relatórios de Tráfego** | Módulo de Administração | Análise de audiência e performance de SEO. | Integração com Google Analytics/Search Console, gráficos de sessões, fontes de tráfego, palavras-chave de entrada, performance de páginas específicas. |

## 3. Processos e Fluxos de Trabalho

**Administrador do Sistema:**

1.  **Login:** Acesso ao backoffice via autenticação de dois fatores.

2.  **Dashboard de Controle:** Revisão imediata dos KPIs: status de todos os robôs (verde/amarelo/vermelho), volume de tráfego do dia, erros recentes na API, consumo de recursos do servidor.

3.  **Configuração do Sistema:** Navegação para o menu de configuração. Ajuste de parâmetros dos robôs (timeouts, user-agent), gestão da lista de fontes de coleta (adicionar nova fonte, desativar uma fonte problemática).

4.  **Gestão de Usuários:** Acesso à lista de usuários registrados (Gerentes e Devs). Aprovação de cadastros, reset de senhas, modificação de permissões ou revogação de acesso.

5.  **Relatórios e Auditoria:** Geração de relatórios personalizados: log completo de coletas de um período (para auditoria de precisão), relatório de uso da API por cliente, análise de tráfego e receita (futura).

6.  **Monitoramento de Segurança:** Revisão dos logs de acesso suspeitos, auditoria das ações administrativas realizadas por outros usuários, verificação do status dos backups automáticos do banco de dados.

7.  **Manutenção:** Execução de tarefas de manutenção programada (limpeza de cache, otimização de banco) fora do horário de pico.

**Gerente de Conteúdo/SEO:**

1.  **Login:** Acesso ao painel de gestão de conteúdo.

2.  **Dashboard de Performance:** Análise dos dados de SEO e tráfego: ranking para palavras-chave alvo, taxa de cliques no buscador, páginas com maior visibilidade.

3.  **Gestão de Conteúdo On-Page:** Edição dos templates de meta título e descrição para as páginas geradas automaticamente (ex: títulos das páginas de horário). Publicação de artigos ou dicas no blog integrado ao site.

4.  **Análise de Concorrência:** Uso de ferramentas integradas para monitorar a performance dos concorrentes diretos em termos de velocidade de publicação e posicionamento.

5.  **Otimização:** Sugestão e implementação de melhorias na estrutura de URLs internas, melhoria do conteúdo das páginas estáticas para aumentar a relevância.

6.  **Relatórios:** Geração de relatórios semanais/mensais de crescimento orgânico para apresentação à diretoria.

**Usuário Desenvolvedor (Cliente API):**

1.  **Cadastro/Login:** Criação de conta no portal público e confirmação por email.

2.  **Acesso à Área da API:** Navegação até a seção "Para Desenvolvedores".

3.  **Geração de Chave:** Criação de uma nova API Key no dashboard, definindo um nome para o projeto.

4.  **Consulta à Documentação:** Estudo dos endpoints disponíveis (`GET /api/v1/current`, `GET /api/v1/history`), dos parâmetros aceitos e dos limites de requisição (rate limit).

5.  **Teste no Playground:** Uso da interface interativa para fazer a primeira chamada à API, verificando o formato da resposta JSON.

6.  **Integração no Código:** Implementação da chamada HTTP no seu aplicativo ou site, utilizando a chave no header de autorização.

7.  **Monitoramento do Uso:** Acompanhamento, no próprio dashboard, do consumo de suas requisições para evitar atingir o limite e planejar um upgrade futuro se necessário.

**Usuário Visitante (Fluxo de Consulta):**

1.  **Acesso ao Site:** Entrada via busca no Google (ex: "resultado PT Rio 14h hoje") ou acesso direto.

2.  **Página Inicial:** Visualização do resultado mais recente em destaque. Identificação do próximo horário de sorteio com contagem regressiva.

3.  **Consulta Específica:** Clicar no card do horário de interesse (ex: "PT 14h") para ver os detalhes completos dos 5 prêmios.

4.  **Consulta Histórica:** Navegação para a página "Histórico", seleção de uma data passada no calendário e aplicação do filtro de horário.

5.  **Análise de Tendências:** Visita à página "Estatísticas" para ver quais bichos estão saindo com mais frequência no mês corrente.

6.  **Busca:** Uso da barra de busca no cabeçalho para encontrar rapidamente um resultado por data específica (ex: "10/03/2024").

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://soresultado.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a297fdd2-64b1-4c98-9363-2aa150c6b21a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
