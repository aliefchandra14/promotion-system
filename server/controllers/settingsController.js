import { Setting } from '../models/index.js'

const getSettingsRow = async () => {
  const [settings] = await Setting.findOrCreate({ where: { id: 1 }, defaults: { maintenanceMode: false } })
  return settings
}

export const getMaintenanceStatus = async (req, res) => {
  try {
    const settings = await getSettingsRow()
    return res.status(200).json({
      maintenanceMode: settings.maintenanceMode,
      message: settings.maintenanceMessage || null,
    })
  } catch (error) {
    console.error('Get maintenance status error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const updateMaintenanceStatus = async (req, res) => {
  try {
    const { maintenanceMode, message } = req.body

    if (typeof maintenanceMode !== 'boolean') {
      return res.status(400).json({ message: 'maintenanceMode must be true or false' })
    }

    const settings = await getSettingsRow()
    await settings.update({
      maintenanceMode,
      maintenanceMessage: message === undefined ? settings.maintenanceMessage : message || null,
    })

    return res.status(200).json({
      message: `Maintenance mode ${maintenanceMode ? 'enabled' : 'disabled'}`,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
    })
  } catch (error) {
    console.error('Update maintenance status error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
