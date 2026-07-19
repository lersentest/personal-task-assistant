import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ExecutorsService } from '../executors/executors.service';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import {
  createExecutorSchema,
  parseDto,
  updateExecutorSchema,
} from './dto';
import { jsonSafe } from './json-safe';

@Controller('api/executors')
@UseGuards(SupabaseAuthGuard)
export class ExecutorsController {
  constructor(private readonly executors: ExecutorsService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return jsonSafe(await this.executors.list(request.user.id));
  }

  @Get(':id')
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return jsonSafe(await this.executors.getOwned(request.user.id, id));
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseDto(createExecutorSchema, body);
    return jsonSafe(await this.executors.create(request.user.id, input));
  }

  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(updateExecutorSchema, body);
    return jsonSafe(await this.executors.update(request.user.id, id, input));
  }

  @Delete(':id')
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.executors.softDelete(request.user.id, id);
    return { ok: true };
  }

  @Post(':id/invite')
  invite(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.executors.createInvite(request.user.id, id);
  }

  @Post(':id/invite/regenerate')
  regenerateInvite(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.executors.createInvite(request.user.id, id);
  }

  @Post(':id/invite/revoke')
  async revokeInvite(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    await this.executors.revokeInvite(request.user.id, id);
    return { ok: true };
  }
}
