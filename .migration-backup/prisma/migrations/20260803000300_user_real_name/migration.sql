BEGIN;

ALTER TABLE "users"
    ADD COLUMN "family_name" TEXT,
    ADD COLUMN "given_name" TEXT;

ALTER TABLE "users"
    ADD CONSTRAINT "users_real_name_pair_check"
    CHECK (
        ("family_name" IS NULL AND "given_name" IS NULL)
        OR (
            "family_name" IS NOT NULL
            AND "given_name" IS NOT NULL
            AND char_length("family_name") BETWEEN 1 AND 40
            AND char_length("given_name") BETWEEN 1 AND 40
            AND "family_name" = btrim("family_name")
            AND "given_name" = btrim("given_name")
            AND "family_name" !~ '[[:cntrl:]]'
            AND "given_name" !~ '[[:cntrl:]]'
            AND "family_name" !~ U&'[\00AD\034F\0600-\0605\061C\06DD\070F\0890-\0891\08E2\115F-\1160\17B4-\17B5\180B-\180F\200B-\200F\2028-\2029\202A-\202E\2060-\206F\3164\FE00-\FE0F\FEFF\FFA0\FFF0-\FFFB\+0110BD\+0110CD\+013430-\+01343F\+01BCA0-\+01BCA3\+01D173-\+01D17A\+0E0000-\+0E0FFF]'
            AND "given_name" !~ U&'[\00AD\034F\0600-\0605\061C\06DD\070F\0890-\0891\08E2\115F-\1160\17B4-\17B5\180B-\180F\200B-\200F\2028-\2029\202A-\202E\2060-\206F\3164\FE00-\FE0F\FEFF\FFA0\FFF0-\FFFB\+0110BD\+0110CD\+013430-\+01343F\+01BCA0-\+01BCA3\+01D173-\+01D17A\+0E0000-\+0E0FFF]'
        )
    ) NOT VALID;

ALTER TABLE "users"
    VALIDATE CONSTRAINT "users_real_name_pair_check";

COMMIT;
