-- 🔎 1. Garante que a tabela de origem existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'app_users'
    ) THEN
        RAISE EXCEPTION 'Tabela app_users não existe';
    END IF;
END $$;

-- 🚫 2. Garante que não existe tabela profiles
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
    ) THEN
        RAISE EXCEPTION 'Tabela profiles já existe';
    END IF;
END $$;

-- 🔁 3. Renomeia a tabela
ALTER TABLE public.app_users RENAME TO profiles;