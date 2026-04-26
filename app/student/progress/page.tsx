// app/student/progress/page.tsx
'use client';

import React from 'react';
import ProgressTracking from '@/components/student/ProgressTracking';

export default function ProgressPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Conteúdo Principal */}
      <main className='p-4 md:p-6'>
        <ProgressTracking />
      </main>
    </div>
  );
}