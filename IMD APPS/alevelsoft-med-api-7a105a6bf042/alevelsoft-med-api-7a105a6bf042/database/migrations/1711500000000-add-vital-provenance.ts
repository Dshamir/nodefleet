import {MigrationInterface, QueryRunner} from 'typeorm';
import {TableColumn} from 'typeorm/schema-builder/table/TableColumn';

export class AddVitalProvenance1711500000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('vital', [
            new TableColumn({
                name: 'device_serial',
                type: 'varchar',
                length: '20',
                isNullable: true,
            }),
            new TableColumn({
                name: 'relay_type',
                type: 'varchar',
                length: '10',
                isNullable: true,
            }),
            new TableColumn({
                name: 'relay_id',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('vital', 'relay_id');
        await queryRunner.dropColumn('vital', 'relay_type');
        await queryRunner.dropColumn('vital', 'device_serial');
    }
}
