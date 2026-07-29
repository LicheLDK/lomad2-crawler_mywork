import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * POST /search-jobs/:id/callback/resend 응답.
 * 이미 성공한 callback 은 409 Conflict (중복 전송 없음).
 */
export class ResendCallbackResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  jobId!: string;

  @ApiProperty({
    description: '재전송 성공 여부. 성공 시에만 true',
    example: true,
  })
  resent!: boolean;

  @ApiProperty({
    description: 'BackOffice callback 전송 시각',
    example: '2026-07-29T07:00:00.000Z',
  })
  callbackSentAt!: Date;

  @ApiPropertyOptional({
    nullable: true,
    description: '성공 시 항상 null',
    example: null,
  })
  callbackError!: null;
}
