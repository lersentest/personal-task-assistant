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
  createTaskSchema,
  listTasksSchema,
  optionalDate,
  parseDto,
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

