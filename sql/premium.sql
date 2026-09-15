-- ============================================================
-- ENMIIS — Aperçu IA, la fonctionnalité premium.
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
--
-- Les trois tables sont fermées : RLS active, aucune policy. La clé
-- publiable qui figure dans le code du navigateur ne peut donc rien y
-- lire ni y écrire. Seule api/preview.js, qui détient la clé
-- service_role côté serveur, y accède.
--
-- Ce point n'est pas décoratif : ces tables portent des portraits de
-- clientes. Une photo de visage est une donnée biométrique, et la
-- laisser lisible par une clé publique serait une faute.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Le droit d'accès, une ligne par cliente
-- ------------------------------------------------------------
create table if not exists premium_access (
  id              bigserial primary key,
  client_id       bigint not null references clients(id) on delete cascade,
  active          boolean not null default false,
  -- en_attente | valide | refuse
  payment_status  text not null default 'en_attente',
  -- Le nombre de générations encore dues. Une generation coute de
  -- l'argent reel : sans compteur, un seul compte pourrait vider le
  -- budget du mois en une soiree.
  credits         integer not null default 0,
  purchase_date   timestamptz,
  expiration_date timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (client_id)
);

-- ------------------------------------------------------------
-- 2. Les demandes de paiement, à valider à la main
-- ------------------------------------------------------------
create table if not exists premium_payments (
  id          bigserial primary key,
  client_id   bigint not null references clients(id) on delete cascade,
  -- Ce que la cliente recopie après son virement : les 4 derniers
  -- chiffres, un numéro de transaction, l'heure…
  reference   text not null default '',
  method      text not null default 'qr',
  amount      numeric(10, 2),
  currency    text not null default 'TND',
  -- en_attente | valide | refuse
  status      text not null default 'en_attente',
  note        text not null default '',
  admin_note  text not null default '',
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists premium_payments_status_idx
  on premium_payments (status, created_at desc);

-- ------------------------------------------------------------
-- 3. Les aperçus générés
-- ------------------------------------------------------------
create table if not exists ai_previews (
  id            bigserial primary key,
  client_id     bigint not null references clients(id) on delete cascade,
  -- en_cours | pret | echec
  status        text not null default 'en_cours',
  provider      text not null default '',
  model         text not null default '',
  -- Ce que la cliente avait dans son panier au moment de la
  -- génération : l'aperçu doit rester lisible même si elle vide son
  -- panier juste après.
  cart_snapshot jsonb not null default '{}'::jsonb,
  portrait_path text not null default '',
  result_path   text not null default '',
  error         text not null default '',
  cost_usd      numeric(10, 4),
  ms            integer,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists ai_previews_client_idx
  on ai_previews (client_id, created_at desc);
create index if not exists ai_previews_status_idx
  on ai_previews (status, created_at desc);

-- ------------------------------------------------------------
-- 4. Verrouillage
-- ------------------------------------------------------------
alter table premium_access   enable row level security;
alter table premium_payments enable row level security;
alter table ai_previews      enable row level security;
-- Aucune policy, volontairement : seule la clé service_role passe.

-- ------------------------------------------------------------
-- 5. Le dépôt des images
-- ------------------------------------------------------------
-- Bucket privé : les portraits ne doivent jamais être servis par une
-- URL devinable. api/preview.js délivre des liens signés de courte
-- durée, et eux seuls.
insert into storage.buckets (id, name, public)
values ('apercus-ia', 'apercus-ia', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 6. Effacement automatique des portraits
-- ------------------------------------------------------------
-- Un portrait n'a aucune raison d'être conservé indéfiniment. Cette
-- fonction efface les lignes de plus de 90 jours ; branchez-la sur un
-- cron Supabase (Database → Cron) ou appelez-la à la main.
--
-- Les fichiers du bucket sont effacés par api/preview.js quand la
-- cliente supprime un aperçu ; ce ménage-ci ne couvre que la base.
create or replace function purge_apercus_anciens(jours integer default 90)
returns integer
language plpgsql
as $$
declare
  efface integer;
begin
  delete from ai_previews
   where created_at < now() - (jours || ' days')::interval;
  get diagnostics efface = row_count;
  return efface;
end;
$$;
