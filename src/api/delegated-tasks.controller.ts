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

@Controller('api/delegated-tasks')
@UseGuards(SupabaseAuthGuard)
export class DelegatedTasksController {
  constructor(private readonly delegatedTasks: DelegatedTasksService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const filters = parseDto(listDelegatedTasksSchema, query);
    return this.delegatedTasks.list(request.user.id, filters);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.delegatedTasks.getOwned(request.user.id, id);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseDto(createDelegatedTaskSchema, body);
    return this.delegatedTasks.create(request.user.id, {
      ...input,
      dueAt: optionalDate(input.dueAt),
    });
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(updateDelegatedTaskSchema, body);
    return this.delegatedTasks.update(request.user.id, id, {
      ...input,
      dueAt: optionalDate(input.dueAt),
    });
  }

  @Delete(':id')
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.delegatedTasks.softDelete(request.user.id, id);
    return { ok: true };
  }

  @Post(':id/send')
  send(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.delegatedTasks.send(request.user.id, id);
  }

  @Post(':id/remind')
  remind(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.delegatedTasks.remind(request.user.id, id);
  }

  @Post(':id/cancel')
  cancel(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.delegatedTasks.update(request.user.id, id, {
      status: 'CANCELLED',
    });
  }

  @Post(':id/review/accept')
  acceptReview(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(reviewDelegatedTaskSchema, body);
    return this.delegatedTasks.ownerReview(
      request.user.id,
      id,
      'accept',
      input.message ?? undefined,
    );
  }

  @Post(':id/review/return')
  returnReview(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(reviewDelegatedTaskSchema, body);
    return this.delegatedTasks.ownerReview(
      request.user.id,
      id,
      'return',
      input.message ?? undefined,
    );
  }

  @Get(':id/comments')
  async comments(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const task = await this.delegatedTasks.getOwned(request.user.id, id);
    return task.comments;
  }

  @Post(':id/comments')
  comment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(delegatedCommentSchema, body);
    return this.delegatedTasks.ownerComment(request.user.id, id, input.message);
  }
}
