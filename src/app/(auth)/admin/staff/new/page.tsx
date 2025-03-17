'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

export default function NewStaff() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'waiter',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        
        // Verificar autenticação
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/login');
          return;
        }

        // Obter perfil e verificar se é admin
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }

        setUser(profile as User);
      } catch (error: any) {
        console.error('Erro ao verificar autenticação:', error);
        toast.error('Erro ao carregar dados: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formSubmitting) return;
    
    // Validação básica
    if (!formData.name.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }
    
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error('Email inválido');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    
    try {
      setFormSubmitting(true);
      const supabase = createClient();
      
      // Verificar se o email já está em uso
      try {
        // Primeiro verifica na tabela de usuários
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', formData.email)
          .limit(1);

        if (existingUser && existingUser.length > 0) {
          toast.error('Este email já está em uso');
          setFormSubmitting(false);
          return;
        }

        // Tenta fazer login com o email para verificar se existe na autenticação
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: 'senha-temporaria-apenas-para-teste'
        });

        // Se não der erro específico de credenciais inválidas, o usuário existe
        if (signInError && !signInError.message.includes('Invalid login credentials')) {
          toast.error('Este email já está registrado no sistema');
          setFormSubmitting(false);
          return;
        }
      } catch (checkError) {
        console.log('Erro ao verificar existência do email:', checkError);
        // Continuar mesmo com erro na verificação
      }
      
      // Registrar o usuário na autenticação
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      // Tratar especificamente o erro de usuário já registrado
      if (error) {
        if (error.message && error.message.includes('already registered')) {
          toast.error('Este email já está registrado no sistema de autenticação');
          setFormSubmitting(false);
          return;
        }
        throw error;
      }

      if (!data.user) {
        throw new Error('Erro ao criar usuário');
      }

      // Criar perfil do usuário
      if (!user?.restaurantId && !user?.restaurant_id) {
        console.error('Erro: admin sem restaurante associado', user);
        throw new Error('Seu usuário de administrador não está associado a um restaurante. Contate o suporte.');
      }
      
      console.log('Dados do administrador criando funcionário:', {
        adminId: user.id,
        adminEmail: user.email,
        adminRestaurantId: user.restaurantId || user.restaurant_id
      });
      
      const restaurantIdToUse = user?.restaurant_id || user?.restaurantId;
      console.log('ID do restaurante que será usado:', restaurantIdToUse);
      
      const { error: profileError } = await supabase.from('users').insert({
        id: data.user.id,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        restaurant_id: restaurantIdToUse,
        status: 'active'
      });

      if (profileError) {
        throw profileError;
      }

      toast.success('Funcionário adicionado com sucesso!');
      
      // Redirecionar para a lista de funcionários
      setTimeout(() => {
        router.push('/admin/staff');
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao adicionar funcionário:', error);
      
      let errorMessage = 'Erro desconhecido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      toast.error(`Erro ao adicionar funcionário: ${errorMessage}`);
    } finally {
      setFormSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Adicionar Novo Funcionário</h1>
        <p className="text-gray-600">Preencha o formulário abaixo para adicionar um novo funcionário ao restaurante</p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Nome Completo *
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email *
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  name="email"
                  id="email"
                  required
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">O email será usado para login no sistema</p>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Função *
              </label>
              <div className="mt-1">
                <select
                  name="role"
                  id="role"
                  required
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="waiter">Garçom</option>
                  <option value="manager">Gerente</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha *
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  name="password"
                  id="password"
                  required
                  minLength={6}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">A senha deve ter pelo menos 6 caracteres</p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar Senha *
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  name="confirmPassword"
                  id="confirmPassword"
                  required
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Link
              href="/admin/staff"
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={formSubmitting}
              className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {formSubmitting ? 'Salvando...' : 'Salvar Funcionário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 