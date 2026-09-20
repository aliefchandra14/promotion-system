import '../config/env.js'
import { sequelize, Employee } from '../models/index.js'

const departments = [
  { name: 'Human Resources', code: 'HR' },
  { name: 'Finance', code: 'FIN' },
  { name: 'Information Technology', code: 'IT' },
  { name: 'Marketing', code: 'MKT' },
  { name: 'Operations', code: 'OPS' },
]

const firstNames = [
  'Andi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko',
  'Kartika', 'Lestari', 'Made', 'Nadia', 'Oscar', 'Putri', 'Rian', 'Sari', 'Tono', 'Umi',
  'Vino', 'Wulan', 'Yusuf', 'Zahra', 'Bayu', 'Clara', 'Doni', 'Erika',
]
const lastNames = [
  'Saputra', 'Wijaya', 'Pratama', 'Kusuma', 'Santoso', 'Rahayu', 'Hidayat', 'Nugroho',
  'Permata', 'Setiawan', 'Utami', 'Firmansyah', 'Kurniawan', 'Anggraini',
]

const DEFAULT_PASSWORD = 'Welcome123'

let idCounter = 200001
const nextEmployeeId = () => String(idCounter++)

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)]

const buildName = (usedNames) => {
  let name
  do {
    name = `${randomFrom(firstNames)} ${randomFrom(lastNames)}`
  } while (usedNames.has(name))
  usedNames.add(name)
  return name
}

const buildEmail = (name, deptCode) => {
  const slug = name.toLowerCase().replace(/\s+/g, '.')
  return `${slug}@${deptCode.toLowerCase()}.promotionsystem.local`
}

const buildEmployees = () => {
  const employees = []
  const usedNames = new Set()

  for (const dept of departments) {
    const hodId = nextEmployeeId()
    const hodName = buildName(usedNames)
    employees.push({
      employeeId: hodId,
      name: hodName,
      email: buildEmail(hodName, dept.code),
      password: DEFAULT_PASSWORD,
      isChange: 0,
      department: dept.name,
      grade: 'Head of Department',
      trainer: null,
      superior: null,
      hod: null,
      role: 'employee',
      isActive: true,
    })

    const managerIds = []
    for (let i = 0; i < 2; i += 1) {
      const managerId = nextEmployeeId()
      const managerName = buildName(usedNames)
      employees.push({
        employeeId: managerId,
        name: managerName,
        email: buildEmail(managerName, dept.code),
        password: DEFAULT_PASSWORD,
        isChange: 0,
        department: dept.name,
        grade: 'Manager',
        trainer: hodId,
        superior: hodId,
        hod: hodId,
        role: 'employee',
        isActive: true,
      })
      managerIds.push(managerId)
    }

    const staffIds = []
    for (let i = 0; i < 6; i += 1) {
      const staffId = nextEmployeeId()
      const staffName = buildName(usedNames)
      const superiorId = managerIds[i % managerIds.length]
      const trainerId = staffIds.length > 0 ? randomFrom(staffIds) : superiorId

      employees.push({
        employeeId: staffId,
        name: staffName,
        email: buildEmail(staffName, dept.code),
        password: DEFAULT_PASSWORD,
        isChange: 0,
        department: dept.name,
        grade: i % 3 === 0 ? 'Senior Staff' : 'Staff',
        trainer: trainerId,
        superior: superiorId,
        hod: hodId,
        role: 'employee',
        isActive: true,
      })
      staffIds.push(staffId)
    }
  }

  return employees
}

const seed = async () => {
  try {
    await sequelize.authenticate()
    await sequelize.sync()

    const employees = buildEmployees()
    let createdCount = 0

    for (const emp of employees) {
      const [, created] = await Employee.findOrCreate({
        where: { employeeId: emp.employeeId },
        defaults: emp,
      })
      if (created) createdCount += 1
    }

    console.log(
      `Seeding complete: ${createdCount} of ${employees.length} employees created (default password: ${DEFAULT_PASSWORD})`
    )
  } catch (error) {
    console.error('Seeding failed:', error)
  } finally {
    await sequelize.close()
  }
}

seed()
