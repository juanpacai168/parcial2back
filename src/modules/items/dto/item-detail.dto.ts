import { ApiProperty } from '@nestjs/swagger';
import { ItemType } from '../entities/item.entity';

export class ItemDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: ItemType })
  type!: ItemType;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  isAvailable!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
