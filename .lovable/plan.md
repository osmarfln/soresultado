Para aprimorar as previsões e estatísticas com base nos 10 últimos sorteios e análises de somas, centenas e dezenas atrasadas, farei as seguintes alterações:

### 1. Atualização da Edge Function `predict-bicho`
Vou modificar o motor de análise para:
- **Análise dos 10 Últimos Jogos**: Calcular especificamente a frequência e o peso dos resultados mais recentes (últimos 10 sorteios) para identificar o "momento" de cada grupo.
- **Cálculo de Somas**: Implementar a extração da soma dos resultados de cada sorteio (soma das milhares do 1º ao 5º prêmio) para identificar padrões de soma e sugerir centenas com base nesses ciclos.
- **Estatísticas Transversais**: Adicionar a capacidade de analisar todas as loterias simultaneamente para identificar os grupos e dezenas mais atrasados globalmente na plataforma.
- **Refinamento de Centenas**: Melhorar o algoritmo de sugestão de centenas usando a "soma dos resultados" e o histórico de dezenas atrasadas.

### 2. Melhoria da Interface de Previsões (`src/pages/Previsoes.tsx`)
- Adicionar uma seção de "Análise Global" que mostra o que está mais atrasado em todas as loterias cadastradas.
- Exibir a "Soma dos Resultados" recente e como ela influencia as próximas centenas sugeridas.

### 3. Melhoria na Lógica de "Grupos Fortes"
- Implementar um "Índice de Força" que combina:
  - Frequência histórica total.
  - Frequência nos últimos 10 sorteios (peso maior).
  - Posição (1º prêmio tem peso extra).
  - Soma das dezenas associadas.

### Detalhes Técnicos
- **Edge Function**: Usarei `Array.reduce` para calcular somas e mapear ocorrências específicas nos últimos 10 registros de cada tabela (`draw_results`, `capital_results`, `sp_results`, `federal_results`).
- **Cálculo de Atraso**: O atraso será medido pelo número de sorteios desde a última aparição de cada dezena (00-99) e centena (extraída das milhares).

Vou começar atualizando o código da Edge Function para processar esses novos dados estatísticos.
