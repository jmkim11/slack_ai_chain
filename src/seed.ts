import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RoomService } from './room/room.service';
import { Room } from './room/entity/room.entity';
import { DataSource } from 'typeorm';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);

    const roomRepo = dataSource.getRepository(Room);

    const count = await roomRepo.count();
    if (count > 0) {
        console.log('Rooms already exist. Skipping seed.');
        await app.close();
        return;
    }

    // Remove adjacent_room_id: null to avoid type mismatch
    const rooms = [
        {
            name: 'Mate Center 304',
            capacity: 10,
            amenities: ['TV', 'Whiteboard'],
            characteristics: ['View', 'Quiet'],
        },
        {
            name: 'Mate Center 305',
            capacity: 4,
            amenities: ['TV'],
            characteristics: ['sunny', 'casual'],
        },
        {
            name: 'Soul Cup Lounge',
            capacity: 12,
            amenities: ['Projector', 'Sound System'],
            characteristics: ['large', 'open'],
        },
        {
            name: 'Focus Room A',
            capacity: 2,
            amenities: [],
            characteristics: ['small', 'quiet', 'private'],
        }
    ];

    console.log('Seeding rooms...');
    const savedRooms = await roomRepo.save(rooms);

    // Set adjacency (304 <-> 305)
    const room304 = savedRooms.find(r => r.name.includes('304'));
    const room305 = savedRooms.find(r => r.name.includes('305'));

    if (room304 && room305) {
        room304.adjacent_room_id = room305.id;
        room305.adjacent_room_id = room304.id;
        await roomRepo.save([room304, room305]);
        console.log(`Linked ${room304.name} and ${room305.name} as adjacent.`);
    }

    console.log('Seeding complete!');
    await app.close();
}

bootstrap();
