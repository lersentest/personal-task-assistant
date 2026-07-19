import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import { PrismaService } from '../database/prisma.service';
import { DelegatedTasksService } from '../delegated-tasks/delegated-tasks.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { jsonSafe } from './json-safe';

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
    const [tasks, delegatedTasks, projects, files] = await Promise.all([
      this.tasks.list(request.user.id, {
        view: 'ALL',
        timezone: request.user.timezone,
        limit: 20,
        sort: 'updatedAt',
        ...(search ? { search } : {}),
      }),
      this.delegatedTasks.list(request.user.id, {
        ...(search ? { search } : {}),
      }),
      this.projects.list(request.user.id),
      this.prisma.attachment.findMany({
        where: {
          ownerId: request.user.id,
          deletedAt: null,
          ...(search
            ? {
                OR: [
                  { fileName: { contains: search, mode: 'insensitive' } },
                  { mimeType: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          taskId: true,
          projectId: true,
          delegatedTaskId: true,
          createdAt: true,
          task: { select: { id: true, title: true } },
          project: { select: { id: true, name: true } },
          delegatedTask: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const normalizedSearch = search?.toLowerCase();
    const filteredProjects = normalizedSearch
      ? projects.filter((project) =>
          [project.name, project.description, project.status]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch),
        )
      : projects;
    return jsonSafe({
      tasks,
      delegatedTasks: delegatedTasks.slice(0, 20),
      projects: filteredProjects.slice(0, 20),
      files,
    });
  }
}
