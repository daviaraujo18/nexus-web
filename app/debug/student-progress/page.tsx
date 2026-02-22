// app/debug/student-progress/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { firestore } from '@/firebase/config';

export default function DebugStudentProgress() {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function fetchSnapshots() {
      if (!user?.id) return;

      try {
        console.log('🔍 Buscando snapshots para o aluno:', user.id);
        
        const snapshotsRef = collection(firestore, 'weeklySnapshots');
        
        // Query sem filtro de data primeiro
        const q = query(
          snapshotsRef,
          where('studentId', '==', user.id),
          orderBy('weekNumber', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        console.log('📊 Resultado da query:', {
          empty: querySnapshot.empty,
          size: querySnapshot.size,
          docs: querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        });
        
        setSnapshots(querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })));
        
      } catch (err) {
        console.error('❌ Erro:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    }

    fetchSnapshots();
  }, [user?.id]);

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Diagnóstico - Progresso do Aluno</h1>
      
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <p><strong>Student ID:</strong> {user?.id}</p>
        <p><strong>Snapshots encontrados:</strong> {snapshots.length}</p>
        {error && <p className="text-red-600">Erro: {error}</p>}
      </div>

      {snapshots.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
          <h2 className="font-semibold text-yellow-800 mb-2">Nenhum snapshot encontrado</h2>
          <p>Possíveis causas:</p>
          <ul className="list-disc pl-5 mt-2">
            <li>O studentId no Firestore pode ser diferente do UID do usuário</li>
            <li>A coleção pode ter outro nome (ex: 'weeklySnapshots' vs 'weekly-snapshots')</li>
            <li>Os snapshots podem não ter sido gerados ainda</li>
            <li>O campo 'studentId' pode ter outro nome (ex: 'userId', 'student_id')</li>
          </ul>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">Snapshots encontrados:</h2>
          <div className="space-y-4">
            {snapshots.map((snap, index) => (
              <div key={index} className="border rounded p-4 bg-white">
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(snap, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold mb-2">Verificar estrutura dos documentos:</h3>
        <p>Campos esperados no documento:</p>
        <ul className="list-disc pl-5 mt-2">
          <li><code>studentId</code>: ID do aluno (deve ser igual ao UID do usuário)</li>
          <li><code>weekNumber</code>: número da semana</li>
          <li><code>engagement</code>: objeto com dados de engajamento</li>
          <li><code>performance</code>: objeto com dados de desempenho</li>
        </ul>
      </div>
    </div>
  );
}