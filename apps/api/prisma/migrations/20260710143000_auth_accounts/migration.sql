CREATE TABLE auth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  provider_email text,
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_accounts_provider_provider_subject_key UNIQUE (provider, provider_subject)
);

CREATE INDEX auth_accounts_user_id_idx ON auth_accounts(user_id);
