import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import { PrismaService } from '../database/prisma.service';
import { DelegatedTasksService } from '../delegated-tasks/delegated-tasks.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';

@Controller('api')
@UseGuards(SupabaseAuthGuard)
export class DashboardController {
  constructor(
    private readonly tasks: TasksService,
    private readonly projects: ProjectsService,
    private readonly delegatedTasks: DelegatedTasksService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  @Get('dashboard')
  async dashboard(@Req() request: AuthenticatedRequest) {
    const [summary, today, overdue, upcoming, projects, recentActivity] = await Promise.all([
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
      this.prisma.activityEvent.findMany({
        where: { ownerId: request.user.id },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ]);

    return {
      summary,
      today,
      overdue,
      upcoming,
      attention: [...overdue, ...today.filter((task) => task.priority === 'URGENT' || task.priority === 'HIGH')]
        .filter((task, index, tasks) => tasks.findIndex((candidate) => candidate.id === task.id) === index)
        .slice(0, 10),
      activeProjects: projects.slice(0, 8),
      recentActivity,
    };
  }

  @Get('calendar')
  calendar(@Req() request: AuthenticatedRequest) {
    return this.tasks.calendar(request.user.id, request.user.timezone);
  }

  @Get('search')
  async search(@Req() request: AuthenticatedRequest, @Query('q') q?: string) {
    const search = q?.trim();
    const tasks = await this.tasks.list(request.user.id, {
      view: 'ALL',
      timezone: request.user.timezone,
      limit: 20,
      sort: 'updatedAt',
      ...(search ? { search } : {}),
    });
    const delegatedTasks = await this.delegatedTasks.list(request.user.id, {
      ...(search ? { search } : {}),
    });
    const projects = await this.projects.list(request.user.id);
    return { tasks, delegatedTasks: delegatedTasks.slice(0, 20), projects, files: [] };
  }
}
