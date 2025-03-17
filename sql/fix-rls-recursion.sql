-- Script para corrigir problema de recursão infinita nas políticas RLS
-- Execute este script no painel SQL do Supabase

-- 1. Desabilita RLS para a tabela users
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. Remove todas as políticas existentes para users
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.users;
DROP POLICY IF EXISTS "Enable delete for users based on id" ON public.users;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios dados" ON public.users;
DROP POLICY IF EXISTS "Admins podem ver todos os usuários" ON public.users;
DROP POLICY IF EXISTS "Admins podem editar todos os usuários" ON public.users;
DROP POLICY IF EXISTS "Users can view own user" ON public.users;
DROP POLICY IF EXISTS "Users can update own user" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;

-- 3. Adiciona a coluna status se ela não existir
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 4. Lista os usuários existentes para verificação
SELECT id, email, role, status FROM public.users;

-- NOTA: Este script resolve o problema imediato desativando RLS
-- Em um ambiente de produção, você deve reativar o RLS com políticas adequadas
-- depois de solucionar o problema de recursão infinita. 