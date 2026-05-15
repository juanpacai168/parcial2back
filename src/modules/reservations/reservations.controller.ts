import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { FindReservationsDto } from './dto/find-reservations.dto';
import { ReservationBasicDto } from './dto/reservation-basic.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Roles(UserRole.MEMBER)
  @Post()
  @ApiCreatedResponse({ type: ReservationBasicDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  create(@Body() dto: CreateReservationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.reservationsService.create(dto, actor);
  }

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN, UserRole.MEMBER)
  @Get()
  @ApiOkResponse({ type: [ReservationBasicDto] })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  findAll(@Query() query: FindReservationsDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.reservationsService.findAll(query, actor);
  }

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN, UserRole.MEMBER)
  @Delete(':id')
  @ApiOkResponse({ type: ReservationBasicDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  cancel(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.reservationsService.cancel(id, actor);
  }
}
