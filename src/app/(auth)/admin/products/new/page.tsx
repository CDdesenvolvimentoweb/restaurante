'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

export default function NewProduct() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    customCategory: '',
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

        // Obter categorias existentes
        const { data: products } = await supabase
          .from('products')
          .select('category')
          .eq('restaurant_id', profile.restaurant_id || profile.restaurantId);

        const uniqueCategories = [...new Set(products?.map(product => product.category) || [])];
        setCategories(uniqueCategories);
      } catch (error: any) {
        console.error('Erro ao verificar autenticação:', error);
        toast.error('Erro ao carregar dados: ' + (error.message || 'Verifique o console para mais detalhes'));
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formSubmitting) return;
    
    // Validação básica
    if (!formData.name.trim()) {
      toast.error('O nome do produto é obrigatório');
      return;
    }
    
    if (!formData.price || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      toast.error('O preço deve ser um valor numérico maior que zero');
      return;
    }
    
    const category = formData.category === 'new' ? formData.customCategory.trim() : formData.category;
    
    if (!category) {
      toast.error('A categoria é obrigatória');
      return;
    }
    
    try {
      setFormSubmitting(true);
      const supabase = createClient();

      // Verificar a estrutura da tabela de produtos
      const { data: checkProduct, error: checkError } = await supabase
        .from('products')
        .select('*')
        .limit(1);
      
      if (checkError) {
        console.error('Erro ao verificar tabela de produtos:', checkError);
        throw new Error(`Erro ao verificar tabela de produtos: ${checkError.message}`);
      }
      
      // Verificar qual nome de coluna utilizar para o ID do restaurante
      let restaurantColumnName = 'restaurant_id';
      if (checkProduct && checkProduct.length > 0) {
        const columns = Object.keys(checkProduct[0]);
        if (columns.includes('restaurantId')) {
          restaurantColumnName = 'restaurantId';
        }
      }
      
      console.log(`Usando coluna ${restaurantColumnName} para o ID do restaurante`);
      
      // Construir o objeto do produto com base na convenção de nomenclatura do banco
      const productData: any = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        category
      };
      
      // Adicionar o ID do restaurante usando o nome de coluna correto
      productData[restaurantColumnName] = user?.restaurant_id || user?.restaurantId;

      console.log('Dados do produto a serem inseridos:', productData);
      
      // Adicionar o produto
      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) {
        console.error('Erro detalhado do Supabase:', error);
        throw error;
      }

      toast.success('Produto adicionado com sucesso!');
      
      // Redirecionar para a lista de produtos
      setTimeout(() => {
        router.push('/admin/products');
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao adicionar produto:', error);
      let errorMessage = 'Erro desconhecido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      toast.error(`Erro ao adicionar produto: ${errorMessage}`);
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
        <h1 className="text-3xl font-bold text-gray-900">Adicionar Novo Produto</h1>
        <p className="text-gray-600">Preencha o formulário abaixo para adicionar um novo produto ao cardápio</p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Nome do Produto *
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
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Descrição
              </label>
              <div className="mt-1">
                <textarea
                  name="description"
                  id="description"
                  rows={3}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">Breve descrição do produto, ingredientes, etc.</p>
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                Preço (R$) *
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">R$</span>
                </div>
                <input
                  type="number"
                  name="price"
                  id="price"
                  required
                  min="0.01"
                  step="0.01"
                  className="block w-full pl-10 pr-12 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                Categoria *
              </label>
              <div className="mt-1">
                <select
                  name="category"
                  id="category"
                  required
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.category}
                  onChange={handleChange}
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                  <option value="new">Adicionar nova categoria</option>
                </select>
              </div>
            </div>

            {formData.category === 'new' && (
              <div>
                <label htmlFor="customCategory" className="block text-sm font-medium text-gray-700">
                  Nova Categoria *
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="customCategory"
                    id="customCategory"
                    required
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={formData.customCategory}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Link
              href="/admin/products"
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={formSubmitting}
              className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {formSubmitting ? 'Salvando...' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 