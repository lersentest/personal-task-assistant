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

@Controller('api/executors')
@UseGuards(SupabaseAuthGuard)
export class ExecutorsController {
  constructor(private readonly executors: ExecutorsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.executors.list(request.user.id);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.executors.getOwned(request.user.id, id);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseDto(createExecutorSchema, body);
    return this.executors.create(request.user.id, input);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(updateExecutorSchema, body);
    return this.executors.update(request.user.id, id, input);
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
