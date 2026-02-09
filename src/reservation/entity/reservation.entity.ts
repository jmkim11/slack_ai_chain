import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Room } from '../../room/entity/room.entity';

export enum ReservationStatus {
    CONFIRMED = 'CONFIRMED',
    CANCELED = 'CANCELED',
}

@Entity()
export class Reservation {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    room_id: number;

    @ManyToOne(() => Room, (room) => room.reservations)
    @JoinColumn({ name: 'room_id' })
    room: Room;

    @Column()
    user_slack_id: string;

    @Column()
    start_time: Date;

    @Column()
    end_time: Date;

    @Column()
    topic: string;

    @Column('varchar', { default: ReservationStatus.CONFIRMED })
    status: ReservationStatus;

    @Column({ nullable: true })
    context: string; // AI analysis of meeting purpose

    @Column({ nullable: true })
    complexity: number; // 1-10 scale for meeting importance/setup needs

    @Column({ nullable: true })
    slack_thread_id: string; // For tracing context in Slack
}
