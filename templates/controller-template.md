---
title: Controller Template
status: Authoritative
version: 1.0.0
type: template
---

# Controller Template (Inbound Adapter)

> Copy this for an HTTP controller. Controllers are **thin inbound adapters**: validate input, invoke an application command/query, map the result to a DTO. **No business logic.**

References: [10 API Standard](../docs/10_API_STANDARD.md) · [03 §5 Error model](../docs/03_LifeOS_Engineering_Handbook.md)

## Stub

```ts
@Controller({ path: 'conversations', version: '1' })
export class ConversationsController {
  constructor(
    private readonly sendMessage: SendMessageCommandHandler,
    private readonly getMessages: GetMessagesQueryHandler,
  ) {}

  @Post(':id/messages')
  async send(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,          // validated by class-validator/zod
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') key?: string,
  ): Promise<ApiResponse<TurnResultDto>> {
    const result = await this.sendMessage.execute({ conversationId: id, userId: user.id, content: dto.content, idempotencyKey: key });
    return ok(toTurnResultDto(result));   // standard success envelope
  }

  @Get(':id/messages')
  async list(@Param('id') id: string, @Query() q: PageQueryDto, @CurrentUser() user: AuthUser) {
    return ok(await this.getMessages.execute({ conversationId: id, userId: user.id, ...q }));
  }
}
```

## Rules checklist

- [ ] No business logic — delegate to an application handler.
- [ ] Input validated via DTO ([10 §6](../docs/10_API_STANDARD.md)); never trust the client.
- [ ] Auth via guard; `@CurrentUser()` provides identity; capability checks happen in the Permission Engine/handler.
- [ ] Returns the **standard envelope** (`ok()` / error filter → `LifeOSError`).
- [ ] URL-versioned; `camelCase` JSON; idempotency header honored for mutations.
- [ ] No DB/provider access in the controller.

## Tests

- [ ] E2E for each route (auth, validation failure, success, permission denied).
- [ ] DTO validation unit tests.

## Definition of Done

- [ ] Routes documented in OpenAPI (generated from DTOs).
- [ ] Error envelope verified; status codes per [10 §3](../docs/10_API_STANDARD.md).
- [ ] Tests green; docs updated.

## Future extension points

- BFF aggregation; rate-limit decorators; realtime equivalents.
