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
    // 'development': no email is sent and presentation dates are not enforced.
    // 'production': normal behaviour.
    appMode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'production',
    },
  },
  {
    tableName: 'settings',
    timestamps: true,
  }
)

export default Setting
