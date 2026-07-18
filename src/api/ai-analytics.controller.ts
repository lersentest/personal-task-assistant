import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AiAnalyticsService } from '../ai-analytics/ai-analytics.service';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import { parseDto } from './dto';

const sendAiAnalyticsMessageSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  content: z.string().min(1).max(8000),
});

@Controller('api/ai-analytics')
@UseGuards(SupabaseAuthGuard)
export class AiAnalyticsController {
  constructor(private readonly aiAnalytics: AiAnalyticsService) {}

  @Get('conversation')
  currentConversation(@Req() request: AuthenticatedRequest) {
    return this.aiAnalytics.currentConversation(request.user.id);
  }

  @Post('messages')
  sendMessage(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseDto(sendAiAnalyticsMessageSchema, body);
    return this.aiAnalytics.sendMessage(
      request.user.id,
      request.user.timezone,
      input,
    );
  }
}
