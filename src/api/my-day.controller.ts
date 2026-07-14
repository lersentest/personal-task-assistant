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
  completeMyDaySchema,
  createDailyPlanItemSchema,
  myDayDateSchema,
  myDaySuggestionsSchema,
  optionalDate,
  parseDto,
  reorderDailyPlanItemsSchema,
  scheduleDailyPlanItemSchema,
  updateDailyPlanItemSchema,
} from './dto';
import { MyDayService } from '../my-day/my-day.service';

@Controller('api/my-day')
@UseGuards(SupabaseAuthGuard)
export class MyDayController {
  constructor(private readonly myDay: MyDayService) {}

  @Get()
  getDay(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const { date } = parseDto(myDayDateSchema, query);
    return this.myDay.getDay(request.user.id, request.user.timezone, date);
  }

  @Get('suggestions')
  suggestions(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const input = parseDto(myDaySuggestionsSchema, query);
    return this.myDay.suggestions(request.user.id, input.date, input);
  }

  @Post('items')
  addItem(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseDto(createDailyPlanItemSchema, body);
    return this.myDay.addItem(request.user.id, {
      ...input,
      scheduledStartAt: optionalDate(input.scheduledStartAt),
      scheduledEndAt: optionalDate(input.scheduledEndAt),
    });
  }

  @Patch('items/:id')
  updateItem(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(updateDailyPlanItemSchema, body);
    return this.myDay.updateItem(request.user.id, id, {
      ...input,
      scheduledStartAt: optionalDate(input.scheduledStartAt),
      scheduledEndAt: optionalDate(input.scheduledEndAt),
    });
  }

  @Delete('items/:id')
  removeItem(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.myDay.removeItem(request.user.id, id);
  }

  @Post('items/:id/schedule')
  scheduleItem(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseDto(scheduleDailyPlanItemSchema, body);
    return this.myDay.scheduleItem(request.user.id, id, {
      scheduledStartAt: new Date(input.scheduledStartAt),
      scheduledEndAt: new Date(input.scheduledEndAt),
      estimatedDurationMinutes: input.estimatedDurationMinutes,
    });
  }

  @Post('items/:id/unschedule')
  unscheduleItem(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.myDay.unscheduleItem(request.user.id, id);
  }

  @Post('items/:id/complete')
  completeItem(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.myDay.completeItem(request.user.id, id);
  }

  @Post('items/reorder')
  reorder(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseDto(reorderDailyPlanItemsSchema, body);
    return this.myDay.reorder(request.user.id, input.date, input.itemIds);
  }

  @Post('complete')
  completeDay(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseDto(completeMyDaySchema, body);
    return this.myDay.completeDay(request.user.id, request.user.timezone, input);
  }

  @Get('history')
  history(@Req() request: AuthenticatedRequest) {
    return this.myDay.history(request.user.id);
  }
}
