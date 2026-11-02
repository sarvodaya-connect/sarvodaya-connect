import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Earlier turns, kept short so a follow-up stays cheap. */
export class AssistantTurnDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}

export class AskAssistantDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AssistantTurnDto)
  history?: AssistantTurnDto[];
}
