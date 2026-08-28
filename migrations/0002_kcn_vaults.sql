-- Sealed investigator vaults, one ciphertext blob per signed-in account.
-- The server stores AES-256-GCM ciphertext only. It cannot read the case.
create table if not exists kcn_vaults (
  user_id    text not null primary key,
  sealed     text not null,
  updated_at timestamptz not null default now()
);
