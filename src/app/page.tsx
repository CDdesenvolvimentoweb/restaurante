import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-100">
      <div className="max-w-5xl w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-white">
          <h1 className="text-4xl font-bold mb-2">Sistema de Gerenciamento de Restaurantes</h1>
          <p className="text-xl opacity-90">Gerencie mesas, comandas e produtos com facilidade</p>
        </div>
        
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Para Restaurantes</h2>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Gerenciamento de mesas e comandas</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Controle de produtos e categorias</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Relatórios detalhados</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Gestão de funcionários</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Para Funcionários</h2>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Interface simples e intuitiva</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Notificações em tempo real</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Acesso rápido a comandas abertas</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Visualização de histórico</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg text-center font-semibold transition">
              Entrar no Sistema
            </Link>
            <Link href="/signup" className="bg-white hover:bg-gray-100 text-blue-600 border border-blue-600 py-3 px-6 rounded-lg text-center font-semibold transition">
              Criar Conta
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
