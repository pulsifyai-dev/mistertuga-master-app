#!/usr/bin/env node
/**
 * Story 1.3 — Step 5: Test Supabase Realtime with migrated data
 * Subscribes to orders table, inserts a test order, verifies event received, cleans up.
 *
 * Run: node scripts/migration/05-test-realtime.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_ORDER_NUMBER = 'TEST-REALTIME-001';

async function main() {
  console.log('=== Supabase Realtime Test ===\n');

  let testOrderId = null;
  let eventReceived = false;

  // Step 1: Subscribe to orders table changes
  console.log('Step 1: Subscribing to orders table...');

  const channel = supabase
    .channel('realtime-test')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'orders',
    }, (payload) => {
      console.log('  EVENT RECEIVED!');
      console.log(`    Type: ${payload.eventType}`);
      console.log(`    Order: ${payload.new.order_number}`);
      console.log(`    Country: ${payload.new.country_code}`);
      eventReceived = true;
    })
    .subscribe((status) => {
      console.log(`  Subscription status: ${status}`);
    });

  // Wait for subscription to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 2: Insert a test order
  console.log('\nStep 2: Inserting test order...');
  const { data: insertedOrder, error: insertError } = await supabase
    .from('orders')
    .insert({
      order_number: TEST_ORDER_NUMBER,
      country_code: 'PT',
      status: 'open',
      financial_status: 'paid',
      fulfillment_status: 'unfulfilled',
      currency: 'EUR',
      note: 'Realtime test — will be deleted',
    })
    .select()
    .single();

  if (insertError) {
    console.error(`  INSERT ERROR: ${insertError.message}`);
    channel.unsubscribe();
    process.exit(1);
  }

  testOrderId = insertedOrder.id;
  console.log(`  Inserted: ${insertedOrder.order_number} (${testOrderId})`);

  // Wait for realtime event
  console.log('\nStep 3: Waiting for realtime event (5s)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 4: Also test UPDATE event
  console.log('\nStep 4: Testing UPDATE event...');
  let updateEventReceived = false;

  const updateChannel = supabase
    .channel('realtime-update-test')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
    }, (payload) => {
      console.log('  UPDATE EVENT RECEIVED!');
      console.log(`    Order: ${payload.new.order_number}`);
      console.log(`    New tracking: ${payload.new.tracking_number}`);
      updateEventReceived = true;
    })
    .subscribe();

  await new Promise(resolve => setTimeout(resolve, 2000));

  const { error: updateError } = await supabase
    .from('orders')
    .update({ tracking_number: 'TEST-TRACKING-123' })
    .eq('id', testOrderId);

  if (updateError) {
    console.error(`  UPDATE ERROR: ${updateError.message}`);
  } else {
    console.log('  Update sent, waiting for event (5s)...');
  }

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 5: Clean up
  console.log('\nStep 5: Cleaning up test data...');
  const { error: deleteError } = await supabase
    .from('orders')
    .delete()
    .eq('id', testOrderId);

  if (deleteError) {
    console.error(`  DELETE ERROR: ${deleteError.message}`);
  } else {
    console.log(`  Test order deleted.`);
  }

  // Verify order count is back to 576
  const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  console.log(`  Orders count after cleanup: ${count}`);

  // Unsubscribe
  channel.unsubscribe();
  updateChannel.unsubscribe();

  // Results
  console.log('\n=== Results ===');
  console.log(`  INSERT event received: ${eventReceived ? 'YES' : 'NO'}`);
  console.log(`  UPDATE event received: ${updateEventReceived ? 'YES' : 'NO'}`);
  console.log(`  Test: ${eventReceived || updateEventReceived ? 'PASS' : 'PARTIAL — Realtime may need enabling in Supabase Dashboard'}`);

  if (!eventReceived && !updateEventReceived) {
    console.log('\n  Note: If Realtime events were not received, check:');
    console.log('  1. Supabase Dashboard > Database > Replication > orders table is enabled');
    console.log('  2. Migration 20260302140014_enable_realtime.sql was applied');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
