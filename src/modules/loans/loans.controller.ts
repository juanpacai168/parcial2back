import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
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
import { CreateLoanDto } from './dto/create-loan.dto';
import { FindLoansDto } from './dto/find-loans.dto';
import { LoanBasicDto } from './dto/loan-basic.dto';
import { LoanDetailDto } from './dto/loan-detail.dto';
import { LoansService } from './loans.service';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @Post()
  @ApiCreatedResponse({ type: LoanDetailDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  create(@Body() dto: CreateLoanDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.loansService.create(dto, actor);
  }

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN, UserRole.MEMBER)
  @Get()
  @ApiOkResponse({ type: [LoanBasicDto] })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  findAll(@Query() query: FindLoansDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.loansService.findAll(query, actor);
  }

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN, UserRole.MEMBER)
  @Get(':id')
  @ApiOkResponse({ type: LoanDetailDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.loansService.findById(id, actor);
  }

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @Patch(':id/return')
  @ApiOkResponse({ type: LoanDetailDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  returnLoan(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loansService.returnLoan(id, actor);
  }

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @Patch(':id/mark-lost')
  @ApiOkResponse({ type: LoanDetailDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  markLost(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.loansService.markLost(id);
  }
}
