// pages/debug/schedules-scanner.tsx
'use client'

import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  where,
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
  orderBy,
  DocumentData
} from 'firebase/firestore';
import { ScheduleTemplate } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/firebase/config';
import { format, isAfter, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

interface ScheduleWithStatus extends ScheduleTemplate {
  id: string;
  isExpired: boolean;
  daysUntilEnd: number;
  status: 'active' | 'expired' | 'inactive';
}

interface ScanResult {
  totalScanned: number;
  deactivated: number;
  errors: number;
  skipped: number;
  details: {
    id: string;
    name: string;
    action: 'deactivated' | 'already_inactive' | 'still_active' | 'error';
    message?: string;
  }[];
}

export default function DebugSchedulesScannerPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleWithStatus[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'inactive'>('all');
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);

  // Verificar permissões (apenas coordenadores ou admins)
  useEffect(() => {
    loadSchedules();
  }, [user]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      
      // Buscar todos os templates de cronograma
      const schedulesQuery = query(
        collection(firestore, 'weeklySchedules'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(schedulesQuery);
      
      const now = new Date();
      const schedulesData: ScheduleWithStatus[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const endDate = data.endDate?.toDate?.() || new Date(data.endDate);
        const isActive = data.isActive !== false; // default true se não existir
        
        // Verificar se está expirado
        const isExpired = isAfter(now, endDate);
        const daysUntilEnd = isExpired 
          ? -differenceInDays(now, endDate) 
          : differenceInDays(endDate, now);
        
        let status: 'active' | 'expired' | 'inactive' = 'active';
        if (!isActive) {
          status = 'inactive';
        } else if (isExpired) {
          status = 'expired';
        }
        
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.(),
          updatedAt: data.updatedAt?.toDate?.(),
          startDate: data.startDate?.toDate?.(),
          endDate: endDate,
          isExpired,
          daysUntilEnd,
          status
        } as ScheduleWithStatus;
      });
      
      setSchedules(schedulesData);
      
      // Verificar se há cronogramas que precisam ser desativados
      const expiredActive = schedulesData.some(s => s.isExpired && s.isActive !== false);
      setAutoScanEnabled(expiredActive);
      
    } catch (error) {
      console.error('Erro ao carregar cronogramas:', error);
    } finally {
      setLoading(false);
    }
  };

  const runScanner = async () => {
    try {
      setScanning(true);
      setScanResult(null);
      
      const now = new Date();
      const batch = writeBatch(firestore);
      
      const result: ScanResult = {
        totalScanned: schedules.length,
        deactivated: 0,
        errors: 0,
        skipped: 0,
        details: []
      };
      
      let batchOperations = 0;
      
      for (const schedule of schedules) {
        try {
          // Verificar se está expirado e ativo
          const endDate = schedule.endDate;
          const isExpired = isAfter(now, endDate);
          const isActive = schedule.isActive !== false; // default true
          
          if (isExpired && isActive) {
            // Desativar cronograma
            const scheduleRef = doc(firestore, 'weeklySchedules', schedule.id);
            batch.update(scheduleRef, {
              isActive: false,
              updatedAt: Timestamp.now()
            });
            
            batchOperations++;
            result.deactivated++;
            result.details.push({
              id: schedule.id,
              name: schedule.name,
              action: 'deactivated',
              message: `Expirado em ${format(endDate, 'dd/MM/yyyy')}`
            });
            
            // Se atingir 500 operações, executa o batch e cria um novo
            if (batchOperations >= 500) {
              await batch.commit();
              // Criar novo batch
              batchOperations = 0;
            }
            
          } else if (!isActive) {
            result.skipped++;
            result.details.push({
              id: schedule.id,
              name: schedule.name,
              action: 'already_inactive',
              message: 'Já estava inativo'
            });
          } else {
            result.skipped++;
            result.details.push({
              id: schedule.id,
              name: schedule.name,
              action: 'still_active',
              message: `Vence em ${schedule.daysUntilEnd} dias`
            });
          }
          
        } catch (error) {
          result.errors++;
          result.details.push({
            id: schedule.id,
            name: schedule.name,
            action: 'error',
            message: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }
      
      // Executar operações restantes
      if (batchOperations > 0) {
        await batch.commit();
      }
      
      setScanResult(result);
      
      // Recarregar dados para mostrar atualizações
      await loadSchedules();
      
    } catch (error) {
      console.error('Erro durante varredura:', error);
      alert('Erro durante varredura: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setScanning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'expired': return 'bg-red-100 text-red-800 border-red-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'deactivated': return 'text-red-600 bg-red-50';
      case 'already_inactive': return 'text-gray-600 bg-gray-50';
      case 'still_active': return 'text-green-600 bg-green-50';
      case 'error': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'deactivated': return ' Desativado';
      case 'already_inactive': return ' Já inativo';
      case 'still_active': return ' Ativo';
      case 'error': return ' Erro';
      default: return action;
    }
  };

  const filteredSchedules = schedules.filter(schedule => {
    switch (filter) {
      case 'active': return schedule.status === 'active';
      case 'expired': return schedule.status === 'expired';
      case 'inactive': return schedule.status === 'inactive';
      default: return true;
    }
  });

  const stats = {
    total: schedules.length,
    active: schedules.filter(s => s.status === 'active').length,
    expired: schedules.filter(s => s.status === 'expired').length,
    inactive: schedules.filter(s => s.status === 'inactive').length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-lg text-gray-700">Carregando cronogramas...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Scanner de Cronogramas
            </h1>
            <button
              onClick={() => router.push('/debug/schedules')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              ← Ver templates completos
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Cronogramas</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-green-50 rounded-lg shadow p-4 border border-green-200">
              <div className="text-sm text-green-600">Ativos</div>
              <div className="text-2xl font-bold text-green-700">{stats.active}</div>
            </div>
            <div className="bg-red-50 rounded-lg shadow p-4 border border-red-200">
              <div className="text-sm text-red-600">Expirados (precisam ação)</div>
              <div className="text-2xl font-bold text-red-700">{stats.expired}</div>
            </div>
            <div className="bg-gray-50 rounded-lg shadow p-4 border border-gray-200">
              <div className="text-sm text-gray-600">Inativos</div>
              <div className="text-2xl font-bold text-gray-700">{stats.inactive}</div>
            </div>
          </div>

          {/* Aviso automático */}
          {autoScanEnabled && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <span className="text-yellow-600 text-xl mr-3"></span>
                <div>
                  <h3 className="font-medium text-yellow-800">Cronogramas expirados detectados</h3>
                  <p className="text-yellow-700 text-sm">
                    Existem {stats.expired} cronograma(s) que já passaram da data de término e ainda estão ativos.
                    Execute a varredura para desativá-los automaticamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={runScanner}
                  disabled={scanning}
                  className={`
                    px-6 py-3 rounded-lg font-medium text-white
                    flex items-center space-x-2
                    ${scanning 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                    }
                  `}
                >
                  {scanning ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Escaneando...</span>
                    </>
                  ) : (
                    <>
                      <span>Executar Varredura</span>
                    </>
                  )}
                </button>

                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Apenas ativos</option>
                  <option value="expired">Apenas expirados</option>
                  <option value="inactive">Apenas inativos</option>
                </select>

                <button
                  onClick={loadSchedules}
                  className="px-4 py-3 text-gray-600 hover:text-gray-900 border rounded-lg"
                >
                  Recarregar
                </button>
              </div>

              <div className="text-sm text-gray-500">
                Última atualização: {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
              </div>
            </div>
          </div>
        </div>

        {/* Resultado da Varredura */}
        {scanResult && (
          <div className="mb-8 bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                Resultado da Varredura
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-sm text-blue-600">Total escaneado</div>
                  <div className="text-xl font-bold">{scanResult.totalScanned}</div>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <div className="text-sm text-red-600">Desativados</div>
                  <div className="text-xl font-bold">{scanResult.deactivated}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Ignorados</div>
                  <div className="text-xl font-bold">{scanResult.skipped}</div>
                </div>
                <div className="bg-orange-50 p-3 rounded">
                  <div className="text-sm text-orange-600">Erros</div>
                  <div className="text-xl font-bold">{scanResult.errors}</div>
                </div>
              </div>

              {/* Detalhes */}
              <div className="mt-4">
                <h3 className="font-medium mb-2">Detalhamento:</h3>
                <div className="max-h-60 overflow-y-auto border rounded">
                  {scanResult.details.map((detail, index) => (
                    <div 
                      key={index}
                      className={`p-2 border-b last:border-b-0 text-sm ${getActionColor(detail.action)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium">{detail.name}</span>
                          <code className="ml-2 text-xs bg-gray-200 px-1 py-0.5 rounded">
                            {detail.id.slice(0, 8)}...
                          </code>
                        </div>
                        <span className="text-xs font-medium">
                          {getActionLabel(detail.action)}
                        </span>
                      </div>
                      {detail.message && (
                        <div className="text-xs mt-1 opacity-75">{detail.message}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Cronogramas */}
        <div className="bg-white rounded-lg shadow overflow-hidden text-gray-800">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Cronogramas ({filteredSchedules.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {filteredSchedules.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Nenhum cronograma encontrado com este filtro
              </div>
            ) : (
              filteredSchedules.map((schedule) => (
                <div key={schedule.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {schedule.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {schedule.description || 'Sem descrição'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(schedule.status)}`}>
                        {schedule.status === 'active' && ' Ativo'}
                        {schedule.status === 'expired' && ' Expirado'}
                        {schedule.status === 'inactive' && ' Inativo'}
                      </span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {schedule.category}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Período:</span>
                      <p>
                        {format(schedule.startDate, 'dd/MM/yyyy')} - {format(schedule.endDate, 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Término:</span>
                      <p className={schedule.isExpired ? 'text-red-600 font-medium' : 'text-green-600'}>
                        {schedule.isExpired 
                          ? `Expirado há ${-schedule.daysUntilEnd} dias`
                          : `Vence em ${schedule.daysUntilEnd} dias`
                        }
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Atividades:</span>
                      <p>{schedule.metadata?.totalActivities || 0}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Horas/semana:</span>
                      <p>{schedule.metadata?.estimatedWeeklyHours || 0}h</p>
                    </div>
                  </div>

                  {/* Status do isActive */}
                  <div className="mt-3 text-xs">
                    <span className="text-gray-400">isActive: </span>
                    <code className="bg-gray-100 px-1 py-0.5 rounded">
                      {String(schedule.isActive !== false)}
                    </code>
                    {schedule.isExpired && schedule.isActive !== false && (
                      <span className="ml-2 text-red-600 font-medium">
                        Deveria estar inativo!
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}