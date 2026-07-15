import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DelegatedTasksService } from '../delegated-tasks/delegated-tasks.service';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import {
  createDelegatedTaskSchema,
  delegatedCommentSchema,
  listDelegatedTasksSchema,
  optionalDate,
  parseDto,
  reviewDelegatedTaskSchema,
  updateDelegatedTaskSchema,
} from './dto';
import { jsonSafe } from './json-safe';

@Controller('api/delegated-tasks')
@UseGuards(SupabaseAuthGuard)
export class DelegatedTasksController {
  constructor(private readonly delegatedTasks: DelegatedTasksService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const filters = parseDto(listDelegatedTasksSchema, query);
    return jsonSafe(await this.delegatedTasks.list(request.user.id, filters));
  }

  @Get(':id')
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return jsonSafe(await this.delegatedTasks.getOwned(request.user.id, id));
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseDto(createDelegatedTaskSchema, body);
    return jsonSafe(await this.delegatedTasks.create(request.user.id, {
      ...input,
      dueAt: optionalDate(input.dueAt),
    }));
  }

  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(updateDelegatedTaskSchema, body);
    return jsonSafe(await this.delegatedTasks.update(request.user.id, id, {
      ...input,
      dueAt: optionalDate(input.dueAt),
    }));
  }

  @Delete(':id')
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.delegatedTasks.softDelete(request.user.id, id);
    return { ok: true };
  }

  @Post(':id/send')
  async send(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return jsonSafe(await this.delegatedTasks.send(request.user.id, id));
  }

  @Post(':id/remind')
  async remind(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return jsonSafe(await this.delegatedTasks.remind(request.user.id, id));
  }

  @Get(':id/public-link')
  async publicLink(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.delegatedTasks.publicLink(request.user.id, id);
  }

  @Post(':id/public-link/regenerate')
  async regeneratePublicLink(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.delegatedTasks.regeneratePublicLink(request.user.id, id);
  }

  @Post(':id/public-link/revoke')
  async revokePublicLink(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    await this.delegatedTasks.revokePublicLink(request.user.id, id);
    return { ok: true };
  }

  @Post(':id/cancel')
  async cancel(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return jsonSafe(await this.delegatedTasks.update(request.user.id, id, {
      status: 'CANCELLED',
    }));
  }

  @Post(':id/review/accept')
  async acceptReview(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(reviewDelegatedTaskSchema, body);
    return jsonSafe(await this.delegatedTasks.ownerReview(
      request.user.id,
      id,
      'accept',
      input.message ?? undefined,
    ));
  }

  @Post(':id/review/return')
  async returnReview(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(reviewDelegatedTaskSchema, body);
    return jsonSafe(await this.delegatedTasks.ownerReview(
      request.user.id,
      id,
      'return',
      input.message ?? undefined,
    ));
  }

  @Get(':id/comments')
  async comments(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const task = await this.delegatedTasks.getOwned(request.user.id, id);
    return task.comments;
  }

  @Post(':id/comments')
  async comment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(delegatedCommentSchema, body);
    return jsonSafe(
      await this.delegatedTasks.ownerComment(request.user.id, id, input.message),
    );
  }
}
