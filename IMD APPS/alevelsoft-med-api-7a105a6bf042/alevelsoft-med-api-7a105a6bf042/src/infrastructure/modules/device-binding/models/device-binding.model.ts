import {DeviceBinding} from 'domain/entities/device-binding.entity';
import {Entity, Column, PrimaryGeneratedColumn, JoinColumn, ManyToOne, CreateDateColumn} from 'typeorm';
import {UserModel} from 'infrastructure/modules/auth/models';

@Entity('device_binding')
export class DeviceBindingModel implements DeviceBinding {
    @PrimaryGeneratedColumn('uuid')
    public id: string;

    @Column({name: 'device_serial'})
    public deviceSerial: string;

    @Column({name: 'user_id'})
    public userId: string;

    @Column({name: 'relay_type'})
    public relayType: string;

    @Column({name: 'relay_id'})
    public relayId: string;

    @Column({name: 'bound_at', type: 'timestamptz', default: () => 'NOW()'})
    public boundAt: Date;

    @Column({name: 'unbound_at', type: 'timestamptz', nullable: true})
    public unboundAt: Date | null = null;

    @CreateDateColumn({name: 'created_at', type: 'timestamptz'})
    public createdAt: Date;

    @ManyToOne(() => UserModel)
    @JoinColumn({name: 'user_id', referencedColumnName: 'id'})
    public user: UserModel;
}
