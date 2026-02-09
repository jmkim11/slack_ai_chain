import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [ConfigModule, AgentModule],
  providers: [SlackService],
})
export class SlackModule { }
