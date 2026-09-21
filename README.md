# Diário

App de alimentação, água e hábitos. Você cadastra os alimentos uma vez com as calorias
por porção; depois basta informar a quantidade e o app faz a conta.

Feito para funcionar bem no celular e no tablet, com instalação na tela de início (PWA).

---

## O que tem dentro

- **Diário do dia** por refeição, com cálculo automático a partir da medida base
  (100 g, 100 ml ou unidade). Registrar 170 g de um frango de 159 kcal/100 g grava 270 kcal.
- **Alimentos** com nome, marca, medida base, calorias, carboidrato, proteína, gordura e fibra.
  Favoritos e busca sem acento.
- **Registro por unidade**: com a medida caseira cadastrada (1 ovo = 50 g, 1 biscoito = 7,5 g),
  basta tocar `+` três vezes para anotar 3 ovos, sem pesar.
- **Sugestões por refeição**: ao abrir o café da manhã, aparece o que ela costuma comer
  nele, já com a quantidade de sempre. O `+` anota na hora e a folha continua aberta.
- **Cores por refeição** no resumo do dia, nas seções e na escolha da refeição.
- **Temas**: Verde, Oceano, Rosa, Escuro e Automático (acompanha o modo do celular).
- **Fibra** com meta própria, somada junto dos outros nutrientes.
- **Água** em copos de 250 ml.
- **Hábitos** com dias da semana escolhidos, marcação diária e sequência de dias seguidos.
- **Peso** com gráfico de evolução e IMC de referência.
- **Meta de peso sem prazo**: o progresso usa a tendência (média móvel), não a pesagem do dia,
  e o app estima quando ela chega lá pelo ritmo real das últimas semanas. Avisos discretos se a
  meta ficar abaixo de IMC 18,5 ou se a perda passar de 1% do peso por semana.
- **Humor e anotação** do dia.
- **Progresso** em 7, 14 ou 30 dias: calorias por dia contra a meta, médias e conclusão dos hábitos.
- **Metas** escritas na mão ou sugeridas pela equação de Mifflin-St Jeor.
- **Trazer de outro dia**: abre qualquer dia anterior e deixa escolher item por item
  o que repetir, em vez de copiar o dia inteiro.
- **Corrigir ou remover** qualquer item comido: toque nele na lista do dia para mudar a
  quantidade, trocar de refeição ou apagar.
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

## Publicar (leva uns 10 minutos)

### 1. Criar o banco no Neon

1. Entre em <https://neon.tech> e crie um projeto. Escolha a região mais perto (`South America (São Paulo)`).
2. Em **SQL Editor**, cole todo o conteúdo de `db/schema.sql` e execute.
   Em bancos que já estavam rodando, aplique as migrações que ainda não rodou, **nesta ordem**:
   `db/migracao-fibra.sql`, `db/migracao-porcoes.sql` e `db/migracao-meta-peso.sql`.
   Todas podem ser rodadas de novo sem causar problema.
3. Em **Connection string**, copie a opção **Pooled connection**. Ela se parece com:

   ```
   postgresql://usuario:senha@ep-xxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```

   Use a versão *pooler*: é a indicada para funções serverless.

### 2. Subir o código para o GitHub

```bash
git init
git add .
git commit -m "primeira versão"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/diario.git
git push -u origin main
```

### 3. Publicar na Vercel

1. Em <https://vercel.com>, clique em **Add New → Project** e importe o repositório.
2. O framework é detectado como Vite. Não precisa mexer em build nem em output.
3. Em **Environment Variables**, cadastre as três:

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | a string do Neon copiada no passo 1 |
   | `JWT_SECRET` | uma frase longa e aleatória (veja abaixo) |
   | `TZ_OFFSET` | `-3` |

   Para gerar o segredo:

   ```bash
   openssl rand -base64 48
   ```

4. Clique em **Deploy**. Ao terminar, abra o endereço, crie a conta e pronto.

Para conferir se a API subiu, abra `https://seu-app.vercel.app/api/health`.
A resposta deve ser `{"ok":true,"db":true}`.

### 4. Instalar no celular e no tablet

- **Android/Chrome**: abra o site, menu ⋮ → *Adicionar à tela inicial*.
- **iPhone/iPad/Safari**: botão de compartilhar → *Adicionar à Tela de Início*.

Instalado, abre em tela cheia, sem barra de navegador, com ícone próprio.

---

## Rodar na sua máquina

```bash
npm install
cp .env.example .env    # preencha DATABASE_URL e JWT_SECRET
npm run dev
```

Arquivos em `api/` que começam com `_` (como `_local.js` e `_peso.js`) não são publicados como
endpoints pela Vercel — é assim que ficam de fora módulos auxiliares.

Sobe a API em `http://localhost:3001` e o app em `http://localhost:5173`, já com o
encaminhamento de `/api` configurado. Como o Vite está com `host: true`, dá para abrir
pelo celular na mesma rede usando o IP da sua máquina, por exemplo `http://192.168.0.10:5173`.

### Testes da API

```bash
npm install --no-save @electric-sql/pglite
node test/run.mjs
```

```bash
node test/migracao.mjs   # confere as migrações em sequência sobre um banco no formato original
node test/peso.mjs       # lógica de tendência, ritmo e estimativa da meta de peso
```

Sobe um Postgres de verdade em WebAssembly, aplica o `schema.sql` e roda 100 verificações:
cálculo proporcional das porções, edição e remoção de registros, isolamento entre contas,
hábitos, água, peso e as regras de segurança do login. Não precisa de banco externo.

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
não gera nenhum alerta vermelho no app — a tela fica neutra, de propósito.

**Temas e cores.** Cada tema é um bloco de variáveis em `src/index.css`. Para criar um novo,
copie um bloco `[data-theme='...']`, ajuste os valores RGB e acrescente a opção em
`src/lib/theme.js`. Evite nomes de cor que colidam com utilitários do Tailwind
(`base`, `sm`, `lg`, `full`) — já custou um bug aqui.

---

## Aviso

As metas calculadas aqui são estimativas para orientar o dia a dia. Não substituem
acompanhamento de nutricionista ou médico.
