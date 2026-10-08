import { getSession } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { isAdmin } from '@/lib/admin';

/**
 * GET /api/admin/emails - Ver todos los correos registrados
 * 
 * Requiere autenticación de administrador
 * 
 * Query params:
 *   ?source=authuser|subscriber  - Filtrar por fuente
 *   ?export=csv                  - Exportar como CSV
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const address = session?.userId;
    if (!isAdmin(address)) {
      return NextResponse.json({ error: 'Unauthorized: System Admin Only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const exportFormat = searchParams.get('export');

    // Obtener usuarios registrados
    const authUsers = source !== 'subscriber' ? await prisma.authUser.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    }) : [];

    // Obtener suscriptores
    const subscribers = source !== 'authuser' ? await prisma.emailSubscriber.findMany({
      select: {
        id: true,
        email: true,
        subscribed: true,
        frequency: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    }) : [];

    // Consolidar emails únicos
    const allEmails = new Set([
      ...authUsers.map(u => u.email),
      ...subscribers.map(s => s.email)
    ]);

    // Estadísticas
    const stats = {
      totalUniqueEmails: allEmails.size,
      authUsers: {
        total: authUsers.length,
        verified: authUsers.length,
        pending: 0,
      },
      subscribers: {
        total: subscribers.length,
        active: subscribers.filter(s => s.subscribed).length,
        inactive: subscribers.filter(s => !s.subscribed).length,
      },
    };

    // Exportar como CSV si se solicita
    if (exportFormat === 'csv') {
      const csvRows = [
        'Email,Fuente,Nombre,Estado,Fecha',
        ...authUsers.map(u => 
          `${u.email},AuthUser,N/A,Verified,${u.createdAt.toISOString()}`
        ),
        ...subscribers.map(s => 
          `${s.email},EmailSubscriber,N/A,${s.subscribed ? 'Active' : 'Unsubscribed'},${s.createdAt.toISOString()}`
        )
      ].join('\n');

      return new NextResponse(csvRows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="emails-${Date.now()}.csv"`,
        },
      });
    }

    // Retornar JSON
    return NextResponse.json({
      success: true,
      stats,
      data: {
        authUsers: authUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: 'N/A',
          source: 'AuthUser',
          status: 'Verified',
          date: u.createdAt,
        })),
        subscribers: subscribers.map(s => ({
          id: s.id,
          email: s.email,
          name: 'N/A',
          source: 'EmailSubscriber',
          status: s.subscribed ? 'Active' : 'Unsubscribed',
          frequency: s.frequency,
          date: s.createdAt,
        })),
      },
    });

  } catch (error: any) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: 'Error details redacted' },
      { status: 500 }
    );
  }
}

