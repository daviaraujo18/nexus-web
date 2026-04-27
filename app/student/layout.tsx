// app/student/layout.tsx
'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import StudentSidebar from '@/components/layout/StudentSidebar';
import StudentNavbar from '@/components/layout/StudentNavbar';
import { ActivityTimerProvider } from '@/context/ActivityTimerContext';
import FloatingTimer from '@/components/student/FloatingTimer';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ✅ TRAVAR SCROLL DO BODY quando sidebar está aberta no mobile
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      // Salva o scroll position atual
      const scrollY = window.scrollY;
      
      // Adiciona classes para travar o body
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflowY = 'scroll'; // Mantém a scrollbar visível
      
      // Cleanup function
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflowY = '';
        
        // Restaura o scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isMobile, sidebarOpen]);

  // Fechar sidebar ao redimensionar para desktop
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <ActivityTimerProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 lg:flex">
        {/* ✅ Sidebar - Desktop: fixa e altura total */}
        <div className={`lg:fixed lg:inset-y-0 lg:left-0 ${sidebarOpen ? "lg:z-40" : ""}`}>
          <StudentSidebar
            open={sidebarOpen}
            onNavigate={() => setSidebarOpen(false)}
          />
        </div>

        {/* ✅ Main Content - Desktop: margin-left igual à largura da sidebar */}
        <div className={`
          flex-1 flex flex-col min-h-screen
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-0'}
          ${isMobile && sidebarOpen ? 'overflow-hidden h-screen' : ''}
        `}>
          {/* Navbar */}
          <StudentNavbar
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
          />

          {/* Page Content */}
          <main className="flex-1">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-200/70 shadow-sm h-full">
              {children}
              {/* Footer */}
              <footer className="mt-6 text-center text-sm text-gray-500">
                <p className="px-4">
                  Nexus Platform - Saúde Mental & Educação Integradas •
                  <span className="ml-2 text-purple-600 font-medium">Sua evolução importa</span>
                </p>
                <p className="mt-1 text-xs px-4">
                  Em caso de crise, entre em contato com seu profissional de saúde mental
                </p>
              </footer>
            </div>
          </main>
        </div>
      </div>
      <FloatingTimer />
      </ActivityTimerProvider>
    </ProtectedRoute>
  );
}