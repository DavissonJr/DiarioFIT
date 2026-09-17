# Diário

App de alimentação, água e hábitos. Você cadastra os alimentos uma vez com as calorias
por porção; depois basta informar a quantidade e o app faz a conta.

Feito para funcionar bem no celular e no tablet, com instalação na tela de início (PWA).

---

## O que tem dentro

- **Diário do dia** por refeição, com cálculo automático a partir da medida base
  (100 g, 100 ml ou unidade). Registrar 170 g de um frango de 159 kcal/100 g grava 270 kcal.
- **Alimentos** com nome, marca, medida base, calorias, proteína, carboidrato, gordura e fibra.
  Favoritos e busca sem acento.
- **Água** em copos de 250 ml.
- **Hábitos** com dias da semana escolhidos, marcação diária e sequência de dias seguidos.
- **Peso** com gráfico de evolução e IMC de referência.
- **Humor e anotação** do dia.
- **Progresso** em 7, 14 ou 30 dias: calorias por dia contra a meta, médias e conclusão dos hábitos.
- **Metas** escritas na mão ou sugeridas pela equação de Mifflin-St Jeor.
- **Repetir ontem**, para quando a rotina se repete.
- Conta protegida por **JWT** (bcrypt, token de 60 dias). Cada conta só enxerga os próprios dados.
- Ao criar a conta, já vêm **22 alimentos brasileiros** e **5 hábitos** cadastrados.

---

## Como está montado

Tudo em um repositório só, publicado como um único projeto na Vercel:

```
api/index.js      API em Express, roda como função serverless da Vercel
src/              App em React + Vite
db/schema.sql     Tabelas do Postgres
```

Front e API saem do mesmo domínio, então não existe configuração de CORS para acertar.

| Camada | Serviço | Plano |
|---|---|---|
| Front + API | Vercel | gratuito |
| Banco | Neon (Postgres) | gratuito |

---

## Detalhes que podem te interessar

**Fotografia dos valores.** Cada registro do diário guarda as calorias e os macros já
calculados. Editar ou apagar um alimento depois não muda nada no histórico — isso está
coberto por teste.

**Fuso horário.** A Vercel roda em UTC. Sem tratamento, depois das 21h no Brasil o
servidor já estaria no dia seguinte e os registros cairiam na data errada. O `TZ_OFFSET`
resolve isso; o front sempre manda a data local junto.

**Piso calórico.** A sugestão de metas nunca desce abaixo de 1200 kcal nem abaixo do
metabolismo basal estimado, e o servidor recusa metas abaixo de 1000 kcal. Passar da meta
não gera nenhum alerta vermelho no app, a tela fica neutra, de propósito.

**Trocar o idioma dos textos, cores ou fontes.** As cores e as fontes estão todas em
`tailwind.config.js`. Os textos ficam nos próprios componentes, em português.

---

## Aviso

As metas calculadas aqui são estimativas para orientar o dia a dia. Não substituem
acompanhamento de nutricionista ou médico.
