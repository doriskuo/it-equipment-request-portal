import { PrismaClient, RoleType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  // 1. Create Departments
  const itDept = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: { name: 'Information Technology', code: 'IT' },
  });

  const execDept = await prisma.department.upsert({
    where: { code: 'EXEC' },
    update: {},
    create: { name: 'Executive', code: 'EXEC' },
  });

  const finDept = await prisma.department.upsert({
    where: { code: 'FIN' },
    update: {},
    create: { name: 'Finance', code: 'FIN' },
  });

  const procDept = await prisma.department.upsert({
    where: { code: 'PROC' },
    update: {},
    create: { name: 'Procurement', code: 'PROC' },
  });

  // 2. Create Users
  // 2.1 vp_clark
  const clark = await prisma.user.upsert({
    where: { email: 'vp_clark@example.com' },
    update: {},
    create: {
      email: 'vp_clark@example.com',
      name: 'Clark',
      departmentId: execDept.id,
      roles: { create: [{ role: RoleType.MANAGER }] },
    },
  });

  // 2.2 mgr_bob
  const bob = await prisma.user.upsert({
    where: { email: 'mgr_bob@example.com' },
    update: {},
    create: {
      email: 'mgr_bob@example.com',
      name: 'Bob',
      departmentId: itDept.id,
      managerId: clark.id,
      roles: { create: [{ role: RoleType.MANAGER }] },
    },
  });

  // 2.3 emp_alice
  const alice = await prisma.user.upsert({
    where: { email: 'emp_alice@example.com' },
    update: {},
    create: {
      email: 'emp_alice@example.com',
      name: 'Alice',
      departmentId: itDept.id,
      managerId: bob.id,
      roles: { create: [{ role: RoleType.EMPLOYEE }] },
    },
  });

  // 2.4 it_david
  const david = await prisma.user.upsert({
    where: { email: 'it_david@example.com' },
    update: {},
    create: {
      email: 'it_david@example.com',
      name: 'David',
      departmentId: itDept.id,
      roles: { create: [{ role: RoleType.IT }] },
    },
  });

  // 2.5 proc_emma
  const emma = await prisma.user.upsert({
    where: { email: 'proc_emma@example.com' },
    update: {},
    create: {
      email: 'proc_emma@example.com',
      name: 'Emma',
      departmentId: procDept.id,
      roles: { create: [{ role: RoleType.PROCUREMENT }] },
    },
  });

  // 2.6 acct_frank
  const frank = await prisma.user.upsert({
    where: { email: 'acct_frank@example.com' },
    update: {},
    create: {
      email: 'acct_frank@example.com',
      name: 'Frank',
      departmentId: finDept.id,
      roles: { create: [{ role: RoleType.ACCOUNTING }] },
    },
  });

  // 3. Create Equipment Categories
  const catNotebook = await prisma.equipmentCategory.create({ data: { name: 'Notebook' } });
  const catDesktop = await prisma.equipmentCategory.create({ data: { name: 'Desktop PC' } });
  const catMonitor = await prisma.equipmentCategory.create({ data: { name: 'Monitor' } });
  const catSoftware = await prisma.equipmentCategory.create({ data: { name: 'Software License' } });

  // 4. Create Equipment Products
  await prisma.equipmentProduct.createMany({
    data: [
      { categoryId: catNotebook.id, name: 'Dell Latitude 7450', specification: 'i7/16GB/512GB', referencePrice: 45000 },
      { categoryId: catNotebook.id, name: 'Lenovo ThinkPad T14', specification: 'i7/16GB/256GB', referencePrice: 42000 },
      { categoryId: catDesktop.id, name: 'Dell OptiPlex 7010', specification: 'i5/16GB/512GB', referencePrice: 35000 },
      { categoryId: catMonitor.id, name: 'Dell U2723QE 27" 4K', specification: '27" IPS 4K USB-C', referencePrice: 18000 },
      { categoryId: catSoftware.id, name: 'Microsoft 365 Business', specification: 'Annual subscription', referencePrice: 5000 },
    ],
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
