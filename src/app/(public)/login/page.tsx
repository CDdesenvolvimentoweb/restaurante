'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast, { Toaster } from 'react-hot-toast';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      
      // Mostrar qual email está tentando fazer login
      console.log('Tentando login com email:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      console.log('Login bem-sucedido, dados de autenticação:', data);

      // Verificar o papel do usuário para redirecionamento
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não encontrado após autenticação');
      }
      
      console.log('ID do usuário autenticado:', user.id);
      
      // Buscar perfil do usuário com diagnóstico detalhado
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')  // Selecionar todos os campos para debug
        .eq('id', user.id)
        .single();

      console.log('Consulta realizada com id:', user.id);
      
      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError);
        
        // Verificar se o erro é relacionado a RLS (Row Level Security)
        if (profileError.message.includes('permission') || profileError.code === 'PGRST301') {
          toast.error('Erro de permissão. Entre em contato com o administrador');
          throw new Error('Erro de permissão ao acessar perfil de usuário');
        }
        
        toast.error(`Erro ao buscar perfil: ${profileError.message}`);
        throw new Error(`Erro ao buscar perfil: ${profileError.message}`);
      }

      if (!profile) {
        console.log('Perfil não encontrado para o ID:', user.id);
        
        // Verificar todos os usuários na tabela para debug
        const { data: allUsers, error: listError } = await supabase
          .from('users')
          .select('id, email, role')
          .order('created_at', { ascending: false });
        
        console.log('Todos os usuários na tabela:', allUsers);
        
        if (listError) {
          console.error('Erro ao listar usuários:', listError);
        }
        
        // Verificar se o id do usuário corresponde ao formato esperado
        if (!user.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.error('ID de usuário em formato inválido:', user.id);
        }
        
        // Tentar criar o perfil automaticamente
        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            name: user.email?.split('@')[0] || 'Usuário',
            role: 'admin',
            restaurant_id: null,
            status: 'active'
          })
          .select()
          .single();
          
        if (insertError) {
          console.error('Erro ao criar perfil:', insertError);
          throw new Error('Não foi possível criar perfil de usuário automaticamente. Entre em contato com o administrador.');
        }
        
        toast.success('Perfil criado automaticamente');
        console.log('Perfil criado:', newProfile);
        
        // Usar o perfil recém-criado
        router.push('/admin');
        return;
      }

      console.log('Perfil encontrado:', profile);

      // Redirecionar com base no papel do usuário
      switch (profile.role) {
        case 'super_admin':
          router.push('/super-admin');
          break;
        case 'admin':
          router.push('/admin');
          break;
        case 'manager':
          router.push('/manager');
          break;
        case 'waiter':
          router.push('/waiter');
          break;
        default:
          router.push('/');
      }

      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      // Mensagem de erro mais amigável
      let errorMessage = 'Ocorreu um erro ao fazer login';
      
      if (error.message) {
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou senha incorretos';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Email não confirmado. Verifique sua caixa de entrada';
        } else if (error.message.includes('perfil')) {
          errorMessage = 'Perfil de usuário não encontrado. Entre em contato com o administrador';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      console.error('Erro de login detalhado:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Entrar no Sistema
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Acesse o sistema de gerenciamento de restaurantes
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember_me"
                  name="remember_me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-900">
                  Lembrar-me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                  Esqueceu sua senha?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Carregando...' : 'Entrar'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Ainda não tem conta?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/signup"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Criar uma conta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 