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

    return this.prisma.project.create({
      data: {
        ownerId: input.ownerId,
        createdById: input.createdById,
        name,
        description: input.description?.trim() || null,
      },
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
    return this.prisma.project.update({
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
  }

  async softDelete(ownerId: string, projectId: string) {
    await this.getOwned(ownerId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
  }
}
