import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/lib/password';
import { parseAccountInput } from '../src/lib/validation';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required.');
    process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const loginId = process.env.ADMIN_LOGIN_ID;
    const password = process.env.ADMIN_PASSWORD;
    const displayName = process.env.ADMIN_DISPLAY_NAME || 'Administrator';

    if (!loginId || !password) {
        console.error('Error: ADMIN_LOGIN_ID and ADMIN_PASSWORD environment variables are required.');
        console.error('Usage: ADMIN_LOGIN_ID=admin ADMIN_PASSWORD=yourpassword npm run admin:create');
        process.exit(1);
    }

    const input = parseAccountInput({ loginId, displayName, password });
    if (!input.ok) {
        console.error(`Error: ${input.error}`);
        process.exit(1);
    }
    const normalized = input.value;

    // Check if already exists
    const existing = await prisma.user.findUnique({
        where: { loginId: normalized.loginId },
        select: { id: true },
    });

    if (existing) {
        console.error(`Error: User with login_id "${normalized.loginId}" already exists.`);
        process.exit(1);
    }

    const passwordHash = await hashPassword(normalized.password);

    const admin = await prisma.user.create({
        data: {
            loginId: normalized.loginId,
            displayName: normalized.displayName,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
        },
        select: { loginId: true, displayName: true, role: true },
    });

    console.log('✅ Admin user created successfully!');
    console.log(`   Login ID: ${admin.loginId}`);
    console.log(`   Display Name: ${admin.displayName}`);
    console.log(`   Role: ${admin.role}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
