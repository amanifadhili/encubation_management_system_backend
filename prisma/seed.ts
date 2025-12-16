import {
  CurrentRoleInProject,
  EnrollmentStatus,
  PrismaClient,
  ProjectCategory,
  ProjectStatus,
  ProjectStatusAtEnrollment,
  PasswordStatus,
  TeamMemberRole,
  TeamStatus,
  UserRole,
} from '@prisma/client';
import { PasswordUtils } from '../src/utils/password';

const prisma = new PrismaClient();

type LegacyMember = {
  fullName: string;
  email?: string;
  phone?: string;
};

type LegacyEntry = {
  teamSlug: string;
  teamName: string;
  companyName: string;
  department?: string;
  field: string;
  enrollmentDate: Date;
  plannedGraduation?: Date;
  statusAtEnrollment: string;
  sixMonthStatus: string;
  rdbStatus?: string;
  mentor?: { name: string; phone?: string };
  support?: string;
  challenges?: string;
  members: LegacyMember[];
  projectTitle: string;
};

const legacyEntries: LegacyEntry[] = [
  {
    teamSlug: 'e-tara',
    teamName: 'E-Tara',
    companyName: 'E-Tara',
    department: 'Mechanical E.',
    field: 'Environment protection',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'prototype',
    sixMonthStatus: 'prototype',
    rdbStatus: 'Not yet',
    mentor: { name: 'Niyonsenga Joselyne', phone: '730672460' },
    support:
      'Work place, office equipment, desktop, internet, mentorship, workshops, refreshments',
    challenges: 'Weak internet, low budget for consumables',
    projectTitle: 'E-Tara',
    members: [
      { fullName: 'IZEREYO Benoit', email: 'benoitizereyo02@gmail.com', phone: '0790168005' },
      { fullName: 'NIYITANGA Patrick', phone: '0784699423' },
      { fullName: 'NDIKURIYO Saleh', phone: '0791496383' },
    ],
  },
  {
    teamSlug: 'cbc-in-roots',
    teamName: 'CBC in Roots',
    companyName: 'CBC in Roots',
    department: 'Creative Art',
    field: 'Fashion',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'startup in progress',
    sixMonthStatus: 'Start up in progress to Prototype',
    rdbStatus: 'Registered',
    mentor: { name: 'MASOCHA BRENDA TATENDA', phone: '0792045061' },
    support: 'Workplace, equipment, internet, mentorship, workshops, refreshments',
    challenges: 'Weak internet; low budget',
    projectTitle: 'CBC in Roots',
    members: [
      { fullName: 'RUTARINDWA Clovis', email: 'crutarindwa@gmail.com', phone: '0785629787' },
      { fullName: 'NYIRANEZA Clementine', phone: '0790175022' },
      { fullName: 'TUYISHIME Obed', phone: '0783599727' },
    ],
  },
  {
    teamSlug: 'gihanga-ai',
    teamName: 'Gihanga AI / Smart Bell Ringa',
    companyName: 'Gihanga AI / Smart Bell Ringa',
    department: 'Mechanical E.',
    field: 'ICT',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'startup in progress',
    sixMonthStatus: 'prototype',
    rdbStatus: 'Registration in process',
    mentor: { name: 'MASOCHA BRENDA TATENDA', phone: '0792045061' },
    support: 'Workplace, equipment, desktop, internet, mentorship, workshops',
    challenges: 'Weak internet',
    projectTitle: 'Gihanga AI / Smart Bell Ringa',
    members: [
      { fullName: 'IRADUKUNDA Pudens', email: 'kundapudens@gmail.com', phone: '0786458077' },
      { fullName: 'BYIRINGIRO Gilbert', phone: '0781529839' },
      { fullName: 'BIRIKUMANA Lewis', phone: '0782747969' },
    ],
  },
  {
    teamSlug: 'afrinnox-cb-machine',
    teamName: 'Afrinnox CB Machine',
    companyName: 'Afrinnox CB Machine',
    department: 'EEE',
    field: 'Agriculture',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'in progress phase',
    sixMonthStatus: 'prototype',
    rdbStatus: 'Registered',
    mentor: { name: 'Simba Charles', phone: '787668337' },
    support: 'Workplace, equipment, desktop, internet, mentorship',
    challenges: 'Weak internet; low budget',
    projectTitle: 'Afrinnox CB Machine',
    members: [
      { fullName: 'IRADUKUNDA J. Damascene', email: 'damascenej25@gmail.com', phone: '789211684' },
      { fullName: 'SEZERANO Liven', phone: '0780146487' },
    ],
  },
  {
    teamSlug: 'behind-the-classroom',
    teamName: 'Behind the Classroom',
    companyName: 'Behind the Classroom',
    department: 'Creative Art',
    field: 'ICT',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'in progress phase',
    sixMonthStatus: 'in progress (ready to finalize prototype)',
    rdbStatus: 'Not yet',
    mentor: { name: 'Uwantege Stella', phone: '783088805' },
    support: 'Workplace, equipment, internet, mentorship',
    challenges: 'Weak internet; low budget',
    projectTitle: 'Behind the Classroom',
    members: [
      { fullName: 'MUHIRE Bernard', email: 'muhireb21@gmail.com', phone: '791476551' },
      { fullName: 'ABAYO Fabrice', phone: '0780219479' },
    ],
  },
  {
    teamSlug: 'bus-tracking-system',
    teamName: 'Bus Tracking System',
    companyName: 'Bus Tracking System',
    department: 'ICT',
    field: 'Transport',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'development phase',
    sixMonthStatus: 'in progress (final mobile app)',
    rdbStatus: 'Registration in process',
    mentor: { name: 'Adolph MUNYANEZA', phone: '788732935' },
    support: 'Workplace, equipment, internet, workshops',
    challenges: 'Weak internet; low budget',
    projectTitle: 'Bus Tracking System',
    members: [
      { fullName: 'MUGISHA Aime Patrick', email: 'aimepatrick2003@gmail.com', phone: '0785043572' },
      { fullName: 'TWAGIRAYEZU Richard', phone: '0787437033' },
      { fullName: 'IKIREZI Armand', phone: '0781208474' },
    ],
  },
  {
    teamSlug: 'fresh-keep',
    teamName: 'Fresh Keep',
    companyName: 'Fresh Keep',
    department: 'Mechanical E.',
    field: 'Manufacturing',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'development phase',
    sixMonthStatus: 'prototype (testing)',
    rdbStatus: 'Registration in process',
    mentor: { name: 'Simba Charles', phone: '787668337' },
    support: 'Full incubation support',
    challenges: 'Weak internet; low budget',
    projectTitle: 'Fresh Keep',
    members: [
      { fullName: "MIHIGO Bienvenu Heven's", email: 'mihigoheavens@gmail.com', phone: '791827127' },
      { fullName: 'IRAKIZA Adorine', phone: '0792488589' },
    ],
  },
  {
    teamSlug: 'my-tax-platform',
    teamName: 'My Tax Platform',
    companyName: 'My Tax Platform',
    department: 'Creative Art',
    field: 'Transport',
    enrollmentDate: new Date('2025-05-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'designing',
    sixMonthStatus: 'in progress (final app)',
    rdbStatus: 'Registered',
    mentor: { name: 'Simba Charles', phone: '787668337' },
    projectTitle: 'My Tax Platform',
    members: [
      { fullName: 'ISHIMWE Olivier', email: 'ishimweolivier203@gmail.com', phone: '788431013' },
      { fullName: 'IHIMBAZWE Yves' },
      { fullName: 'Gilbert' },
    ],
  },
  {
    teamSlug: 'inzira-online-bus-tracking',
    teamName: 'Inzira (online bus tracking)',
    companyName: 'Inzira (online bus tracking)',
    department: 'ICT',
    field: 'Transport',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'designing',
    sixMonthStatus: 'in progress (near final mobile app)',
    rdbStatus: 'Not yet',
    mentor: { name: 'Adolph MUNYANEZA', phone: '788732935' },
    projectTitle: 'Inzira (online bus tracking)',
    members: [
      { fullName: 'GABIRO Vladmir Brenn', email: 'gabvladimirbrenn@gmail.com', phone: '0786077754' },
      { fullName: 'IGIRANEZA J. Willison', phone: '0784886916' },
    ],
  },
  {
    teamSlug: 'computerized-maize-dryer',
    teamName: 'Computerized Maize Dryer',
    companyName: 'Computerized Maize Dryer',
    department: 'Mechanical E.',
    field: 'Agriculture',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'designing',
    sixMonthStatus: 'in progress',
    rdbStatus: 'Registration in process',
    mentor: { name: 'Gasana Madson', phone: '788444952' },
    projectTitle: 'Computerized Maize Dryer',
    members: [
      { fullName: 'GIRAMATA Grace', email: 'giramatagrace0@gmail.com', phone: '0792511957' },
      { fullName: 'NDAHIGWA Irene', phone: '0786447356' },
      { fullName: 'NTIRUSHA Marc', phone: '0785097557' },
    ],
  },
  {
    teamSlug: 'inyenyeri-poly-design',
    teamName: 'Inyenyeri Poly-design',
    companyName: 'Inyenyeri Poly-design',
    department: 'Creative Art',
    field: 'Agriculture',
    enrollmentDate: new Date('2025-01-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'in progress',
    sixMonthStatus: 'in progress',
    rdbStatus: 'Registration in process',
    mentor: { name: 'MASOCHA BRENDA TATENDA', phone: '0792045061' },
    projectTitle: 'Inyenyeri Poly-design',
    members: [
      { fullName: 'BIZIMANA Emile', email: 'Emilenyawe1@gmail.com', phone: '0787219118' },
      { fullName: 'NIYOYITA Leo Charles', phone: '0788998782' },
      { fullName: 'NIYIGENA Aime', phone: '0791196986' },
    ],
  },
  {
    teamSlug: 'agroai-assist',
    teamName: 'AgroAI Assist',
    companyName: 'AgroAI Assist',
    department: 'ICT',
    field: 'Agriculture',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'in progress',
    sixMonthStatus: 'in progress (final mobile app)',
    rdbStatus: 'Registration in process',
    mentor: { name: 'Uwantege Stella', phone: '783088805' },
    projectTitle: 'AgroAI Assist',
    members: [
      { fullName: 'AMANI Fadhili', email: 'fadhiliamani200@gmail.com', phone: '784424423' },
      { fullName: 'ABAYO Sincere' },
    ],
  },
  {
    teamSlug: 'solid-soap-making-machine',
    teamName: 'Solid Soap Making Machine',
    companyName: 'Solid Soap Making Machine',
    department: 'EEE',
    field: 'Manufacturing',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'designing',
    sixMonthStatus: 'in progress',
    rdbStatus: 'Not yet',
    mentor: { name: 'Migambi Olivier', phone: '788253119' },
    projectTitle: 'Solid Soap Making Machine',
    members: [
      { fullName: 'TUYIZERE Chance', email: 'tuyizerechance7@gmail.com', phone: '724990008' },
      { fullName: 'BAVUGAMENSHI Damien', phone: '0783740072' },
    ],
  },
  {
    teamSlug: 'gsm-tv-made-in-rwanda',
    teamName: 'GSM TV Made in Rwanda',
    companyName: 'GSM TV Made in Rwanda',
    department: 'Creative Art',
    field: 'ICT',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'idea',
    sixMonthStatus: 'in progress',
    rdbStatus: 'Not yet',
    mentor: { name: 'MASOCHA BRENDA TATENDA', phone: '0792045061' },
    projectTitle: 'GSM TV Made in Rwanda',
    members: [
      {
        fullName: 'MANISHIMWE Augustin',
        email: 'manishimweaugustin659@gmail.com',
        phone: '780056164',
      },
      { fullName: 'NSANZIMANA Daniel', phone: '0786302476' },
    ],
  },
  {
    teamSlug: 'accident-tracker-system',
    teamName: 'Accident Tracker System',
    companyName: 'Accident Tracker System',
    department: 'IT',
    field: 'Transport',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'idea',
    sixMonthStatus: 'in progress',
    rdbStatus: 'Not yet',
    mentor: { name: 'Rusanganwa Addyl', phone: '788418103' },
    projectTitle: 'Accident Tracker System',
    members: [
      { fullName: 'Buregeya Uwase Ritha', email: 'uwaserita123@gmail.com', phone: '780697082' },
      { fullName: 'IRAKOZE Aline', phone: '0792459756' },
      { fullName: 'INGABIRE Joseline' },
    ],
  },
  {
    teamSlug: 'smart-energy-monitoring-system',
    teamName: 'Smart Energy Monitoring System',
    companyName: 'Smart Energy Monitoring System',
    department: 'MCT',
    field: 'Energy',
    enrollmentDate: new Date('2025-03-01'),
    plannedGraduation: new Date('2026-03-01'),
    statusAtEnrollment: 'in progress',
    sixMonthStatus: 'in progress (prototype)',
    rdbStatus: 'Company registered; project registration in process',
    mentor: { name: 'Adolph MUNYANEZA', phone: '788732935' },
    projectTitle: 'Smart Energy Monitoring System',
    members: [
      { fullName: 'BYIRINGIRO ISAAC', email: 'isbyiringiroi@gmail.com', phone: '789479682' },
      { fullName: 'ISHIMWE Honore', phone: '0780482633' },
      { fullName: 'ISHIMWE Fabrice', phone: '0787414868' },
      { fullName: 'IRANKOMEJE Fevor' },
    ],
  },
  {
    teamSlug: 'nkunsi-engineering-group',
    teamName: 'Nkunsi Engineering Group Ltd',
    companyName: 'Nkunsi Engineering Group Ltd',
    department: 'EEE',
    field: 'Construction',
    enrollmentDate: new Date('2025-08-01'),
    plannedGraduation: new Date('2026-08-01'),
    statusAtEnrollment: 'development phase',
    sixMonthStatus: 'operating',
    rdbStatus: 'Registered',
    mentor: { name: 'Mugabe Assiel', phone: '730672373' },
    projectTitle: 'Nkunsi Engineering Group Ltd',
    members: [
      { fullName: 'Josiane IRASUBIZA', email: 'josianne2003ira@gmail.com', phone: '784446345' },
      { fullName: 'Gikundiro Sarah', phone: '0785590999' },
    ],
  },
];

const fieldToCategory = (field: string): ProjectCategory => {
  const normalized = field.toLowerCase();
  if (normalized.includes('agri')) return ProjectCategory.Agriculture;
  if (normalized.includes('environment')) return ProjectCategory.Sustainability;
  if (normalized.includes('energy')) return ProjectCategory.Sustainability;
  if (normalized.includes('fashion') || normalized.includes('design')) return ProjectCategory.Design;
  if (normalized.includes('ict') || normalized.includes('transport') || normalized.includes('tech')) {
    return ProjectCategory.Technology;
  }
  if (normalized.includes('manufacturing')) return ProjectCategory.Other;
  if (normalized.includes('construction')) return ProjectCategory.Other;
  return ProjectCategory.Other;
};

const statusToEnrollmentEnum = (status: string): ProjectStatusAtEnrollment => {
  const normalized = status.toLowerCase();
  if (normalized.includes('design')) return ProjectStatusAtEnrollment.Prototype;
  if (normalized.includes('progress')) return ProjectStatusAtEnrollment.Prototype;
  if (normalized.includes('develop')) return ProjectStatusAtEnrollment.Prototype;
  if (normalized.includes('prototype')) return ProjectStatusAtEnrollment.Prototype;
  if (normalized.includes('mvp')) return ProjectStatusAtEnrollment.MVP;
  if (normalized.includes('beta')) return ProjectStatusAtEnrollment.Beta;
  if (normalized.includes('launch')) return ProjectStatusAtEnrollment.Launched;
  return ProjectStatusAtEnrollment.Idea;
};

const progressFromSixMonthStatus = (status: string): number => {
  const normalized = status.toLowerCase();
  if (normalized.includes('operating')) return 100;
  if (normalized.includes('final')) return 80;
  if (normalized.includes('testing')) return 70;
  if (normalized.includes('prototype')) return 60;
  if (normalized.includes('progress')) return 50;
  if (normalized.includes('design')) return 20;
  return 40;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const sanitize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const PASSWORDS = {
  director: 'Director123!',
  incubator: 'Incubator123!',
  mentor: 'Mentor123!',
};

const makeFallbackEmail = (first: string, last: string | undefined, teamSlug: string) => {
  const firstPart = sanitize(first || 'member');
  const lastPart = sanitize(last || 'member');
  const domain = `${slugify(teamSlug || 'legacy')}.incubation.test`;
  return `${firstPart}.${lastPart || 'member'}@${domain}`;
};

const mentorEmail = (name: string, teamSlug: string) => {
  const { first, last } = splitName(name);
  const firstPart = sanitize(first || 'mentor');
  const lastPart = sanitize(last || 'mentor');
  const domain = `${slugify(teamSlug || 'legacy')}.mentor.test`;
  return `${firstPart}.${lastPart || 'mentor'}@${domain}`;
};

const ensureEmailPreferences = async (userId: string) => {
  await prisma.emailPreferences.upsert({
    where: { user_id: userId },
    update: {},
    create: { user_id: userId },
  });
};

const splitName = (fullName: string): { first: string; middle?: string; last?: string } => {
  const parts = fullName.trim().split(/\s+/);
  const first = parts.shift() ?? '';
  const last = parts.pop();
  const middle = parts.length ? parts.join(' ') : undefined;
  return { first, middle, last };
};

async function seedLegacyData() {
  console.log('📥 Importing legacy incubatees and projects...');

  for (const entry of legacyEntries) {
    const team = await prisma.team.create({
      data: {
        team_name: entry.teamName,
        company_name: entry.companyName,
        status: TeamStatus.active,
        enrollment_date: entry.enrollmentDate,
        rdb_registration_status: entry.rdbStatus ?? undefined,
      },
    });

    const projectCategory = fieldToCategory(entry.field);
    const statusAtEnrollment = statusToEnrollmentEnum(entry.statusAtEnrollment);
    const progress = progressFromSixMonthStatus(entry.sixMonthStatus);

    let leaderAssigned = false;

    for (const member of entry.members) {
      const { first, middle, last } = splitName(member.fullName);
      const email = member.email ?? makeFallbackEmail(first, last ?? middle, entry.teamSlug);
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          password_hash: await PasswordUtils.hash(PASSWORDS.incubator),
          role: UserRole.incubator,
          name: member.fullName,
          first_name: first,
          middle_name: middle,
          last_name: last,
          phone: member.phone,
          current_role: leaderAssigned ? CurrentRoleInProject.Employee : CurrentRoleInProject.ProjectLead,
          enrollment_status: EnrollmentStatus.CurrentlyEnrolled,
          major_program: entry.department,
          program_of_study: entry.department,
          graduation_year: entry.plannedGraduation?.getFullYear(),
          skills: [],
          support_interests: [],
          password_status: PasswordStatus.ok,
          profile_completion_percentage: 60,
          profile_phase_completion: {},
        },
      });

      await ensureEmailPreferences(user.id);

      await prisma.teamMember.create({
        data: {
          team_id: team.id,
          user_id: user.id,
          role: leaderAssigned ? TeamMemberRole.member : TeamMemberRole.team_leader,
        },
      });
      leaderAssigned = true;
    }

    await prisma.project.create({
      data: {
        name: entry.projectTitle,
        startup_company_name: entry.companyName,
        description: `Imported from legacy sheet. Mentor: ${
          entry.mentor?.name ?? 'N/A'
        }. Support: ${entry.support ?? 'N/A'}. Challenges: ${entry.challenges ?? 'N/A'}. Planned graduation: ${
          entry.plannedGraduation?.toISOString().split('T')[0] ?? 'N/A'
        }.`,
        challenge_description: entry.challenges,
        status_at_enrollment: statusAtEnrollment,
        team_id: team.id,
        category: projectCategory,
        status: ProjectStatus.active,
        progress,
      },
    });

    if (entry.mentor?.name) {
      const mentorUser = await prisma.user.upsert({
        where: { email: mentorEmail(entry.mentor.name, entry.teamSlug) },
        update: { phone: entry.mentor.phone },
        create: {
          email: mentorEmail(entry.mentor.name, entry.teamSlug),
          password_hash: await PasswordUtils.hash(PASSWORDS.mentor),
          role: UserRole.mentor,
          name: entry.mentor.name,
          first_name: splitName(entry.mentor.name).first,
          middle_name: splitName(entry.mentor.name).middle,
          last_name: splitName(entry.mentor.name).last,
          phone: entry.mentor.phone,
          password_status: PasswordStatus.ok,
          enrollment_status: EnrollmentStatus.Other,
          profile_completion_percentage: 40,
          profile_phase_completion: {},
        },
      });

      await ensureEmailPreferences(mentorUser.id);

      const mentorRecord = await prisma.mentor.upsert({
        where: { user_id: mentorUser.id },
        update: { phone: entry.mentor.phone },
        create: {
          user_id: mentorUser.id,
          phone: entry.mentor.phone,
        },
      });

      await prisma.mentorAssignment.upsert({
        where: { mentor_id_team_id: { mentor_id: mentorRecord.id, team_id: team.id } },
        update: {},
        create: {
          mentor_id: mentorRecord.id,
          team_id: team.id,
        },
      });
    }

    console.log(`  ✅ Seeded team + project: ${entry.teamName}`);
  }
}

async function seedCoreUsers() {
  const director = await prisma.user.upsert({
    where: { email: 'director@university.edu' },
    update: {},
    create: {
      email: 'director@university.edu',
      password_hash: await PasswordUtils.hash(PASSWORDS.director),
      role: UserRole.director,
      name: 'Dr. Sarah Johnson',
      first_name: 'Sarah',
      middle_name: null,
      last_name: 'Johnson',
      password_status: PasswordStatus.ok,
    },
  });

  await ensureEmailPreferences(director.id);

  console.log('✅ Director user created', director.email);
}

async function main() {
  console.log('🌱 Starting database seeding...');

  await seedCoreUsers();
  await seedLegacyData();

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Test Credentials:');
  console.log(`Director: director@university.edu / ${PASSWORDS.director}`);
  console.log(`Incubators (imported): password set to ${PASSWORDS.incubator} (please force reset)`);
  console.log(`Mentors (imported): password set to ${PASSWORDS.mentor} (please force reset)`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });