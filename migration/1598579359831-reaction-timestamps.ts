import {MigrationInterface, QueryRunner} from "typeorm";

export class reactionTimestamps1598579359831 implements MigrationInterface {
    name = 'reactionTimestamps1598579359831'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "note" ADD "reactionTimestamps" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "reactionTimestamps"`);
    }

}
