// components/analytics/common/StudentSelector.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiChevronDown, FiSearch, FiX } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/firebase/config';

interface StudentSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function StudentSelector({ selectedIds, onChange }: StudentSelectorProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<Array<{ id: string; name: string; grade: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      try {
        const studentsRef = collection(firestore, 'students');
        const q = query(
          studentsRef,
          where('assignedProfessionals', 'array-contains', user.id)
        );
        
        const snapshot = await getDocs(q);
        const studentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          grade: doc.data().grade || 'Não informado'
        }));
        
        setStudents(studentsData);
      } catch (error) {
        console.error('Error fetching students:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchStudents();
    }
  }, [user?.id, isOpen]);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.grade.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStudent = (studentId: string) => {
    if (selectedIds.includes(studentId)) {
      onChange(selectedIds.filter(id => id !== studentId));
    } else {
      onChange([...selectedIds, studentId]);
    }
  };

  const selectAll = () => {
    onChange(students.map(s => s.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  const getDisplayText = () => {
    if (selectedIds.length === 0) return 'Todos os alunos';
    if (selectedIds.length === 1) {
      const student = students.find(s => s.id === selectedIds[0]);
      return student?.name || '1 aluno selecionado';
    }
    return `${selectedIds.length} alunos selecionados`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[200px]"
      >
        <FiUsers className="text-gray-400" />
        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 text-left">
          {getDisplayText()}
        </span>
        <FiChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
          >
            {/* Search */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Buscar aluno..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Selecionar todos
              </button>
              {selectedIds.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Student List */}
            <div className="max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  Carregando...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Nenhum aluno encontrado
                </div>
              ) : (
                filteredStudents.map(student => (
                  <button
                    key={student.id}
                    onClick={() => toggleStudent(student.id)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white text-left">
                        {student.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
                        {student.grade}
                      </p>
                    </div>
                    {selectedIds.includes(student.id) && (
                      <FiX className="h-4 w-4 text-blue-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}