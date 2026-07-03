import { Body, Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { Post } from '@nestjs/common';
import type { ApiResponse, AuthUser } from '@lifeos/contracts';
import { ok } from '../../../../shared/http/envelope.js';
import { AuthGuard } from '../../../identity/adapters/in/auth.guard.js';
import { CurrentUser } from '../../../identity/adapters/in/current-user.decorator.js';
import { CONVERSATION, type ConversationPort } from '../../../conversation/domain/ports/conversation.port.js';
import { ORCHESTRATOR, type OrchestratorPort, type TurnResult } from '../../domain/ports/orchestrator.port.js';
import { SendMessageDto, StartConversationDto } from './dtos.js';

@Controller({ path: 'conversations', version: '1' })
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(
    @Inject(CONVERSATION) private readonly conversation: ConversationPort,
    @Inject(ORCHESTRATOR) private readonly orchestrator: OrchestratorPort,
  ) {}

  @Post()
  async start(
    @CurrentUser() user: AuthUser,
    @Body() dto: StartConversationDto,
  ): Promise<ApiResponse<{ id: string }>> {
    return ok(await this.conversation.start(user.id, dto.title));
  }

  @Post(':id/messages')
  async send(
    @Param('id') conversationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto,
  ): Promise<ApiResponse<TurnResult>> {
    return ok(
      await this.orchestrator.handleTurn({
        userId: user.id,
        conversationId,
        content: dto.content,
        confirmation: dto.confirmation,
        clarification: dto.clarification,
      }),
    );
  }

  @Get(':id/messages')
  async history(
    @Param('id') conversationId: string,
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<ApiResponse<unknown>> {
    return ok(
      await this.conversation.history(user.id, conversationId, {
        limit: limit ? Number(limit) : undefined,
        cursor,
      }),
    );
  }
}
