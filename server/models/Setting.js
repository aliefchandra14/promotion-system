import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

const Setting = sequelize.define(
  'Setting',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    maintenanceMode: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    maintenanceMessage: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: 'settings',
    timestamps: true,
  }
)

export default Setting
