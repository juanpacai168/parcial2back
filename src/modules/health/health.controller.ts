import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe - el servicio esta vivo' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe - el servicio puede atender requests' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  ready(): { status: string } {
    return { status: 'ok' };
  }
}
