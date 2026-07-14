import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import { createProjectSchema, parseDto, updateProjectSchema } from './dto';
import { ProjectsService } from '../projects/projects.service';

@Controller('api/projects')
@UseGuards(SupabaseAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.projects.list(request.user.id);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.projects.getOwned(request.user.id, id);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseDto(createProjectSchema, body);
    return this.projects.create({
      ownerId: request.user.id,
      createdById: request.user.id,
      name: input.name,
      description: input.description,
    });
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(updateProjectSchema, body);
    return this.projects.update(request.user.id, id, input);
  }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.projects.softDelete(request.user.id, id);
  }
}

