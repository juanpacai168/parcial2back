import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class CreateLoanDto {
  @ApiProperty()
  @IsUUID()
  itemId!: string;

  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsDateString()
  dueAt!: string;
}
