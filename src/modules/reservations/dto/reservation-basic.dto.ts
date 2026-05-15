import { ApiProperty } from '@nestjs/swagger';

export class ReservationBasicDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  itemId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  fulfilledAt!: Date | null;

  @ApiProperty({ nullable: true })
  cancelledAt!: Date | null;

  @ApiProperty({ nullable: true })
  expiresAt!: Date | null;
}
