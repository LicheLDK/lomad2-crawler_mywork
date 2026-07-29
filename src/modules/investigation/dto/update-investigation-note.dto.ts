import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateInvestigationNoteDto {
  @ApiProperty({ example: '수정된 메모 내용' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}
