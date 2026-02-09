import { Module } from '@nestjs/common';
import { ToolRegistryService } from './tool.registry/tool.registry.service';
import { RoomModule } from '../../room/room.module';
import { ReservationModule } from '../../reservation/reservation.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';

@Module({
  imports: [RoomModule, ReservationModule, KnowledgeModule],
  providers: [ToolRegistryService],
  exports: [ToolRegistryService],
})
export class ToolsModule { }
