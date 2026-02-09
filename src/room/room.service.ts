import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entity/room.entity';
import { Reservation } from '../reservation/entity/reservation.entity';

@Injectable()
export class RoomService {
    constructor(
        @InjectRepository(Room)
        private roomRepository: Repository<Room>,
        @InjectRepository(Reservation)
        private reservationRepository: Repository<Reservation>,
    ) { }

    async findAvailableRooms(
        date: Date,
        startTime: string, // "HH:mm"
        endTime: string,   // "HH:mm"
        minCapacity?: number,
        characteristics?: string[],
    ): Promise<Room[]> {
        // 1. Base Query
        const query = this.roomRepository.createQueryBuilder('room');

        // 2. Filter by Capacity
        if (minCapacity) {
            query.andWhere('room.capacity >= :minCapacity', { minCapacity });
        }

        // 3. Filter by Characteristics (using JSONB containment operator if PG, or simple like)
        // For simplicity with 'simple-json', we might need to do memory filtering or text search
        // But let's assume we fetch all and filter for MVP or use simple LIKE if text
        // Postgres JSON support in TypeORM can be tricky with simple-json.
        // Let's rely on retrieving candidates and filtering in memory for now? 
        // Or just use a simple check if the field is a string array.

        // 4. Exclude booked rooms
        // We need to check if there are ANY reservations overlapping with the requested slot.
        // Overlap condition: (StartA < EndB) and (EndA > StartB)

        const startDateTime = new Date(`${date.toISOString().split('T')[0]}T${startTime}:00`);
        const endDateTime = new Date(`${date.toISOString().split('T')[0]}T${endTime}:00`);

        const bookedRoomIds = await this.reservationRepository
            .createQueryBuilder('reservation')
            .select('reservation.room_id', 'room_id') // Alias is crucial
            .where('reservation.start_time < :endDateTime', { endDateTime })
            .andWhere('reservation.end_time > :startDateTime', { startDateTime })
            .andWhere('reservation.status != :cancelled', { cancelled: 'CANCELED' })
            .getRawMany();

        const excludedIds = bookedRoomIds.map(r => r.room_id).filter(id => id !== null && id !== undefined);

        if (excludedIds.length > 0) {
            query.andWhere('room.id NOT IN (:...excludedIds)', { excludedIds });
        }

        const candidateRooms = await query.getMany();

        // 5. In-memory filter for characteristics if provided
        if (characteristics && characteristics.length > 0) {
            return candidateRooms.filter(room =>
                characteristics.every(char => room.characteristics?.includes(char))
            );
        }

        return candidateRooms;
    }

    async findAll(): Promise<Room[]> {
        return this.roomRepository.find();
    }

    async findById(id: number): Promise<Room | null> {
        return this.roomRepository.findOne({ where: { id } });
    }
}
