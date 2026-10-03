import {
  Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private alerts: AlertsService) {}

  @Get()
  list(@Req() req) {
    return this.alerts.list(req.user.userId);
  }

  @Post()
  create(@Body() body: any, @Req() req) {
    return this.alerts.create(req.user.userId, body);
  }

  @Patch(':id/przelacz')
  toggle(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.alerts.toggle(req.user.userId, id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.alerts.remove(req.user.userId, id);
  }
}
