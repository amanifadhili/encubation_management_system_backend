import { PrismaClient, UserRole, TeamStatus, ProjectStatus, ProjectCategory, TeamMemberRole } from '@prisma/client';
import { PasswordUtils } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create users
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

  const manager = await prisma.user.upsert({
    where: { email: 'manager@university.edu' },
    update: {},
    create: {
      email: 'manager@university.edu',
      password_hash: await PasswordUtils.hash('manager123'),
      role: UserRole.manager,
      name: 'Prof. Michael Chen',
    },
  });

  const mentor = await prisma.user.upsert({
    where: { email: 'mentor@university.edu' },
    update: {},
    create: {
      email: 'mentor@university.edu',
      password_hash: await PasswordUtils.hash('mentor123'),
      role: UserRole.mentor,
      name: 'Dr. Emily Rodriguez',
    },
  });

  const incubator1 = await prisma.user.upsert({
    where: { email: 'innovatex@teams.com' },
    update: {},
    create: {
      email: 'innovatex@teams.com',
      password_hash: await PasswordUtils.hash('team123'),
      role: UserRole.incubator,
      name: 'Alex Thompson',
    },
  });

  const incubator2 = await prisma.user.upsert({
    where: { email: 'greenminds@teams.com' },
    update: {},
    create: {
      email: 'greenminds@teams.com',
      password_hash: await PasswordUtils.hash('team123'),
      role: UserRole.incubator,
      name: 'Maria Garcia',
    },
  });

  console.log('✅ Users created');

  // Create teams
  const team1 = await prisma.team.upsert({
    where: { id: 'team_1' },
    update: {},
    create: {
      id: 'team_1',
      team_name: 'InnovateX Team',
      company_name: 'InnovateX Solutions',
      status: TeamStatus.active,
    },
  });

  const team2 = await prisma.team.upsert({
    where: { id: 'team_2' },
    update: {},
    create: {
      id: 'team_2',
      team_name: 'GreenMinds',
      company_name: 'GreenMinds Technologies',
      status: TeamStatus.active,
    },
  });

  console.log('✅ Teams created');

  // Create team members
  await prisma.teamMember.upsert({
    where: { id: 'member_1' },
    update: {},
    create: {
      id: 'member_1',
      team_id: team1.id,
      user_id: incubator1.id,
      role: 'team_leader',
    },
  });

  await prisma.teamMember.upsert({
    where: { id: 'member_2' },
    update: {},
    create: {
      id: 'member_2',
      team_id: team2.id,
      user_id: incubator2.id,
      role: 'team_leader',
    },
  });

  console.log('✅ Team members created');

  // Create mentor
  const mentorRecord = await prisma.mentor.upsert({
    where: { user_id: mentor.id },
    update: {},
    create: {
      user_id: mentor.id,
      expertise: 'Energy Systems',
      phone: '+1-555-0123',
    },
  });

  console.log('✅ Mentor created');

  // Create mentor assignments
  await prisma.mentorAssignment.upsert({
    where: { id: 'assignment_1' },
    update: {},
    create: {
      id: 'assignment_1',
      mentor_id: mentorRecord.id,
      team_id: team1.id,
    },
  });

  console.log('✅ Mentor assignments created');

  // Create projects
  const project1 = await prisma.project.upsert({
    where: { id: 'project_1' },
    update: {},
    create: {
      id: 'project_1',
      name: 'Smart Campus Energy Saver',
      description: 'AI-powered system to optimize energy consumption in university buildings',
      team_id: team1.id,
      category: ProjectCategory.Technology,
      status: ProjectStatus.active,
      progress: 75,
    },
  });

  const project2 = await prisma.project.upsert({
    where: { id: 'project_2' },
    update: {},
    create: {
      id: 'project_2',
      name: 'Eco-Friendly Packaging',
      description: 'Biodegradable packaging solution using agricultural waste',
      team_id: team2.id,
      category: ProjectCategory.Agriculture,
      status: ProjectStatus.active,
      progress: 60,
    },
  });

  console.log('✅ Projects created');

  // Create inventory items
  const item1 = await prisma.inventoryItem.upsert({
    where: { id: 'item_1' },
    update: {},
    create: {
      id: 'item_1',
      name: '3D Printer',
      description: 'High-quality 3D printer for prototyping',
      total_quantity: 2,
      available_quantity: 1,
      status: 'available',
    },
  });

  const item2 = await prisma.inventoryItem.upsert({
    where: { id: 'item_2' },
    update: {},
    create: {
      id: 'item_2',
      name: 'Arduino Starter Kit',
      description: 'Complete Arduino kit with sensors and components',
      total_quantity: 5,
      available_quantity: 3,
      status: 'available',
    },
  });

  console.log('✅ Inventory items created');

  // Create inventory assignments
  await prisma.inventoryAssignment.upsert({
    where: { id: 'assignment_inv_1' },
    update: {},
    create: {
      id: 'assignment_inv_1',
      item_id: item1.id,
      team_id: team1.id,
      quantity: 1,
    },
  });

  console.log('✅ Inventory assignments created');

  // Create announcements
  await prisma.announcement.upsert({
    where: { id: 'announcement_1' },
    update: {},
    create: {
      id: 'announcement_1',
      title: 'Welcome to Incubation Program 2024',
      content: 'Welcome to the new incubation program! We are excited to have you join our community of innovators.',
      author_id: director.id,
    },
  });

  console.log('✅ Announcements created');

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Test Credentials:');
  console.log('Director: director@university.edu / director123');
  console.log('Manager: manager@university.edu / manager123');
  console.log('Mentor: mentor@university.edu / mentor123');
  console.log('Team 1: innovatex@teams.com / team123');
  console.log('Team 2: greenminds@teams.com / team123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });