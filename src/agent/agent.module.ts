import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ToolsModule } from '../common/tools/tools.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ToolsModule, ConfigModule],
  providers: [AgentService],
  exports: [AgentService], // Exporting it for use in Controller
})
export class AgentModule { }
