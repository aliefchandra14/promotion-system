import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

const Employee = sequelize.define(
  'Employee',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    employeeId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        is: /^[0-9]{6}$/,
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    isChange: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    grade: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    trainer: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        is: /^[0-9]{6}$/,
      },
    },
    superior: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        is: /^[0-9]{6}$/,
      },
    },
    hod: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        is: /^[0-9]{6}$/,
      },
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'employee',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'employees',
    timestamps: true,
  }
)

export default Employee
