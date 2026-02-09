import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Reservation } from '../../reservation/entity/reservation.entity';

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  capacity: number;

  @Column('simple-json', { nullable: true })
  amenities: string[]; // e.g. ["TV", "Whiteboard"]

  @Column('simple-json', { nullable: true })
  characteristics: string[]; // e.g. ["quiet", "sunny", "corner"]

  @Column({ nullable: true })
  adjacent_room_id: number;

  @ManyToOne(() => Room, { nullable: true })
  @JoinColumn({ name: 'adjacent_room_id' })
  adjacent_room: Room;

  @OneToMany(() => Reservation, (reservation) => reservation.room)
  reservations: Reservation[];
}
