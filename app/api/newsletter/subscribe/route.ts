import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build_time');

// Schema de validación
const SubscribeSchema = z.object({
  email: z.string().email('Email inválido'),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional().default('weekly'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar input
    const validation = SubscribeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, frequency } = validation.data;

    // Crear o actualizar suscriptor
    const subscriber = await prisma.emailSubscriber.upsert({
      where: { email },
      update: {
        subscribed: true, // Reactivar si estaba desuscrito
        updatedAt: new Date(),
      },
      create: {
        email,
        frequency,
        subscribed: true,
        unsubscribeToken: randomBytes(32).toString('hex'),
      },
    });

    try {
      await resend.emails.send({
        from: 'Humanity Ledger <newsletter@humanidfi.com>',
        to: 'humanityledger@humanidfi.es',
        subject: 'New Newsletter Subscriber',
        text: `A new user has subscribed to the newsletter!\n\nEmail: ${email}\nFrequency: ${frequency}\n\nPlease add them to the mailing list.`,
      });
      console.log(`Successfully routed newsletter subscription for ${email} to humanityledger@humanidfi.es`);
    } catch (emailError) {
      console.error('Error sending newsletter routing email:', emailError);
      // We don't fail the request if the email sending fails, just log it.
    }

    return NextResponse.json({
      success: true,
      message: '¡Suscripción exitosa!',
      subscriber: {
        email: subscriber.email,
        status: 'active'
      }
    });

  } catch (error: any) {
    console.error('Newsletter error:', error);
    return NextResponse.json(
      { error: 'Error al procesar la suscripción' },
      { status: 500 }
    );
  }
}
