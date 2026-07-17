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
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import {
  createTaskChecklistItemSchema,
  createTaskSchema,
  listTasksSchema,
  optionalDate,
  parseDto,
  reorderTaskChecklistItemsSchema,
  updateTaskChecklistItemSchema,
  updateTaskSchema,
} from './dto';
import { RemindersService } from '../reminders/reminders.service';
import { TasksService } from '../tasks/tasks.service';

@Controller('api/tasks')
@UseGuards(SupabaseAuthGuard)
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly reminders: RemindersService,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const options = parseDto(listTasksSchema, query);
    return this.tasks.list(request.user.id, {
      ...options,
      timezone: request.user.timezone,
    });
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.tasks.getOwned(request.user.id, id, true);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseDto(createTaskSchema, body);
    return this.tasks.create({
      ownerId: request.user.id,
      createdById: request.user.id,
      assigneeId: request.user.id,
      ...input,
      dueAt: optionalDate(input.dueAt),
      remindAt: optionalDate(input.remindAt),
      sourceType: 'TEXT',
    });
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(updateTaskSchema, body);
    return this.tasks.update(request.user.id, id, {
      ...input,
      dueAt: optionalDate(input.dueAt),
      remindAt: optionalDate(input.remindAt),
    });
  }

  @Post(':id/complete')
  complete(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.tasks.update(request.user.id, id, { status: 'COMPLETED' });
  }

  @Post(':id/checklist-items')
  createChecklistItem(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(createTaskChecklistItemSchema, body);
    return this.tasks.createChecklistItem(request.user.id, id, input.title);
  }

  @Patch(':id/checklist-items/reorder')
  reorderChecklistItems(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(reorderTaskChecklistItemsSchema, body);
    return this.tasks.reorderChecklistItems(request.user.id, id, input.itemIds);
  }

  @Patch(':id/checklist-items/:itemId')
  updateChecklistItem(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(updateTaskChecklistItemSchema, body);
    return this.tasks.updateChecklistItem(request.user.id, id, itemId, input);
  }

  @Delete(':id/checklist-items/:itemId')
  deleteChecklistItem(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.tasks.deleteChecklistItem(request.user.id, id, itemId);
  }

  @Post(':id/restore')
  restore(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.tasks.restore(request.user.id, id);
  }

  @Delete(':id')
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.tasks.softDelete(request.user.id, id);
    await this.reminders.cancelPending(id);
    return { ok: true };
  }
}
