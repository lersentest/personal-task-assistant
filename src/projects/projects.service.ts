import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProjectInput } from './types/create-project.input';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateProjectInput) {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Название проекта не может быть пустым.');
    }

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ownerId: input.ownerId,
          createdById: input.createdById,
          name,
          description: input.description?.trim() || null,
        },
      });
      await tx.activityEvent.create({
        data: {
          ownerId: input.ownerId,
          actorId: input.createdById,
          type: 'PROJECT_CREATED',
          projectId: project.id,
          title: project.name,
        },
      });
      return project;
    });
  }

  findActiveByName(ownerId: string, name: string) {
    return this.prisma.project.findFirst({
      where: {
        ownerId,
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
        deletedAt: null,
        status: { not: 'ARCHIVED' },
      },
    });
  }

  list(ownerId: string) {
    return this.prisma.project.findMany({
      where: { ownerId, deletedAt: null, status: { not: 'ARCHIVED' } },
      include: {
        _count: {
          select: {
            tasks: {
              where: {
                deletedAt: null,
                status: { in: ['NEW', 'IN_PROGRESS'] },
              },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  getOwned(ownerId: string, projectId: string) {
    return this.prisma.project
      .findFirst({
        where: { id: projectId, ownerId, deletedAt: null },
        include: {
          _count: {
            select: {
              tasks: { where: { deletedAt: null } },
            },
          },
        },
      })
      .then((project) => {
        if (!project) throw new NotFoundException('Проект не найден.');
        return project;
      });
  }

  async update(
    ownerId: string,
    projectId: string,
    input: {
      name?: string;
      description?: string | null;
      status?: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
    },
  ) {
    await this.getOwned(ownerId, projectId);
    if (input.name !== undefined && !input.name.trim()) {
      throw new BadRequestException('Название проекта не может быть пустым.');
    }
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: projectId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.status !== undefined
            ? {
                status: input.status,
                archivedAt: input.status === 'ARCHIVED' ? now : null,
              }
            : {}),
        },
      });
      await tx.activityEvent.create({
        data: {
          ownerId,
          actorId: ownerId,
          type: 'PROJECT_UPDATED',
          projectId,
          title: project.name,
          metadata: { status: project.status },
        },
      });
      return project;
    });
  }

  async softDelete(ownerId: string, projectId: string) {
    await this.getOwned(ownerId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
  }
}
