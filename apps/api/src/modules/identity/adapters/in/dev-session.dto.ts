import { IsEmail, IsOptional, IsUUID } from 'class-validator';

/** Body for the DEV-ONLY session endpoint that mints a local token. */
export class DevSessionDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsEmail()
  email!: string;
}
