import { ApiProperty } from '@nestjs/swagger';
import { UserBasicDto } from '../../users/dto/user-basic.dto';

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ type: UserBasicDto })
  user!: UserBasicDto;
}
