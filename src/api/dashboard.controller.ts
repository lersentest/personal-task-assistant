import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';

@Controller('api')
@UseGuards(SupabaseAuthGuard)
export class DashboardController {
  constructor(
    private readonly tasks: TasksService,
    private readonly projects: ProjectsService,
  ) {}

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  @Get('dashboard')
  async dashboard(@Req() request: AuthenticatedRequest) {
    const [summary, today, overdue, upcoming, projects] = await Promise.all([
      this.tasks.summary(request.user.id, request.user.timezone),
      this.tasks.list(request.user.id, {
        view: 'TODAY',
        timezone: request.user.timezone,
        limit: 10,
      }),
      this.tasks.list(request.user.id, {
        view: 'OVERDUE',
        timezone: request.user.timezone,
        limit: 10,
      }),
      this.tasks.list(request.user.id, {
        view: 'UPCOMING',
        timezone: request.user.timezone,
        limit: 10,
      }),
      this.projects.list(request.user.id),
    ]);

    return {
      summary,
      today,
      overdue,
      upcoming,
      activeProjects: projects.slice(0, 8),
    };
  }

  @Get('calendar')
  calendar(@Req() request: AuthenticatedRequest) {
    return this.tasks.calendar(request.user.id, request.user.timezone);
  }

  @Get('search')
  async search(@Req() request: AuthenticatedRequest) {
    const tasks = await this.tasks.list(request.user.id, {
      view: 'ALL',
      timezone: request.user.timezone,
      limit: 20,
      sort: 'updatedAt',
    });
    const projects = await this.projects.list(request.user.id);
    return { tasks, projects, files: [] };
  }
}

