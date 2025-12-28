import {
  PrismaClient,
  UserRole,
  PasswordStatus,
  UserStatus,
  EnrollmentStatus,
  CurrentRoleInProject,
  TeamStatus,
  ProjectStatus,
  ProjectCategory,
  ProjectStatusAtEnrollment,
  ItemCategory,
  ItemType,
  ItemCondition,
  InventoryStatus,
  RequestPriority,
  RequestStatus,
  DeliveryStatus,
} from '@prisma/client';
import { PasswordUtils } from '../src/utils/password';

const prisma = new PrismaClient();

// Common passwords for testing
const PASSWORDS = {
  director: 'Director123!',
  manager: 'Manager123!',
  mentor: 'Mentor123!',
  incubator: 'Incubator123!',
};

// Helper function to ensure email preferences
async function ensureEmailPreferences(userId: string) {
  await prisma.emailPreferences.upsert({
    where: { user_id: userId },
    update: {},
    create: { user_id: userId },
  });
}

// Generate request number helper
async function generateRequestNumber(year: number): Promise<string> {
  const prefix = `REQ-${year}-`;
  const lastRequest = await prisma.materialRequest.findFirst({
    where: {
      request_number: {
        startsWith: prefix,
      },
    },
    orderBy: {
      request_number: 'desc',
    },
  });

  let sequence = 1;
  if (lastRequest?.request_number) {
    const lastSequence = parseInt(
      lastRequest.request_number.replace(prefix, ''),
      10
    );
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`;
}

async function seedUsers() {
  console.log('👥 Seeding users...');

  // 1. Director
  const director = await prisma.user.upsert({
    where: { email: 'director@university.edu' },
    update: {},
    create: {
      email: 'director@university.edu',
      password_hash: await PasswordUtils.hash(PASSWORDS.director),
      role: UserRole.director,
      name: 'Dr. Sarah Johnson',
      first_name: 'Sarah',
      last_name: 'Johnson',
      password_status: PasswordStatus.ok,
      status: UserStatus.active,
    },
  });
  await ensureEmailPreferences(director.id);
  console.log('  ✅ Director created:', director.email);

  // 2. Manager
  const manager = await prisma.user.upsert({
    where: { email: 'manager@university.edu' },
    update: {},
    create: {
      email: 'manager@university.edu',
      password_hash: await PasswordUtils.hash(PASSWORDS.manager),
      role: UserRole.manager,
      name: 'Michael Chen',
      first_name: 'Michael',
      last_name: 'Chen',
      phone: '+250788123456',
      password_status: PasswordStatus.ok,
      status: UserStatus.active,
      profile_completion_percentage: 80,
    },
  });
  await ensureEmailPreferences(manager.id);
  console.log('  ✅ Manager created:', manager.email);

  // 3. Mentors
  const mentors = [
    {
      email: 'mentor1@university.edu',
      name: 'Dr. James Wilson',
      first_name: 'James',
      last_name: 'Wilson',
      phone: '+250788234567',
      expertise: 'Technology and Software Development',
    },
    {
      email: 'mentor2@university.edu',
      name: 'Prof. Mary Okafor',
      first_name: 'Mary',
      last_name: 'Okafor',
      phone: '+250788345678',
      expertise: 'Business Strategy and Entrepreneurship',
    },
    {
      email: 'mentor3@university.edu',
      name: 'Dr. David Kimani',
      first_name: 'David',
      last_name: 'Kimani',
      phone: '+250788456789',
      expertise: 'Product Design and Innovation',
    },
  ];

  const createdMentors = [];
  for (const mentorData of mentors) {
    const user = await prisma.user.upsert({
      where: { email: mentorData.email },
      update: {},
      create: {
        email: mentorData.email,
        password_hash: await PasswordUtils.hash(PASSWORDS.mentor),
        role: UserRole.mentor,
        name: mentorData.name,
        first_name: mentorData.first_name,
        last_name: mentorData.last_name,
        phone: mentorData.phone,
        password_status: PasswordStatus.ok,
        status: UserStatus.active,
        profile_completion_percentage: 70,
      },
    });
    await ensureEmailPreferences(user.id);

    const mentor = await prisma.mentor.upsert({
      where: { user_id: user.id },
      update: {},
      create: {
        user_id: user.id,
        expertise: mentorData.expertise,
        phone: mentorData.phone,
      },
    });

    createdMentors.push({ user, mentor });
    console.log('  ✅ Mentor created:', user.email);
  }

  // 4. Incubators (9 total, 3 per team)
  const incubators = [
    // Team 1
    {
      email: 'team1.leader@university.edu',
      name: 'Alex Mukamana',
      first_name: 'Alex',
      last_name: 'Mukamana',
      phone: '+250788567890',
      team: 1,
      role: CurrentRoleInProject.ProjectLead,
    },
    {
      email: 'team1.member1@university.edu',
      name: 'Grace Uwase',
      first_name: 'Grace',
      last_name: 'Uwase',
      phone: '+250788678901',
      team: 1,
      role: CurrentRoleInProject.Employee,
    },
    {
      email: 'team1.member2@university.edu',
      name: 'Peter Nkurunziza',
      first_name: 'Peter',
      last_name: 'Nkurunziza',
      phone: '+250788789012',
      team: 1,
      role: CurrentRoleInProject.Employee,
    },
    // Team 2
    {
      email: 'team2.leader@university.edu',
      name: 'Amina Hassan',
      first_name: 'Amina',
      last_name: 'Hassan',
      phone: '+250788890123',
      team: 2,
      role: CurrentRoleInProject.ProjectLead,
    },
    {
      email: 'team2.member1@university.edu',
      name: 'Robert Kamau',
      first_name: 'Robert',
      last_name: 'Kamau',
      phone: '+250788901234',
      team: 2,
      role: CurrentRoleInProject.Employee,
    },
    {
      email: 'team2.member2@university.edu',
      name: 'Fatima Diallo',
      first_name: 'Fatima',
      last_name: 'Diallo',
      phone: '+250789012345',
      team: 2,
      role: CurrentRoleInProject.Employee,
    },
    // Team 3
    {
      email: 'team3.leader@university.edu',
      name: 'John Ntare',
      first_name: 'John',
      last_name: 'Ntare',
      phone: '+250789123456',
      team: 3,
      role: CurrentRoleInProject.ProjectLead,
    },
    {
      email: 'team3.member1@university.edu',
      name: 'Sarah Mutesi',
      first_name: 'Sarah',
      last_name: 'Mutesi',
      phone: '+250789234567',
      team: 3,
      role: CurrentRoleInProject.Employee,
    },
    {
      email: 'team3.member2@university.edu',
      name: 'Daniel Ochieng',
      first_name: 'Daniel',
      last_name: 'Ochieng',
      phone: '+250789345678',
      team: 3,
      role: CurrentRoleInProject.Employee,
    },
  ];

  const createdIncubators = [];
  for (const incubatorData of incubators) {
    const user = await prisma.user.upsert({
      where: { email: incubatorData.email },
      update: {},
      create: {
        email: incubatorData.email,
        password_hash: await PasswordUtils.hash(PASSWORDS.incubator),
        role: UserRole.incubator,
        name: incubatorData.name,
        first_name: incubatorData.first_name,
        last_name: incubatorData.last_name,
        phone: incubatorData.phone,
        password_status: PasswordStatus.ok,
        status: UserStatus.active,
        enrollment_status: EnrollmentStatus.CurrentlyEnrolled,
        major_program: 'Computer Science',
        program_of_study: 'Software Engineering',
        graduation_year: 2026,
        current_role: incubatorData.role,
        skills: ['JavaScript', 'React', 'Node.js', 'Product Management'],
        support_interests: ['Mentorship', 'Funding', 'Technical Support'],
        profile_completion_percentage: 75,
      },
    });
    await ensureEmailPreferences(user.id);
    createdIncubators.push({ user, team: incubatorData.team });
    console.log('  ✅ Incubator created:', user.email);
  }

  return {
    director,
    manager,
    mentors: createdMentors,
    incubators: createdIncubators,
  };
}

async function seedTeamsAndProjects(users: any) {
  console.log('🏢 Seeding teams and projects...');

  const teams = [
    {
      team_name: 'TechInnovators',
      company_name: 'TechInnovators Ltd',
      project_name: 'Smart Learning Platform',
      project_description:
        'An AI-powered e-learning platform that personalizes educational content for students.',
      category: ProjectCategory.Education,
      statusAtEnrollment: ProjectStatusAtEnrollment.Prototype,
      progress: 65,
      mentorIndex: 0,
    },
    {
      team_name: 'AgriTech Solutions',
      company_name: 'AgriTech Solutions Co.',
      project_name: 'IoT-Based Crop Monitoring System',
      project_description:
        'Smart sensors and mobile app for real-time crop monitoring and automated irrigation.',
      category: ProjectCategory.Agriculture,
      statusAtEnrollment: ProjectStatusAtEnrollment.MVP,
      progress: 80,
      mentorIndex: 1,
    },
    {
      team_name: 'HealthConnect',
      company_name: 'HealthConnect Rwanda',
      project_name: 'Telemedicine Mobile Application',
      project_description:
        'A mobile app connecting patients with healthcare providers for remote consultations.',
      category: ProjectCategory.Health,
      statusAtEnrollment: ProjectStatusAtEnrollment.Prototype,
      progress: 55,
      mentorIndex: 2,
    },
  ];

  const createdTeams = [];
  const createdProjects = [];

  for (let i = 0; i < teams.length; i++) {
    const teamData = teams[i];

    // Create team
    const team = await prisma.team.create({
      data: {
        team_name: teamData.team_name,
        company_name: teamData.company_name,
        status: TeamStatus.active,
        enrollment_date: new Date('2024-01-15'),
        rdb_registration_status: 'Registered',
      },
    });

    // Add team members
    const teamIncubators = users.incubators.filter(
      (inc: any) => inc.team === i + 1
    );
    let isLeader = true;
    for (const { user } of teamIncubators) {
      await prisma.teamMember.create({
        data: {
          team_id: team.id,
          user_id: user.id,
          role: isLeader ? 'team_leader' : 'member',
        },
      });
      isLeader = false;
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        name: teamData.project_name,
        description: teamData.project_description,
        startup_company_name: teamData.company_name,
        challenge_description:
          'Addressing the need for accessible and personalized solutions in their respective domains.',
        status_at_enrollment: teamData.statusAtEnrollment,
        team_id: team.id,
        category: teamData.category,
        status: ProjectStatus.active,
        progress: teamData.progress,
      },
    });

    // Assign mentor
    const mentor = users.mentors[teamData.mentorIndex];
    await prisma.mentorAssignment.create({
      data: {
        mentor_id: mentor.mentor.id,
        team_id: team.id,
      },
    });

    createdTeams.push(team);
    createdProjects.push(project);
    console.log(`  ✅ Team "${team.team_name}" with project "${project.name}" created`);
  }

  return { teams: createdTeams, projects: createdProjects };
}

async function seedInventory(manager: any) {
  console.log('📦 Seeding inventory...');

  // Create storage locations
  const locations = [
    {
      name: 'Main Storage Room',
      building: 'Building A',
      floor: 'Ground Floor',
      room: 'Room 101',
      notes: 'Primary storage location for equipment',
    },
    {
      name: 'Electronics Storage',
      building: 'Building A',
      floor: 'First Floor',
      room: 'Room 201',
      notes: 'Dedicated space for electronic items',
    },
    {
      name: 'Refreshments Cabinet',
      building: 'Building B',
      floor: 'Ground Floor',
      room: 'Kitchen',
      shelf: 'Top Shelf',
      notes: 'Storage for consumables and refreshments',
    },
    {
      name: 'Office Supplies Closet',
      building: 'Building A',
      floor: 'Ground Floor',
      room: 'Room 105',
      notes: 'Office supplies and stationery',
    },
  ];

  const createdLocations = [];
  for (const locData of locations) {
    const location = await prisma.storageLocation.create({
      data: locData,
    });
    createdLocations.push(location);
  }
  console.log(`  ✅ Created ${createdLocations.length} storage locations`);

  // Create suppliers
  const suppliers = [
    {
      name: 'TechSupply Rwanda',
      contact_person: 'Jean Bosco',
      email: 'orders@techsupply.rw',
      phone: '+250788111111',
      address: 'KG 123 St, Kigali, Rwanda',
      notes: 'Primary supplier for electronics and equipment',
      rating: 4.5,
    },
    {
      name: 'Office Depot Rwanda',
      contact_person: 'Marie Claire',
      email: 'sales@officedepot.rw',
      phone: '+250788222222',
      address: 'KG 456 St, Kigali, Rwanda',
      notes: 'Supplier for office supplies and furniture',
      rating: 4.2,
    },
    {
      name: 'Fresh Foods Co.',
      contact_person: 'Paul Murenzi',
      email: 'info@freshfoods.rw',
      phone: '+250788333333',
      address: 'KG 789 St, Kigali, Rwanda',
      notes: 'Supplier for refreshments and consumables',
      rating: 4.0,
    },
  ];

  const createdSuppliers = [];
  for (const supData of suppliers) {
    const supplier = await prisma.supplier.create({
      data: supData,
    });
    createdSuppliers.push(supplier);
  }
  console.log(`  ✅ Created ${createdSuppliers.length} suppliers`);

  // Create inventory items
  const inventoryItems = [
    // Equipment
    {
      name: 'Laptop - Dell Latitude 5520',
      description: '15.6" FHD business laptop, Intel Core i7, 16GB RAM, 512GB SSD',
      category: ItemCategory.Electronics,
      item_type: ItemType.FixedAsset,
      sku: 'EQ-LAP-DELL-001',
      barcode: '1234567890123',
      total_quantity: 10,
      available_quantity: 6,
      reserved_quantity: 2,
      condition: ItemCondition.Good,
      status: InventoryStatus.available,
      location_id: createdLocations[1].id,
      supplier_id: createdSuppliers[0].id,
      purchase_date: new Date('2023-06-01'),
      warranty_start: new Date('2023-06-01'),
      warranty_end: new Date('2026-06-01'),
      warranty_provider: 'Dell Rwanda',
      maintenance_interval: 180,
      last_maintenance: new Date('2024-01-15'),
      next_maintenance: new Date('2024-07-15'),
      tags: ['laptop', 'computer', 'electronics'],
      notes: 'Standard issue laptops for incubator teams',
    },
    {
      name: 'Projector - Epson EX3260',
      description: 'SVGA 3LCD projector, 3600 lumens',
      category: ItemCategory.Electronics,
      item_type: ItemType.FixedAsset,
      sku: 'EQ-PROJ-EPS-001',
      barcode: '1234567890124',
      total_quantity: 3,
      available_quantity: 2,
      condition: ItemCondition.Good,
      status: InventoryStatus.available,
      location_id: createdLocations[1].id,
      supplier_id: createdSuppliers[0].id,
      purchase_date: new Date('2023-08-10'),
      tags: ['projector', 'presentation', 'electronics'],
      notes: 'For presentations and workshops',
    },
    {
      name: 'Office Desk - Standard',
      description: '120cm x 60cm office desk with drawers',
      category: ItemCategory.Furniture,
      item_type: ItemType.FixedAsset,
      sku: 'EQ-DSK-STD-001',
      total_quantity: 20,
      available_quantity: 15,
      condition: ItemCondition.New,
      status: InventoryStatus.available,
      location_id: createdLocations[0].id,
      supplier_id: createdSuppliers[1].id,
      purchase_date: new Date('2024-01-05'),
      tags: ['furniture', 'desk', 'office'],
      notes: 'Standard office desks for workspace',
    },
    {
      name: 'Office Chair - Ergonomic',
      description: 'Ergonomic office chair with lumbar support',
      category: ItemCategory.Furniture,
      item_type: ItemType.FixedAsset,
      sku: 'EQ-CHAIR-ERG-001',
      total_quantity: 25,
      available_quantity: 18,
      condition: ItemCondition.New,
      status: InventoryStatus.available,
      location_id: createdLocations[0].id,
      supplier_id: createdSuppliers[1].id,
      purchase_date: new Date('2024-01-05'),
      tags: ['furniture', 'chair', 'ergonomic'],
      notes: 'Comfortable chairs for long work sessions',
    },
    // Tools
    {
      name: 'Soldering Iron Kit',
      description: '60W soldering iron with stand and accessories',
      category: ItemCategory.Tools,
      item_type: ItemType.Returnable,
      sku: 'TOOL-SOLDER-001',
      total_quantity: 5,
      available_quantity: 3,
      condition: ItemCondition.Good,
      status: InventoryStatus.available,
      location_id: createdLocations[0].id,
      supplier_id: createdSuppliers[0].id,
      purchase_date: new Date('2023-09-20'),
      tags: ['tools', 'electronics', 'prototyping'],
      notes: 'For hardware prototyping projects',
    },
    {
      name: 'Multimeter - Digital',
      description: 'Digital multimeter for electrical testing',
      category: ItemCategory.Tools,
      item_type: ItemType.Returnable,
      sku: 'TOOL-MULTI-001',
      total_quantity: 8,
      available_quantity: 6,
      condition: ItemCondition.Good,
      status: InventoryStatus.available,
      location_id: createdLocations[0].id,
      supplier_id: createdSuppliers[0].id,
      purchase_date: new Date('2023-09-20'),
      tags: ['tools', 'testing', 'electronics'],
      notes: 'For electrical circuit testing',
    },
    // Consumables/Refreshments
    {
      name: 'Coffee - Ground',
      description: 'Premium ground coffee beans, 500g bags',
      category: ItemCategory.Refreshments,
      item_type: ItemType.Consumable,
      sku: 'CONS-COFFEE-001',
      total_quantity: 50,
      available_quantity: 30,
      consumed_quantity: 20,
      min_stock_level: 10,
      reorder_quantity: 25,
      condition: ItemCondition.New,
      status: InventoryStatus.available,
      location_id: createdLocations[2].id,
      supplier_id: createdSuppliers[2].id,
      purchase_date: new Date('2024-01-10'),
      expiration_date: new Date('2025-06-01'),
      is_frequently_distributed: true,
      distribution_unit: 'bag',
      typical_consumption_rate: 2, // bags per week
      tags: ['refreshments', 'coffee', 'consumable'],
      notes: 'Daily refreshments for teams',
    },
    {
      name: 'Bottled Water',
      description: '500ml bottled water, 24-pack',
      category: ItemCategory.Refreshments,
      item_type: ItemType.Consumable,
      sku: 'CONS-WATER-001',
      total_quantity: 100,
      available_quantity: 45,
      consumed_quantity: 55,
      min_stock_level: 20,
      reorder_quantity: 50,
      condition: ItemCondition.New,
      status: InventoryStatus.available,
      location_id: createdLocations[2].id,
      supplier_id: createdSuppliers[2].id,
      purchase_date: new Date('2024-01-12'),
      expiration_date: new Date('2025-12-31'),
      is_frequently_distributed: true,
      distribution_unit: 'bottle',
      typical_consumption_rate: 15, // bottles per week
      tags: ['refreshments', 'water', 'consumable'],
      notes: 'Daily refreshments for teams',
    },
    {
      name: 'Snacks - Assorted',
      description: 'Mixed snack pack (biscuits, chips, nuts)',
      category: ItemCategory.Refreshments,
      item_type: ItemType.Consumable,
      sku: 'CONS-SNACK-001',
      total_quantity: 80,
      available_quantity: 35,
      consumed_quantity: 45,
      min_stock_level: 15,
      reorder_quantity: 40,
      condition: ItemCondition.New,
      status: InventoryStatus.available,
      location_id: createdLocations[2].id,
      supplier_id: createdSuppliers[2].id,
      purchase_date: new Date('2024-01-14'),
      expiration_date: new Date('2024-12-31'),
      is_frequently_distributed: true,
      distribution_unit: 'pack',
      typical_consumption_rate: 10, // packs per week
      tags: ['refreshments', 'snacks', 'consumable'],
      notes: 'For meetings and workshops',
    },
    // Office Supplies
    {
      name: 'Notebooks - A4',
      description: 'A4 ruled notebooks, 100 pages, pack of 10',
      category: ItemCategory.OfficeSupplies,
      item_type: ItemType.Consumable,
      sku: 'OFF-NOTEBOOK-001',
      total_quantity: 60,
      available_quantity: 40,
      min_stock_level: 10,
      reorder_quantity: 30,
      condition: ItemCondition.New,
      status: InventoryStatus.available,
      location_id: createdLocations[3].id,
      supplier_id: createdSuppliers[1].id,
      purchase_date: new Date('2024-01-08'),
      tags: ['office', 'stationery', 'notebooks'],
      notes: 'Standard notebooks for teams',
    },
    {
      name: 'Pens - Blue Ink',
      description: 'Blue ink ballpoint pens, pack of 20',
      category: ItemCategory.OfficeSupplies,
      item_type: ItemType.Consumable,
      sku: 'OFF-PEN-001',
      total_quantity: 200,
      available_quantity: 120,
      min_stock_level: 50,
      reorder_quantity: 100,
      condition: ItemCondition.New,
      status: InventoryStatus.available,
      location_id: createdLocations[3].id,
      supplier_id: createdSuppliers[1].id,
      purchase_date: new Date('2024-01-08'),
      tags: ['office', 'stationery', 'pens'],
      notes: 'Standard writing pens',
    },
    {
      name: 'Printer Paper - A4',
      description: 'A4 white printer paper, 500 sheets per ream',
      category: ItemCategory.OfficeSupplies,
      item_type: ItemType.Consumable,
      sku: 'OFF-PAPER-001',
      total_quantity: 30,
      available_quantity: 15,
      min_stock_level: 5,
      reorder_quantity: 20,
      condition: ItemCondition.New,
      status: InventoryStatus.low_stock,
      location_id: createdLocations[3].id,
      supplier_id: createdSuppliers[1].id,
      purchase_date: new Date('2024-01-05'),
      tags: ['office', 'paper', 'printing'],
      notes: 'Printer paper for documents',
    },
    // Items in maintenance
    {
      name: '3D Printer - Ender 3',
      description: 'FDM 3D printer for prototyping',
      category: ItemCategory.Equipment,
      item_type: ItemType.FixedAsset,
      sku: 'EQ-3D-END-001',
      total_quantity: 2,
      available_quantity: 0,
      condition: ItemCondition.Fair,
      status: InventoryStatus.maintenance,
      location_id: createdLocations[1].id,
      supplier_id: createdSuppliers[0].id,
      purchase_date: new Date('2023-07-15'),
      maintenance_interval: 90,
      last_maintenance: new Date('2024-01-20'),
      tags: ['3d-printer', 'prototyping', 'equipment'],
      notes: 'Currently under maintenance',
    },
  ];

  const createdItems = [];
  for (const itemData of inventoryItems) {
    const item = await prisma.inventoryItem.create({
      data: itemData,
    });
    createdItems.push(item);
  }
  console.log(`  ✅ Created ${createdItems.length} inventory items`);

  return {
    locations: createdLocations,
    suppliers: createdSuppliers,
    items: createdItems,
  };
}

async function seedRequests(
  users: any,
  teams: any[],
  projects: any[],
  inventory: any
) {
  console.log('📋 Seeding material requests...');

  const currentYear = new Date().getFullYear();
  let requestSeq = 1;

  const requests = [
    // Approved request
    {
      teamIndex: 0,
      projectIndex: 0,
      requesterIndex: 0, // Team leader
      title: 'Laptops for Development Team',
      description:
        'Requesting 3 laptops for team members to work on the Smart Learning Platform project',
      priority: RequestPriority.High,
      status: RequestStatus.approved,
      is_consumable_request: false,
      requires_quick_approval: false,
      requested_at: new Date('2024-01-20'),
      required_by: new Date('2024-02-01'),
      reviewed_at: new Date('2024-01-21'),
      approved_at: new Date('2024-01-21'),
      reviewed_by: 0, // manager
      approved_by: 0, // manager
      delivery_status: DeliveryStatus.delivered,
      delivered_at: new Date('2024-01-25'),
      items: [
        {
          inventory_item_id: inventory.items[0].id, // Laptop
          item_name: inventory.items[0].name,
          quantity: 3,
          unit: 'unit',
          status: 'approved',
          approved_quantity: 3,
        },
      ],
    },
    // Pending review request
    {
      teamIndex: 1,
      projectIndex: 1,
      requesterIndex: 0, // Team 2 leader
      title: 'IoT Sensors for Crop Monitoring',
      description:
        'Need 10 temperature and humidity sensors for the IoT-based crop monitoring system',
      priority: RequestPriority.Medium,
      status: RequestStatus.pending_review,
      is_consumable_request: false,
      requires_quick_approval: false,
      requested_at: new Date('2024-01-28'),
      required_by: new Date('2024-02-15'),
      items: [
        {
          inventory_item_id: null,
          item_name: 'IoT Temperature Sensor',
          quantity: 10,
          unit: 'unit',
          description: 'DHT22 temperature and humidity sensor',
          status: 'pending',
        },
      ],
    },
    // Draft request
    {
      teamIndex: 2,
      projectIndex: 2,
      requesterIndex: 0, // Team 3 leader
      title: 'Office Supplies for Team',
      description: 'Office supplies needed for daily operations',
      priority: RequestPriority.Low,
      status: RequestStatus.draft,
      is_consumable_request: false,
      requires_quick_approval: false,
      requested_at: new Date('2024-01-29'),
      items: [
        {
          inventory_item_id: inventory.items[9].id, // Notebooks
          item_name: inventory.items[9].name,
          quantity: 5,
          unit: 'pack',
          status: 'pending',
        },
        {
          inventory_item_id: inventory.items[10].id, // Pens
          item_name: inventory.items[10].name,
          quantity: 2,
          unit: 'pack',
          status: 'pending',
        },
      ],
    },
    // Consumable request - refreshments
    {
      teamIndex: 0,
      projectIndex: 0,
      requesterIndex: 0, // Team 1 leader
      title: 'Refreshments for Workshop',
      description:
        'Refreshments needed for upcoming team workshop on February 5th',
      priority: RequestPriority.Medium,
      status: RequestStatus.approved,
      is_consumable_request: true,
      requires_quick_approval: true,
      requested_at: new Date('2024-01-30'),
      required_by: new Date('2024-02-05'),
      reviewed_at: new Date('2024-01-30'),
      approved_at: new Date('2024-01-30'),
      reviewed_by: 0, // manager
      approved_by: 0, // manager
      delivery_status: DeliveryStatus.delivered,
      delivered_at: new Date('2024-02-04'),
      items: [
        {
          inventory_item_id: inventory.items[6].id, // Coffee
          item_name: inventory.items[6].name,
          quantity: 5,
          unit: 'bag',
          is_consumable: true,
          status: 'approved',
          approved_quantity: 5,
          distributed_quantity: 5,
          distribution_date: new Date('2024-02-05'),
        },
        {
          inventory_item_id: inventory.items[7].id, // Water
          item_name: inventory.items[7].name,
          quantity: 2,
          unit: 'pack',
          is_consumable: true,
          status: 'approved',
          approved_quantity: 2,
          distributed_quantity: 2,
          distribution_date: new Date('2024-02-05'),
        },
        {
          inventory_item_id: inventory.items[8].id, // Snacks
          item_name: inventory.items[8].name,
          quantity: 3,
          unit: 'pack',
          is_consumable: true,
          status: 'approved',
          approved_quantity: 3,
          distributed_quantity: 3,
          distribution_date: new Date('2024-02-05'),
        },
      ],
    },
    // Partially approved request
    {
      teamIndex: 1,
      projectIndex: 1,
      requesterIndex: 0, // Team 2 leader
      title: 'Equipment for Field Testing',
      description:
        'Various equipment needed for field testing of the crop monitoring system',
      priority: RequestPriority.High,
      status: RequestStatus.partially_approved,
      is_consumable_request: false,
      requires_quick_approval: false,
      requested_at: new Date('2024-01-25'),
      required_by: new Date('2024-02-10'),
      reviewed_at: new Date('2024-01-26'),
      approved_at: new Date('2024-01-26'),
      reviewed_by: 0, // manager
      approved_by: 0, // manager
      delivery_status: DeliveryStatus.ordered,
      ordered_at: new Date('2024-01-27'),
      items: [
        {
          inventory_item_id: inventory.items[4].id, // Soldering Iron
          item_name: inventory.items[4].name,
          quantity: 2,
          unit: 'kit',
          status: 'approved',
          approved_quantity: 2,
        },
        {
          inventory_item_id: inventory.items[5].id, // Multimeter
          item_name: inventory.items[5].name,
          quantity: 5,
          unit: 'unit',
          status: 'approved',
          approved_quantity: 3, // Partially approved
        },
        {
          inventory_item_id: null,
          item_name: 'GPS Module',
          quantity: 5,
          unit: 'unit',
          description: 'GPS module for location tracking',
          status: 'declined',
        },
      ],
    },
    // Declined request
    {
      teamIndex: 2,
      projectIndex: 2,
      requesterIndex: 0, // Team 3 leader
      title: 'High-End Workstation',
      description: 'Requesting a high-end workstation for video editing',
      priority: RequestPriority.Low,
      status: RequestStatus.declined,
      is_consumable_request: false,
      requires_quick_approval: false,
      requested_at: new Date('2024-01-15'),
      reviewed_at: new Date('2024-01-16'),
      reviewed_by: 0, // manager
      notes: 'Request declined due to budget constraints. Alternative solution suggested.',
      items: [
        {
          inventory_item_id: null,
          item_name: 'High-End Workstation PC',
          quantity: 1,
          unit: 'unit',
          description: 'Gaming PC with RTX 4080, 32GB RAM',
          status: 'declined',
        },
      ],
    },
  ];

  const createdRequests = [];

  for (const requestData of requests) {
    const team = teams[requestData.teamIndex];
    const project = projects[requestData.projectIndex];
    // Find the requester - team leaders are at index 0, 3, 6 (teamIndex * 3)
    // requesterIndex 0 = leader, 1 = member1, 2 = member2
    const requesterUserIndex = requestData.teamIndex * 3 + requestData.requesterIndex;
    const requester = users.incubators[requesterUserIndex].user;

    const requestNumber = await generateRequestNumber(currentYear);

    const request = await prisma.materialRequest.create({
      data: {
        request_number: requestNumber,
        team_id: team.id,
        project_id: project.id,
        title: requestData.title,
        description: requestData.description,
        priority: requestData.priority,
        status: requestData.status,
        is_consumable_request: requestData.is_consumable_request,
        requires_quick_approval: requestData.requires_quick_approval,
        requested_by: requester.id,
        requested_at: requestData.requested_at,
        required_by: requestData.required_by,
        reviewed_at: requestData.reviewed_at,
        reviewed_by:
          requestData.reviewed_by !== undefined
            ? users.manager.id
            : null,
        approved_at: requestData.approved_at,
        approved_by:
          requestData.approved_by !== undefined
            ? users.manager.id
            : null,
        delivery_status: requestData.delivery_status || DeliveryStatus.not_ordered,
        delivered_at: requestData.delivered_at,
        ordered_at: requestData.ordered_at,
        notes: requestData.notes,
      },
    });

    // Create request items
    for (const itemData of requestData.items) {
      await prisma.requestItem.create({
        data: {
          request_id: request.id,
          inventory_item_id: itemData.inventory_item_id || null,
          item_name: itemData.item_name,
          description: (itemData as any).description || null,
          quantity: itemData.quantity,
          unit: itemData.unit || null,
          status: itemData.status,
          approved_quantity: (itemData as any).approved_quantity || null,
          distributed_quantity: (itemData as any).distributed_quantity || null,
          distribution_date: (itemData as any).distribution_date || null,
          is_consumable: (itemData as any).is_consumable || false,
        },
      });
    }

    // Create request history
    await prisma.requestHistory.create({
      data: {
        request_id: request.id,
        action: 'created',
        performed_by: requester.id,
        notes: 'Request created',
      },
    });

    if (requestData.reviewed_at) {
      await prisma.requestHistory.create({
        data: {
          request_id: request.id,
          action: 'status_changed',
          old_value: { status: RequestStatus.submitted },
          new_value: { status: requestData.status },
          performed_by: users.manager.id,
          notes: `Request ${requestData.status}`,
        },
      });
    }

    createdRequests.push(request);
    requestSeq++;
  }

  console.log(`  ✅ Created ${createdRequests.length} material requests`);
  return createdRequests;
}

async function seedInventoryAssignments(
  users: any,
  teams: any[],
  inventory: any,
  manager: any
) {
  console.log('📎 Seeding inventory assignments...');

  // Assign some laptops to teams
  const assignments = [
    {
      teamIndex: 0,
      itemIndex: 0, // Laptop
      quantity: 2,
      assigned_at: new Date('2024-01-22'),
      status: 'active',
    },
    {
      teamIndex: 1,
      itemIndex: 0, // Laptop
      quantity: 2,
      assigned_at: new Date('2024-01-22'),
      status: 'active',
    },
    {
      teamIndex: 2,
      itemIndex: 0, // Laptop
      quantity: 2,
      assigned_at: new Date('2024-01-23'),
      status: 'active',
    },
    {
      teamIndex: 0,
      itemIndex: 4, // Soldering Iron
      quantity: 1,
      assigned_at: new Date('2024-01-20'),
      status: 'active',
    },
  ];

  for (const assignmentData of assignments) {
    const team = teams[assignmentData.teamIndex];
    const item = inventory.items[assignmentData.itemIndex];

    await prisma.inventoryAssignment.create({
      data: {
        item_id: item.id,
        team_id: team.id,
        quantity: assignmentData.quantity,
        assigned_by: manager.id,
        assigned_at: assignmentData.assigned_at,
        status: assignmentData.status,
      },
    });

    // Create transaction log
    await prisma.inventoryTransaction.create({
      data: {
        item_id: item.id,
        transaction_type: 'assign',
        quantity: assignmentData.quantity,
        previous_quantity: item.available_quantity,
        new_quantity: item.available_quantity - assignmentData.quantity,
        performed_by: manager.id,
        notes: `Assigned to team: ${team.team_name}`,
      },
    });
  }

  console.log(`  ✅ Created ${assignments.length} inventory assignments`);
}

async function seedConsumptionLogs(
  users: any,
  teams: any[],
  inventory: any,
  manager: any
) {
  console.log('☕ Seeding consumption logs...');

  const logs = [
    {
      teamIndex: 0,
      itemIndex: 6, // Coffee
      quantity: 2,
      unit: 'bag',
      distributed_to: 'Team Meeting',
      consumption_date: new Date('2024-01-25'),
      consumption_type: 'meeting',
      notes: 'Weekly team meeting refreshments',
    },
    {
      teamIndex: 1,
      itemIndex: 7, // Water
      quantity: 1,
      unit: 'pack',
      distributed_to: 'Workshop',
      consumption_date: new Date('2024-01-26'),
      consumption_type: 'event',
      notes: 'Workshop refreshments',
    },
    {
      teamIndex: 2,
      itemIndex: 8, // Snacks
      quantity: 2,
      unit: 'pack',
      distributed_to: 'Team Meeting',
      consumption_date: new Date('2024-01-27'),
      consumption_type: 'meeting',
      notes: 'Team meeting snacks',
    },
  ];

  for (const logData of logs) {
    const team = teams[logData.teamIndex];
    const item = inventory.items[logData.itemIndex];

    await prisma.consumptionLog.create({
      data: {
        item_id: item.id,
        team_id: team.id,
        quantity: logData.quantity,
        unit: logData.unit,
        distributed_by: manager.id,
        distributed_to: logData.distributed_to,
        consumption_date: logData.consumption_date,
        consumption_type: logData.consumption_type,
        notes: logData.notes,
      },
    });
  }

  console.log(`  ✅ Created ${logs.length} consumption logs`);
}

async function cleanDatabase() {
  console.log('🧹 Cleaning existing data (keeping director)...\n');

  // Delete in order to respect foreign key constraints
  await prisma.consumptionLog.deleteMany();
  await prisma.maintenanceLog.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.inventoryReservation.deleteMany();
  await prisma.inventoryAssignment.deleteMany();
  await prisma.requestItem.deleteMany();
  await prisma.requestComment.deleteMany();
  await prisma.requestAttachment.deleteMany();
  await prisma.requestHistory.deleteMany();
  await prisma.requestApproval.deleteMany();
  await prisma.materialRequest.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.storageLocation.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.mentorAssignment.deleteMany();
  await prisma.mentor.deleteMany();
  await prisma.projectFile.deleteMany();
  await prisma.project.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  
  // Delete all users except director
  await prisma.emailPreferences.deleteMany({
    where: {
      user: {
        email: {
          not: 'director@university.edu',
        },
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        not: 'director@university.edu',
      },
    },
  });

  console.log('  ✅ Database cleaned\n');
}

async function main() {
  console.log('🌱 Starting comprehensive database seeding...\n');

  try {
    // Clean existing data (keeping director)
    await cleanDatabase();

    // Seed users (director, manager, mentors, incubators)
    const users = await seedUsers();
    console.log('');

    // Seed teams and projects
    const { teams, projects } = await seedTeamsAndProjects(users);
    console.log('');

    // Seed inventory (locations, suppliers, items)
    const inventory = await seedInventory(users.manager);
    console.log('');

    // Seed material requests
    const requests = await seedRequests(users, teams, projects, inventory);
    console.log('');

    // Seed inventory assignments
    await seedInventoryAssignments(users, teams, inventory, users.manager);
    console.log('');

    // Seed consumption logs
    await seedConsumptionLogs(users, teams, inventory, users.manager);
    console.log('');

    console.log('🎉 Database seeding completed successfully!\n');
    console.log('📋 Test Credentials:');
    console.log(`  Director: director@university.edu / ${PASSWORDS.director}`);
    console.log(`  Manager: manager@university.edu / ${PASSWORDS.manager}`);
    console.log(`  Mentor 1: mentor1@university.edu / ${PASSWORDS.mentor}`);
    console.log(`  Mentor 2: mentor2@university.edu / ${PASSWORDS.mentor}`);
    console.log(`  Mentor 3: mentor3@university.edu / ${PASSWORDS.mentor}`);
    console.log(`  Team Leaders: team1.leader@university.edu, team2.leader@university.edu, team3.leader@university.edu / ${PASSWORDS.incubator}`);
    console.log(`  Team Members: team1.member1@university.edu, etc. / ${PASSWORDS.incubator}`);
    console.log('\n📊 Summary:');
    console.log(`  - 1 Director, 1 Manager, 3 Mentors, 9 Incubators`);
    console.log(`  - 3 Teams with 3 Projects`);
    console.log(`  - ${inventory.locations.length} Storage Locations`);
    console.log(`  - ${inventory.suppliers.length} Suppliers`);
    console.log(`  - ${inventory.items.length} Inventory Items`);
    console.log(`  - ${requests.length} Material Requests`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
