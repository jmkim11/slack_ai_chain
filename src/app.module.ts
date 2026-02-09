import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Room } from './room/entity/room.entity';
import { Reservation } from './reservation/entity/reservation.entity';
import { AgentModule } from './agent/agent.module';
import { ToolsModule } from './common/tools/tools.module';
import { RoomModule } from './room/room.module';
import { ReservationModule } from './reservation/reservation.module';
import { SlackModule } from './slack/slack.module';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'jmate.db',
      entities: [Room, Reservation],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Room, Reservation]),
    AgentModule,
    ToolsModule,
    RoomModule,
    ReservationModule,
    SlackModule,
    KnowledgeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
