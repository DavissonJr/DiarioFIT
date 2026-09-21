-- Diário — schema completo (Postgres / Neon)
-- Rode este arquivo uma única vez no SQL Editor do Neon.

create table if not exists users (
  id             serial primary key,
  name           text not null,
  email          text not null unique,
  password_hash  text not null,
  sex            text default 'f',
  birth_year     int,
  height_cm      numeric,
  activity       text default 'moderada',
  goal           text default 'manter',
  target_kcal    int  default 2000,
  target_protein int  default 110,
  target_carbs   int  default 230,
  target_fat     int  default 65,
  target_fiber   int  default 25,
  target_water   int  default 2000,
  created_at     timestamptz default now()
);

-- Alimentos cadastrados pela pessoa: valores nutricionais por "base_qty unit"
-- ex.: 100 g de frango = 159 kcal   |   1 un de ovo = 74 kcal
create table if not exists foods (
  id        serial primary key,
  user_id   int not null references users(id) on delete cascade,
  name      text not null,
  brand     text,
  base_qty  numeric not null default 100,
  unit      text not null default 'g',
  kcal      numeric not null default 0,
  protein   numeric not null default 0,
  carbs     numeric not null default 0,
  fat       numeric not null default 0,
  fiber     numeric not null default 0,
  portion_qty   numeric,   -- medida caseira opcional: 1 "portion_label" = portion_qty g/ml
  portion_label text,
  favorite  boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists foods_user_idx on foods(user_id, name);

-- Registro do dia. Guarda uma "fotografia" dos valores no momento do registro,
-- então editar ou apagar um alimento nunca altera o histórico.
create table if not exists entries (
  id       serial primary key,
  user_id  int  not null references users(id) on delete cascade,
  food_id  int  references foods(id) on delete set null,
  date     date not null,
  meal     text not null default 'almoco',
  quantity numeric not null,
  name     text not null,
  unit     text not null default 'g',
  kcal     numeric not null default 0,
  protein  numeric not null default 0,
  carbs    numeric not null default 0,
  fat      numeric not null default 0,
  fiber    numeric not null default 0,
  portions      numeric,   -- quantas medidas caseiras, quando registrado por unidade
  portion_label text,
  created_at timestamptz default now()
);
create index if not exists entries_user_date_idx on entries(user_id, date);

create table if not exists habits (
  id       serial primary key,
  user_id  int  not null references users(id) on delete cascade,
  name     text not null,
  icon     text default 'check',
  weekdays text not null default '0123456', -- 0 = domingo
  archived boolean not null default false,
  position int not null default 0,
  created_at timestamptz default now()
);

create table if not exists habit_logs (
  id       serial primary key,
  user_id  int  not null references users(id) on delete cascade,
  habit_id int  not null references habits(id) on delete cascade,
  date     date not null,
  unique (habit_id, date)
);
create index if not exists habit_logs_user_date_idx on habit_logs(user_id, date);

create table if not exists water_logs (
  user_id int  not null references users(id) on delete cascade,
  date    date not null,
  ml      int  not null default 0,
  primary key (user_id, date)
);

create table if not exists weights (
  user_id   int  not null references users(id) on delete cascade,
  date      date not null,
  weight_kg numeric not null,
  primary key (user_id, date)
);

create table if not exists notes (
  user_id int  not null references users(id) on delete cascade,
  date    date not null,
  mood    text,
  body    text,
  primary key (user_id, date)
);

-- Acelera as sugestões por refeição.
create index if not exists entries_user_meal_idx on entries(user_id, meal, date);
