// components/analytics/StudentSelector.tsx
//
// COMPONENTE LEGADO — NÃO UTILIZADO EM PRODUÇÃO
//
// Versão original do seletor de alunos para filtro no dashboard analítico.
// Foi substituído por `components/analytics/common/StudentSelector.tsx`,
// que faz parte da biblioteca de primitivos compartilhados da pasta `common/`.
//
// O bloco de filtros que o consumia em `app/professional/analytics/page.tsx`
// está atualmente comentado (linhas 324-352 do page.tsx), pois o filtro de alunos
// foi temporariamente removido da UI em favor de filtros de escola e série
// diretamente no ranking de bem-estar.
//
// Mantido para referência histórica. Não deve ser importado por novas rotas.
// Utilize `components/analytics/common/StudentSelector.tsx` para novos usos.
//
'use client';

import React, { useState, useEffect } from 'react';
import {
  FaUserGraduate,
  FaSearch,
  FaSchool,
  FaFilter,
  FaChartLine,
  FaCalendarAlt,
  FaUserCheck,
  FaSpinner
} from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import { StudentService } from '@/lib/services/StudentService';
import { Student } from '@/types/auth';

interface StudentSelectorProps {
  onSelect: (studentId: string, studentName: string) => void;
}

export default function StudentSelector({ onSelect }: StudentSelectorProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    school: '',
    grade: ''
  });

  // Carregar alunos
  useEffect(() => {
    if (!user || user.role === 'student') return;

    const loadStudents = async () => {
      try {
        setLoading(true);
        setError(null);

        // USAR O MESMO MÉTODO QUE FUNCIONA NA PÁGINA DE STUDENTS
        const studentsData = await StudentService.getStudentsByProfessionalOrAll(
          user.id,
          user.role, // Passar o role do usuário
          {
            activeOnly: true,
            limit: 50
          }
        );

        console.log(` Analytics - Alunos carregados: ${studentsData.length}`);
        console.log(` Role do usuário: ${user.role}`);

        setStudents(studentsData);
        setFilteredStudents(studentsData);
      } catch (err: any) {
        console.error('Erro ao carregar alunos:', err);
        setError(err.message || 'Erro ao carregar lista de alunos');
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [user]);

  // Aplicar filtros
  useEffect(() => {
    let result = students;

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(student =>
        student.name.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term) ||
        student.profile.school.toLowerCase().includes(term)
      );
    }

    // Filtro por escola
    if (selectedFilters.school) {
      result = result.filter(student =>
        student.profile.school === selectedFilters.school
      );
    }

    // Filtro por série
    if (selectedFilters.grade) {
      result = result.filter(student =>
        student.profile.grade === selectedFilters.grade
      );
    }

    setFilteredStudents(result);
  }, [students, searchTerm, selectedFilters]);

  // Extrair escolas e séries únicas
  const schools = [...new Set(students.map(s => s.profile.school).filter(Boolean))].sort();
  const grades = [...new Set(students.map(s => s.profile.grade).filter(Boolean))].sort();

  const handleStudentSelect = (student: Student) => {
    onSelect(student.id, student.name);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <FaSpinner className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando lista de alunos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <FaUserGraduate className="text-red-500" />
          <div>
            <h3 className="font-semibold text-red-800">Erro ao carregar alunos</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FaUserGraduate className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Selecionar Aluno</h2>
              <p className="text-gray-500">
                Escolha um aluno para visualizar o relatório individual
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-gray-800">{filteredStudents.length}</div>
            <div className="text-sm text-gray-500">alunos disponíveis</div>
          </div>
        </div>

        {/* Barra de busca */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar aluno por nome, email ou escola..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaSchool className="inline mr-2" />
              Escola
            </label>
            <select
              value={selectedFilters.school}
              onChange={(e) => setSelectedFilters(prev => ({
                ...prev,
                school: e.target.value
              }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Todas as escolas</option>
              {schools.map(school => (
                <option key={school} value={school}>{school}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaCalendarAlt className="inline mr-2" />
              Série
            </label>
            <select
              value={selectedFilters.grade}
              onChange={(e) => setSelectedFilters(prev => ({
                ...prev,
                grade: e.target.value
              }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Todas as séries</option>
              {grades.map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaFilter className="inline mr-2" />
              Ações
            </label>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedFilters({ school: '', grade: '' });
              }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Alunos */}
      {filteredStudents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <FaUserGraduate className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Nenhum aluno encontrado
          </h3>
          <p className="text-gray-500">
            {searchTerm || selectedFilters.school || selectedFilters.grade
              ? 'Tente ajustar os filtros de busca'
              : 'Nenhum aluno atribuído a você no momento'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map(student => {
            // Calcular idade aproximada
            const calculateAge = (birthday: Date) => {
              const ageDifMs = Date.now() - birthday.getTime();
              const ageDate = new Date(ageDifMs);
              return Math.abs(ageDate.getUTCFullYear() - 1970);
            };

            const age = student.profile.birthday
              ? calculateAge(student.profile.birthday)
              : null;

            return (
              <div
                key={student.id}
                onClick={() => handleStudentSelect(student)}
                className="bg-white border rounded-xl p-6 cursor-pointer hover:shadow-lg transition-shadow hover:border-indigo-300 group"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                      <FaUserGraduate className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-1">
                      {student.name}
                    </h3>
                    <p className="text-sm text-gray-500">{student.email}</p>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {student.profile.grade}
                      </span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        {student.profile.school}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    {student.profile.assignedProfessionals?.length || 0} profissionais
                  </div>
                  <button className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                    Ver Relatório
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Estatísticas */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6">
        <h3 className="font-semibold text-indigo-800 mb-4">📊 Estatísticas Gerais</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{students.length}</div>
            <div className="text-sm text-gray-500">Total de Alunos</div>
          </div>

          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-gray-800">
              {students.filter(s => s.profile.streak >= 3).length}
            </div>
            <div className="text-sm text-gray-500">Com Bom Engajamento</div>
          </div>

          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-gray-800">
              {schools.length}
            </div>
            <div className="text-sm text-gray-500">Escolas Diferentes</div>
          </div>

          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-gray-800">
              {grades.length}
            </div>
            <div className="text-sm text-gray-500">Séries Atendidas</div>
          </div>
        </div>
      </div>
    </div>
  );
}