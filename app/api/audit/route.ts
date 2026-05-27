// app/api/audit/route.ts
// API Route que usa o Admin SDK para gravar audit logs sem restrição de regras
// do Firestore. Necessário para eventos pré-autenticação (ex.: REGISTRATION_FAILED).

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface AuditLogPayload {
  eventType: string;
  email?: string;
  userId?: string;
  userType?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body: AuditLogPayload = await request.json();

    if (!body.eventType) {
      return NextResponse.json(
        { error: 'eventType é obrigatório' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    if (!db) {
      // Admin SDK não configurado (ex.: dev sem service account).
      // Retornar 200 para não quebrar o fluxo cliente — audit é best-effort.
      console.warn('[audit] Admin SDK indisponível — evento não gravado:', body.eventType);
      return NextResponse.json({ ok: false, reason: 'admin-sdk-unavailable' }, { status: 200 });
    }

    // Capturar IP real via headers (Vercel / proxies reversos)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

    await db.collection('auditLogs').add({
      ...body,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
      environment: process.env.NODE_ENV,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('[audit] API Route error:', error);
    // Retornar 200 intencionalmente: falha de log nunca deve quebrar o fluxo cliente
    return NextResponse.json({ ok: false, error: 'log failed' }, { status: 200 });
  }
}
