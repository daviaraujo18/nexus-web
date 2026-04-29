// ROTA TEMPORÁRIA — remover após uso
// Uso:
//   dryRun:  GET /api/admin/recalculate-metrics?studentId=3uF7D7WG8tdXR5Edj9TMI2GkwnH3&dryRun=true
//   write:   GET /api/admin/recalculate-metrics?studentId=3uF7D7WG8tdXR5Edj9TMI2GkwnH3
import { NextRequest, NextResponse } from 'next/server';
import { ProgressService } from '@/lib/services/ProgressService';

export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get('studentId');
  const dryRun = req.nextUrl.searchParams.get('dryRun') !== 'false';

  if (!studentId) {
    return NextResponse.json({ error: 'studentId obrigatório' }, { status: 400 });
  }

  try {
    const result = await ProgressService.recalculateStudentPermanentMetrics(
      studentId,
      { dryRun }
    );
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[recalculate-metrics route] Erro:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
