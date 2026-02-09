import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomService } from './room.service';
import { Room } from './entity/room.entity';
import { Reservation } from '../reservation/entity/reservation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room, Reservation])],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule { }
