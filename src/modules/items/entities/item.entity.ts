import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Loan } from '../../loans/entities/loan.entity';

export enum ItemType {
  BOOK = 'book',
  MAGAZINE = 'magazine',
  EQUIPMENT = 'equipment',
}

@Entity({ name: 'items' })
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'enum', enum: ItemType })
  type!: ItemType;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => Loan, (loan) => loan.item)
  loans?: Loan[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
