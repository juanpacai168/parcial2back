import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { FindItemsDto } from './dto/find-items.dto';
import { ItemBasicDto } from './dto/item-basic.dto';
import { ItemDetailDto } from './dto/item-detail.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemsService } from './items.service';

@ApiTags('items')
@ApiBearerAuth()
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN, UserRole.MEMBER)
  @Get()
  @ApiOkResponse({ type: [ItemBasicDto] })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  findAll(@Query() query: FindItemsDto) {
    return this.itemsService.findAll(query);
  }

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN, UserRole.MEMBER)
  @Get(':id')
  @ApiOkResponse({ type: ItemDetailDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.itemsService.findDetailById(id);
  }

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @Post()
  @ApiCreatedResponse({ type: ItemDetailDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse()
  create(@Body() dto: CreateItemDto) {
    return this.itemsService.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @Patch(':id')
  @ApiOkResponse({ type: ItemDetailDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateItemDto) {
    return this.itemsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.itemsService.softDelete(id);
  }
}
