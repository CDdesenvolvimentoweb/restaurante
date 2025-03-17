'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

export default function NewCommand() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    table_number: '',
    client_name: '',
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
        
        // Obter perfil e verificar se é garçom
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();
          
        if (!profile || profile.role !== 'waiter') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }
        
        setUser(profile as User);
      } catch (error: any) {
        console.error('Erro ao verificar autenticação:', error);
        toast.error(`Erro ao verificar autenticação: ${error.message || 'Verifique o console para mais detalhes'}`);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (submitting) return;
    
    // Validação básica
    if (!formData.table_number.trim()) {
      toast.error('O número da mesa é obrigatório');
      return;
    }
    
    if (isNaN(parseInt(formData.table_number))) {
      toast.error('O número da mesa deve ser um valor numérico');
      return;
    }
    
    try {
      setSubmitting(true);
      const supabase = createClient();
      
      // Abordagem simplificada - usar apenas os campos essenciais
      const tableNumber = parseInt(formData.table_number);
      const restaurantId = user?.restaurant_id || user?.restaurantId;
      
      console.log('Tentando criar comanda para mesa:', tableNumber);
      console.log('ID do restaurante:', restaurantId);
      
      // Criar objeto simplificado com os campos mais prováveis
      const commandData: any = {
        status: 'open',
        created_at: new Date().toISOString(),
        // Adicionar todos os campos possíveis para o número da mesa
        table_number: tableNumber, 
        table: tableNumber      // Adicionar também no campo 'table' para compatibilidade
      };
      
      // Adicionar restaurante apenas se disponível
      if (restaurantId) {
        // Usar nome campo no formato snake_case 
        // Isso é mais comum em bancos PostgreSQL do Supabase
        commandData.restaurant_id = restaurantId;
      }
      
      // Adicionar nome do cliente se disponível
      if (formData.client_name.trim()) {
        commandData.client_name = formData.client_name.trim();
      }
      
      console.log('Tentando criar comanda com dados:', commandData);
      
      // Inserir a comanda
      const { data, error } = await supabase
        .from('commands')
        .insert(commandData)
        .select('id')
        .single();
        
      if (error) {
        console.error('Erro ao criar comanda:', error);
        console.error('Detalhes do erro:', JSON.stringify(error));
        throw new Error(`Erro ao criar comanda: ${error.message}`);
      }
      
      console.log('Comanda criada com sucesso:', data);
      toast.success(`Comanda para a mesa ${formData.table_number} criada com sucesso!`);
      
      // Redirecionar para a lista de comandas
      setTimeout(() => {
        router.push('/waiter/commands');
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao criar comanda:', error);
      let errorMessage = 'Erro desconhecido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      toast.error(`Erro ao criar comanda: ${errorMessage}`);
      setSubmitting(false);
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
        <h1 className="text-3xl font-bold text-gray-900">Nova Comanda</h1>
        <p className="text-gray-600">Preencha os dados para abrir uma nova comanda</p>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="table_number" className="block text-sm font-medium text-gray-700">
                Número da Mesa *
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="table_number"
                  id="table_number"
                  min="1"
                  required
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.table_number}
                  onChange={handleChange}
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="client_name" className="block text-sm font-medium text-gray-700">
                Nome do Cliente
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="client_name"
                  id="client_name"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.client_name}
                  onChange={handleChange}
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <Link
              href="/waiter/commands"
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancelar
            </Link>
            
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {submitting ? 'Criando...' : 'Criar Comanda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 