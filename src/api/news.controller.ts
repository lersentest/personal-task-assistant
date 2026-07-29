import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import { NewsService } from '../news/news.service';

@Controller('api/news')
@UseGuards(SupabaseAuthGuard)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('today')
  today(@Req() request: AuthenticatedRequest, @Query('date') date?: string) {
    return this.newsService.getToday(request.user.id, date);
  }

  @Post('refresh')
  @HttpCode(202)
  refresh(@Req() request: AuthenticatedRequest) {
    return this.newsService.startManualRefresh(request.user.id);
  }

  @Get('runs/:id')
  run(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.newsService.getRun(request.user.id, id);
  }

  @Get('sources')
  sources() {
    return this.newsService.listSources();
  }

  @Patch('sources/:id')
  updateSource(
    @Param('id') id: string,
    @Body() body: { enabled?: boolean; priority?: number },
  ) {
    return this.newsService.updateSource(id, body);
  }

  @Post('sources')
  async createSource(
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      name?: string;
      homepageUrl?: string;
      feedUrl?: string;
      category?: string;
      language?: string;
      country?: string;
      priority?: number;
    },
  ) {
    if (!body.name?.trim() || !body.homepageUrl?.trim()) {
      throw new BadRequestException('Название и URL источника обязательны.');
    }
    try {
      return await this.newsService.createSource(request.user.id, {
        name: body.name,
        homepageUrl: body.homepageUrl,
        feedUrl: body.feedUrl,
        category: body.category || 'STONE_INDUSTRY',
        language: body.language,
        country: body.country,
        priority: body.priority,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Не удалось создать источник.',
      );
    }
  }

  @Post('sources/:id/test')
  testSource(@Param('id') id: string) {
    return this.newsService.testSource(id);
  }
}
