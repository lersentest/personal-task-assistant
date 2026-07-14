import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import { TagsService } from '../tags/tags.service';

@Controller('api/tags')
@UseGuards(SupabaseAuthGuard)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.tags.list(request.user.id);
  }
}

