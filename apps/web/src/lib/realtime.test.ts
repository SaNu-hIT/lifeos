import { describe, expect, it } from 'vitest';
import { parseRealtimeMessage } from './realtime';

describe('realtime message parsing', () => {
  it('parses a valid frame', () => {
    const msg = parseRealtimeMessage(
      JSON.stringify({ type: 'grocery.order_placed', payload: { orderId: 'o1' }, occurredAt: '2026-07-01T12:00:00Z' }),
    );
    expect(msg).toMatchObject({ type: 'grocery.order_placed', occurredAt: '2026-07-01T12:00:00Z' });
  });

  it('rejects malformed frames', () => {
    expect(parseRealtimeMessage('not json')).toBeNull();
    expect(parseRealtimeMessage(JSON.stringify({ payload: {} }))).toBeNull(); // no type/occurredAt
  });
});
