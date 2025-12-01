import { PrismaClient, UserRole } from '@prisma/client';
import { PasswordUtils } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create director user
  const director = await prisma.user.upsert({
    where: { email: 'director@university.edu' },
    update: {},
    create: {
      email: 'director@university.edu',
      password_hash: await PasswordUtils.hash('director123'),
      role: UserRole.director,
      name: 'Dr. Sarah Johnson',
    },
  });

  console.log('✅ Director user created');

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Test Credentials:');
  console.log('Director: director@university.edu / director123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });