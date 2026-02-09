import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Reservation, ReservationStatus } from './entity/reservation.entity';

@Injectable()
export class ReservationService {
    constructor(
        @InjectRepository(Reservation)
        private reservationRepository: Repository<Reservation>,
        private dataSource: DataSource,
    ) { }

    async createReservation(
        roomId: number,
        userSlackId: string,
        startTime: Date,
        endTime: Date,
        topic: string,
    ): Promise<Reservation> {
        const queryRunner = this.dataSource.createQueryRunner();

        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // 1. Check for overlapping reservations (Double Booking Prevention)
            // Using pessimistic write lock to prevent race conditions
            const existingReservation = await queryRunner.manager
                .createQueryBuilder(Reservation, 'reservation')
                // .setLock('pessimistic_write') // SQLite doesn't support this
                .where('reservation.room_id = :roomId', { roomId })
                .andWhere('reservation.status != :cancelled', { cancelled: ReservationStatus.CANCELED })
                .andWhere('reservation.start_time < :endTime', { endTime })
                .andWhere('reservation.end_time > :startTime', { startTime })
                .getOne();

            if (existingReservation) {
                throw new ConflictException(`Room ${roomId} is already booked for this time slot.`);
            }

            // 2. Create Reservation
            const newReservation = queryRunner.manager.create(Reservation, {
                room_id: roomId,
                user_slack_id: userSlackId,
                start_time: startTime,
                end_time: endTime,
                topic: topic,
                status: ReservationStatus.CONFIRMED,
            });

            const savedReservation = await queryRunner.manager.save(newReservation);

            await queryRunner.commitTransaction();
            return savedReservation;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    async findByUser(userSlackId: string): Promise<Reservation[]> {
        return this.reservationRepository.find({
            where: { user_slack_id: userSlackId },
            order: { start_time: 'DESC' },
        });
    }

    async getUserStats(userSlackId: string): Promise<{ favoriteRoomId: number; totalBookings: number; lastTopic: string } | null> {
        const stats = await this.reservationRepository
            .createQueryBuilder('reservation')
            .select('reservation.room_id', 'roomId')
            .addSelect('COUNT(*)', 'count')
            .where('reservation.user_slack_id = :userSlackId', { userSlackId })
            .groupBy('reservation.room_id')
            .orderBy('count', 'DESC')
            .getRawOne();

        if (!stats) return null;

        const lastReservation = await this.reservationRepository.findOne({
            where: { user_slack_id: userSlackId },
            order: { start_time: 'DESC' },
        });

        return {
            favoriteRoomId: stats.roomId,
            totalBookings: typeof stats.count === 'string' ? parseInt(stats.count) : stats.count,
            lastTopic: lastReservation ? lastReservation.topic : 'General Meeting',
        };
    }
}
