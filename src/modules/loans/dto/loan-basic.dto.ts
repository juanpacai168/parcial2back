import { ApiProperty } from '@nestjs/swagger';
import { LoanStatus } from '../entities/loan.entity';

export class LoanBasicDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  itemId!: string;

  @ApiProperty()
  loanedAt!: Date;

  @ApiProperty()
  dueAt!: Date;

  @ApiProperty({ nullable: true })
  returnedAt!: Date | null;

  @ApiProperty({ enum: LoanStatus })
  status!: LoanStatus;

  @ApiProperty()
  fineAmount!: number;
}
