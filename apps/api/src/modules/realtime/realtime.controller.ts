import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '@lifeos/contracts';
import { AuthGuard } from '../identity/adapters/in/auth.guard.js';
import { CurrentUser } from '../identity/adapters/in/current-user.decorator.js';
import { RealtimeHub, type RealtimeMessage } from './realtime.hub.js';

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream of the authenticated user's live updates (phase 29). SSE
 * (not WebSocket) keeps it a plain HTTP GET behind the same auth/guards as the rest of
 * the API; the browser's EventSource reconnects automatically. Each event is one
 * `data: <json>` frame; a periodic comment heartbeat keeps intermediaries from idling
 * the connection shut.
 */
@Controller({ path: 'realtime', version: '1' })
@UseGuards(AuthGuard)
export class RealtimeController {
  constructor(private readonly hub: RealtimeHub) {}

  @Get('stream')
  stream(@CurrentUser() user: AuthUser, @Req() req: Request, @Res() res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable proxy buffering (nginx)
    });
    res.write('retry: 3000\n\n'); // client reconnect backoff
    res.write(': connected\n\n');

    const send = (message: RealtimeMessage): void => {
      res.write(`event: ${message.type}\n`);
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    };
    const unsubscribe = this.hub.subscribe(user.id, send);

    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  }
}
