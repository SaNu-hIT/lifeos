import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class StartConversationDto {
  @IsOptional()
  @IsString()
  title?: string;
}

export class ConfirmationDto {
  @IsString()
  toolName!: string;

  @IsString()
  token!: string;
}

export class SendMessageDto {
  @IsString()
  content!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmationDto)
  confirmation?: ConfirmationDto;
}
