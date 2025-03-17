'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

interface EditStaffPageProps {
  params: {
    id: string;
  };
}

export default function EditStaff({ params }: EditStaffPageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id;
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    status: 'active'
  });
  const [originalEmail, setOriginalEmail] = useState('');

  useEffect(() => {
    const fetchStaffData = async () => {
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

        // Obter detalhes do funcionário
        const { data: staff, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !staff) {
          toast.error('Funcionário não encontrado');
          router.push('/admin/staff');
          return;
        }

        // Verificar se o funcionário pertence ao restaurante do admin
        if (staff.restaurantId !== profile.restaurantId) {
          toast.error('Você não tem permissão para editar este funcionário');
          router.push('/admin/staff');
          return;
        }

        setFormData({
          name: staff.name,
          email: staff.email,
          role: staff.role,
          status: staff.status || 'active'
        });
        setOriginalEmail(staff.email);
      } catch (error: any) {
        console.error('Erro ao carregar funcionário:', error);
        toast.error('Erro ao carregar dados: ' + error.message);
        router.push('/admin/staff');
      } finally {
        setLoading(false);
      }
    };

    fetchStaffData();
  }, [id, router]);

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
    
    try {
      setFormSubmitting(true);
      const supabase = createClient();
      
      // Verificar se já existe outro usuário com o mesmo email (excluindo o funcionário atual)
      if (formData.email !== originalEmail) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', formData.email)
          .neq('id', id)
          .limit(1);

        if (existingUser && existingUser.length > 0) {
          toast.error('Este email já está em uso por outro usuário');
          setFormSubmitting(false);
          return;
        }
      }
      
      // Atualizar o funcionário
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: formData.status
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Se o email mudou, atualizar no auth também
      if (formData.email !== originalEmail) {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          id,
          { email: formData.email }
        );

        if (authError) {
          console.error('Erro ao atualizar email na autenticação:', authError);
          toast.error('O perfil foi atualizado, mas houve um erro ao atualizar o email para login');
        }
      }

      toast.success('Funcionário atualizado com sucesso!');
      
      // Redirecionar para a lista de funcionários
      setTimeout(() => {
        router.push('/admin/staff');
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao atualizar funcionário:', error);
      toast.error('Erro ao atualizar funcionário: ' + error.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setFormSubmitting(true);
      const supabase = createClient();
      
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      toast.success('Email para redefinição de senha enviado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao solicitar redefinição de senha:', error);
      toast.error('Erro ao solicitar redefinição de senha: ' + error.message);
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
        <h1 className="text-3xl font-bold text-gray-900">Editar Funcionário</h1>
        <p className="text-gray-600">Atualize as informações do funcionário</p>
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

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status *
              </label>
              <div className="mt-1">
                <select
                  name="status"
                  id="status"
                  required
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={formSubmitting}
              className="bg-yellow-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
            >
              Enviar Email para Redefinição de Senha
            </button>

            <div className="flex space-x-3">
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
                {formSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 