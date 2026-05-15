import { ApiProperty } from '@nestjs/swagger';
import { ItemBasicDto } from '../../items/dto/item-basic.dto';
import { UserBasicDto } from '../../users/dto/user-basic.dto';
import { LoanStatus } from '../entities/loan.entity';

export class LoanDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: UserBasicDto })
  user!: UserBasicDto;

  @ApiProperty({ type: ItemBasicDto })
  item!: ItemBasicDto;

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

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
