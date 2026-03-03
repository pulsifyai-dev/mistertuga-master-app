import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

const exchangePayloadSchema = z.object({
  order_number: z.string().min(1, 'order_number is required'),
  customer_name: z.string().min(1, 'customer_name is required'),
  customer_email: z.string().email().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  customer_address: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  received_description: z.string().optional().nullable(),
  original_email_text: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  // 1. API key authentication
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Rate limiting (100 requests per hour per IP)
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const { success: withinLimit } = rateLimit(
    `webhook:exchanges:${ip}`,
    100,
    60 * 60 * 1000
  );
  if (!withinLimit) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  // 3. Parse and validate payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const parsed = exchangePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const supabase = createServiceClient();

  // 4. Duplicate detection (same order_number within last 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('exchanges')
    .select('*')
    .eq('order_number', data.order_number)
    .gte('created_at', tenMinutesAgo)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json(
      { message: 'Duplicate detected', exchange: existing },
      { status: 200 }
    );
  }

  // 5. Order auto-linking (lookup order by order_number)
  let orderId: string | null = null;
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('order_number', data.order_number)
    .limit(1)
    .single();

  if (order) {
    orderId = order.id;
  }

  // 6. Insert exchange record
  const { data: exchange, error } = await supabase
    .from('exchanges')
    .insert({
      order_id: orderId,
      order_number: data.order_number,
      customer_name: data.customer_name,
      customer_email: data.customer_email ?? null,
      customer_phone: data.customer_phone ?? null,
      customer_address: data.customer_address ?? null,
      reason: data.reason ?? null,
      received_description: data.received_description ?? null,
      original_email_text: data.original_email_text ?? null,
      source: 'email',
      status: 'new',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to insert exchange:', error);
    return NextResponse.json(
      { error: 'Failed to create exchange record' },
      { status: 500 }
    );
  }

  return NextResponse.json({ exchange }, { status: 201 });
}
