// components/layout/StudentNavbar.tsx
// components/layout/StudentNavbar.tsx
'use client';

import { useState } from 'react';
import {
  FaBars,
  FaSignOutAlt,
  FaBell,
  FaHome,
  FaTrophy,
  FaBrain,
  FaQuestionCircle,
  FaSearch,
  FaTimes // Adicione este ícone
} from 'react-icons/fa';
import { FaRankingStar } from 'react-icons/fa6';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Student } from '@/types/auth';

interface StudentNavbarProps {
  toggleSidebar: () => void;
  sidebarOpen: boolean; // Mudamos de sidebarCollapsed para sidebarOpen
  isMobile: boolean;
}

export default function StudentNavbar({
  toggleSidebar,
  sidebarOpen,
  isMobile
}: StudentNavbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);

  if (!user || user.role !== 'student') return null;

  const student = user as Student;

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair?')) {
      try {
        await logout();
        router.push('/student-login');
      } catch (error) {
        console.error('Erro ao fazer logout:', error);
      }
    }
  };

  // Dados mock para demonstração
  const notifications = [
    { id: 1, title: 'Você ganhou 50 pontos!', read: false, time: '5 min' },
    { id: 2, title: 'Nova atividade disponível', read: true, time: '1h' },
    { id: 3, title: 'Parabéns! Você alcançou nível 3', read: false, time: '1 dia' },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-20 bg-gradient-to-r from-purple-700 via-purple-600 to-purple-700 h-16 shadow-lg shadow-purple-900/20 border-b border-white/10">
      <div className="w-full h-full px-4 md:px-6 flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Sidebar Toggle - diferente para mobile/desktop */}
          <button
            onClick={toggleSidebar}
            title={sidebarOpen ? "Fechar menu" : "Abrir menu"}
            className={`
              p-2 rounded-xl transition-all duration-200 
              hover:scale-105 active:scale-95
              ${isMobile
                ? 'bg-white/20 text-white hover:bg-white/30'
                : 'bg-white/15 text-white hover:bg-white/25'
              }
            `}
          >
            {isMobile && sidebarOpen ? (
              <FaTimes className="w-5 h-5" />
            ) : (
              <FaBars className="w-5 h-5" />
            )}
          </button>

          {/* Logo/Brand */}
          <Link
            href="/student/dashboard"
            className="flex items-center gap-3 transition-opacity hover:opacity-90 active:opacity-80"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
              <FaBrain className="w-5 h-5 text-white" />
            </div>
            <div className="hidden md:block">
              <div className="text-lg font-bold text-white leading-tight">Nexus</div>
              <div className="text-xs text-purple-200 font-semibold">Student</div>
            </div>
          </Link>

          {/* Student Badge */}
          <div className="hidden lg:inline-block px-3 py-1.5 bg-white/20 text-white text-xs font-semibold rounded-full border border-white/30">
            Área do Aluno
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Points Display */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/15 rounded-full border border-white/20">
            <FaTrophy className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-white text-sm font-semibold">
              {student.profile?.totalPoints || 0} pontos
            </span>
          </div>

          {/* Level Display */}
          <div className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-white/10 rounded-full">
            <FaRankingStar className="w-3.5 h-3.5 text-emerald-300" />
            <span className="text-white text-sm font-semibold">
              Nível {student.profile?.level || 1}
            </span>
          </div>

          {/**  Notifications */}
          <div className="relative">
            {/**
            <button
              className="p-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white 
                       transition-all duration-200 hover:-translate-y-0.5 relative"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notificações"
            >
              <FaBell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button> */}

            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-20 overflow-hidden animate-fade-in">
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800">Notificações</h3>
                      <span className="text-xs text-gray-500">{notifications.length} total</span>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map(notification => (
                      <div
                        key={notification.id}
                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer
                                  ${!notification.read ? 'bg-blue-50/50' : ''}`}
                        onClick={() => {/* Marcar como lida */ }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">{notification.title}</div>
                            <div className="text-xs text-gray-500 mt-1">{notification.time}</div>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 border-t border-gray-100">
                    <Link
                      href="/student/notifications"
                      className="block text-center text-sm text-purple-600 hover:text-purple-700 font-medium"
                      onClick={() => setShowNotifications(false)}
                    >
                      Ver todas as notificações
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Avatar & Logout */}
          <div className="flex items-center gap-2">
            {/* User Avatar */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 
                          flex items-center justify-center text-white font-bold text-sm shadow-md">
              {student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}