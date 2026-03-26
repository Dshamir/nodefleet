import {MigrationInterface, QueryRunner} from 'typeorm';
import {Table, TableIndex} from 'typeorm';

export class CreateDeviceBinding1711500000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'device_binding',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'gen_random_uuid()',
                    },
                    {
                        name: 'device_serial',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                    },
                    {
                        name: 'user_id',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'relay_type',
                        type: 'varchar',
                        length: '10',
                        isNullable: false,
                    },
                    {
                        name: 'relay_id',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'bound_at',
                        type: 'timestamptz',
                        default: 'NOW()',
                        isNullable: false,
                    },
                    {
                        name: 'unbound_at',
                        type: 'timestamptz',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamptz',
                        default: 'NOW()',
                        isNullable: false,
                    },
                ],
                foreignKeys: [
                    {
                        columnNames: ['user_id'],
                        referencedTableName: 'user',
                        referencedColumnNames: ['id'],
                    },
                ],
                uniques: [
                    {
                        columnNames: ['device_serial', 'unbound_at'],
                        name: 'uq_active_binding',
                    },
                ],
            }),
            true,
        );

        await queryRunner.createIndex(
            'device_binding',
            new TableIndex({ name: 'idx_device_binding_user', columnNames: ['user_id'] }),
        );
        await queryRunner.createIndex(
            'device_binding',
            new TableIndex({ name: 'idx_device_binding_serial', columnNames: ['device_serial'] }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('device_binding');
    }
}
