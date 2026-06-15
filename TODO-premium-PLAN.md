# Plano detalhado (Premium + Home)

## 1) premium.tsx
- Remover “mock” do `mostSignedPlanId`.
- Criar uma query agregada em `premium_orders` para:
  - agrupar por `plan_id`
  - somar/contar pedidos com status relevante (confirmed + awaiting_proof)
  - retornar o plan com maior quantidade.
- Melhorar header:
  - mais impacto visual (gradientes/ícones)
  - copy mais persuasiva e focada em Roblox
- Melhorar cards:
  - hierarquia (preço grande, nome, descrição curta)
  - features com ícones
  - destaque do plano popular (badge + ring + pequeno selo)
  - “Garantia de liberação”/prazo junto do botão
- Melhorar seção de vantagens:
  - 2 colunas: “O que desbloqueia” e “Vantagens na Smiiley Store”
  - “Como funciona o PIX” como passo a passo

## 2) index.tsx
- Centralizar a query `home-ecosystem-stats` em um helper em `src/lib/`.
- Deixar `Home` mais legível mantendo o mesmo comportamento.

## 3) Validação
- Rodar build e garantir que não quebra tipagem.

