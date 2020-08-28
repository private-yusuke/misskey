import {MigrationInterface, QueryRunner} from "typeorm";

export class multipleReactions1598288528357 implements MigrationInterface {
    name = 'multipleReactions1598288528357'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_ad0c221b25672daf2df320a817"`);
        await queryRunner.query(`CREATE INDEX "IDX_ad0c221b25672daf2df320a817" ON "note_reaction" ("userId", "noteId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a7751b74317122d11575bff31c" ON "note_reaction" ("userId", "noteId", "reaction") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_a7751b74317122d11575bff31c"`);
        await queryRunner.query(`DROP INDEX "IDX_ad0c221b25672daf2df320a817"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ad0c221b25672daf2df320a817" ON "note_reaction" ("userId", "noteId") `);
    }

}
