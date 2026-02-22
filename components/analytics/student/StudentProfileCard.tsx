// components/analytics/student/StudentProfileCard.tsx
'use client';

import { FiMail, FiPhone, FiMapPin, FiCalendar, FiAward, FiTrendingUp } from 'react-icons/fi';

interface StudentProfileCardProps {
  student: {
    id: string;
    name: string;
    email: string;
    grade: string;
    school: string;
    profileImage?: string;
    streak: number;
    level: number;
    totalPoints: number;
    lastActivity?: Date;
  };
}

export function StudentProfileCard({ student }: StudentProfileCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
          {student.profileImage ? (
            <img 
              src={student.profileImage} 
              alt={student.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            student.name.charAt(0).toUpperCase()
          )}
        </div>

        {/* Informações */}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {student.name}
          </h2>
          
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FiMail className="h-4 w-4" />
              <span>{student.email}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FiMapPin className="h-4 w-4" />
              <span>{student.school} • {student.grade}</span>
            </div>
            
            {student.lastActivity && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FiCalendar className="h-4 w-4" />
                <span>Última atividade: {student.lastActivity.toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Rápidas */}
        <div className="flex gap-4">
          <div className="text-center">
            <div className="flex items-center gap-1 text-2xl font-bold text-yellow-500">
              <FiAward />
              <span>{student.streak}</span>
            </div>
            <span className="text-xs text-gray-500">Streak</span>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">
              {student.level}
            </div>
            <span className="text-xs text-gray-500">Nível</span>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">
              {student.totalPoints}
            </div>
            <span className="text-xs text-gray-500">Pontos</span>
          </div>
        </div>
      </div>
    </div>
  );
}