import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  list(ownerId: string) {
    return this.prisma.tag.findMany({
      where: { ownerId },
      include: {
        _count: {
          select: {
            tasks: {
              where: {
                task: { deletedAt: null },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  getOwned(ownerId: string, tagId: string) {
    return this.prisma.tag
      .findFirst({ where: { id: tagId, ownerId } })
      .then((tag) => {
        if (!tag) throw new NotFoundException('Тег не найден.');
        return tag;
      });
  }
}
