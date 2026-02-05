import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const loginId = process.env.ADMIN_LOGIN_ID;
    const password = process.env.ADMIN_PASSWORD;
    const displayName = process.env.ADMIN_DISPLAY_NAME || 'Administrator';

    if (!loginId || !password) {
        console.error('Error: ADMIN_LOGIN_ID and ADMIN_PASSWORD environment variables are required.');
        console.error('Usage: ADMIN_LOGIN_ID=admin ADMIN_PASSWORD=yourpassword npm run admin:create');
        process.exit(1);
    }

    if (password.length < 6) {
        console.error('Error: Password must be at least 6 characters.');
        process.exit(1);
    }

    // Check if already exists
    const existing = await prisma.user.findUnique({
        where: { loginId },
    });

    if (existing) {
        console.error(`Error: User with login_id "${loginId}" already exists.`);
        process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
        data: {
            loginId,
            displayName,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
        },
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
    });
