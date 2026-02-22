// components/analytics/common/ExportButton.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDownload, FiFileText, FiTable, FiLoader } from 'react-icons/fi';

interface ExportButtonProps {
  onExportPDF: () => Promise<void>;
  onExportCSV: () => Promise<void>;
  isExporting?: boolean;
}

export function ExportButton({ onExportPDF, onExportCSV, isExporting }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleExport = async (format: 'pdf' | 'csv') => {
    setIsOpen(false);
    if (format === 'pdf') {
      await onExportPDF();
    } else {
      await onExportCSV();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExporting ? (
          <FiLoader className="h-4 w-4 animate-spin" />
        ) : (
          <FiDownload className="h-4 w-4" />
        )}
        <span>Exportar</span>
      </button>

      <AnimatePresence>
        {isOpen && !isExporting && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
          >
            <button
              onClick={() => handleExport('pdf')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <FiFileText className="h-4 w-4" />
              <span>Exportar como PDF</span>
            </button>
            
            <button
              onClick={() => handleExport('csv')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-200 dark:border-gray-700"
            >
              <FiTable className="h-4 w-4" />
              <span>Exportar como CSV</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}