'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Command, Table, Product } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

interface AddItemProps {
  params: {
    id: string;
  };
}

export default function AddItemToCommand({ params }: AddItemProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id;
  const [command, setCommand] = useState<Command | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 1,
    notes: ''
  });

  useEffect(() => {
    const fetchData = async () => {
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
          .select('*, restaurant:restaurant_id(*)')
          .eq('id', authUser.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }

        // Obter detalhes da comanda
        const { data: commandData, error: commandError } = await supabase
          .from('commands')
          .select('*, table:tableId(*)')
          .eq('id', id)
          .single();

        if (commandError || !commandData) {
          toast.error('Comanda não encontrada');
          router.push('/admin/commands');
          return;
        }

        // Verificar se a comanda está aberta
        if (commandData.status !== 'open') {
          toast.error('Não é possível adicionar itens a uma comanda fechada');
          router.push(`/admin/commands/${id}`);
          return;
        }

        // Verificar se a comanda pertence ao restaurante do admin
        const { data: tableData } = await supabase
          .from('tables')
          .select('*')
          .eq('id', commandData.tableId)
          .single();

        if (!tableData || tableData.restaurant_id !== profile.restaurantId) {
          toast.error('Você não tem permissão para acessar esta comanda');
          router.push('/admin/commands');
          return;
        }

        setCommand(commandData as Command);
        setTable(tableData as Table);

        // Obter produtos do restaurante
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('restaurant_id', profile.restaurantId)
          .order('name', { ascending: true });

        if (productsError) {
          throw productsError;
        }

        setProducts(productsData || []);
        setFilteredProducts(productsData || []);

        // Extrair categorias únicas
        const uniqueCategories = [...new Set(productsData?.map(product => product.category) || [])];
        setCategories(uniqueCategories);

      } catch (error: any) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, router]);

  // Filtrar produtos quando o termo de busca ou categoria mudar
  useEffect(() => {
    let filtered = [...products];
    
    // Filtrar por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtrar por categoria
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }
    
    setFilteredProducts(filtered);
  }, [searchTerm, selectedCategory, products]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProductSelection = (product: Product) => {
    setFormData(prev => ({ ...prev, productId: product.id }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formSubmitting) return;
    
    // Validação básica
    if (!formData.productId) {
      toast.error('Selecione um produto');
      return;
    }
    
    if (formData.quantity <= 0) {
      toast.error('A quantidade deve ser maior que zero');
      return;
    }
    
    try {
      setFormSubmitting(true);
      const supabase = createClient();
      
      // Obter detalhes do produto
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', formData.productId)
        .single();

      if (productError || !product) {
        throw new Error('Produto não encontrado');
      }

      // Adicionar item à comanda
      const { error: itemError } = await supabase
        .from('command_items')
        .insert({
          command_id: id,
          product_id: formData.productId,
          quantity: parseInt(formData.quantity.toString()),
          price: product.price,
          notes: formData.notes.trim() || null
        });

      if (itemError) {
        throw itemError;
      }

      // Atualizar total da comanda
      const { data: commandItems } = await supabase
        .from('command_items')
        .select('*, product:product_id(*)')
        .eq('command_id', id);

      const subtotal = commandItems?.reduce((total, item) => 
        total + (item.price * item.quantity), 0) || 0;
      
      const total = subtotal * 1.1; // Adiciona 10% de taxa de serviço

      const { error: updateError } = await supabase
        .from('commands')
        .update({
          total,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      toast.success('Item adicionado com sucesso!');
      
      // Redirecionar para a página de detalhes da comanda
      setTimeout(() => {
        router.push(`/admin/commands/${id}`);
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao adicionar item:', error);
      toast.error('Erro ao adicionar item: ' + error.message);
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

  if (!command || !table) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">Comanda não encontrada</p>
      </div>
    );
  }

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Adicionar Item à Comanda</h1>
          <p className="text-gray-600">Mesa #{table?.number}</p>
        </div>
        <Link
          href={`/admin/commands/${id}`}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
        >
          Voltar para Comanda
        </Link>
      </div>

      {/* Barra de pesquisa e filtros */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="flex-grow">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Buscar Produtos
            </label>
            <input
              type="text"
              id="search"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Nome ou descrição do produto"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Categoria
            </label>
            <select
              id="category"
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">Todas as categorias</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lista de produtos */}
        <div className="md:col-span-2">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Selecione um Produto</h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Nenhum produto encontrado
                </div>
              ) : (
                filteredProducts.map(product => (
                  <div 
                    key={product.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${formData.productId === product.id ? 'bg-blue-50' : ''}`}
                    onClick={() => handleProductSelection(product)}
                  >
                    <div className="flex justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-500">{product.description}</p>
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full mt-1 inline-block">
                          {product.category}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        R$ {product.price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Formulário */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Detalhes do Item</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="productId" className="block text-sm font-medium text-gray-700">
                  Produto Selecionado
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="selectedProduct"
                    className="block w-full border-gray-300 bg-gray-100 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={products.find(p => p.id === formData.productId)?.name || 'Nenhum produto selecionado'}
                    readOnly
                  />
                  <input type="hidden" name="productId" value={formData.productId} />
                </div>
              </div>

              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                  Quantidade *
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="quantity"
                    id="quantity"
                    min="1"
                    required
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={formData.quantity}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                  Observações
                </label>
                <div className="mt-1">
                  <textarea
                    name="notes"
                    id="notes"
                    rows={3}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Ex: Sem cebola, bem passado, etc."
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={formSubmitting || !formData.productId}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {formSubmitting ? 'Adicionando...' : 'Adicionar Item'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 