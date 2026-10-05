import { Setting } from '../models/index.js'
import { APP_MODES } from '../services/appMode.js'

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

export const getAppModeSetting = async (req, res) => {
  try {
    const settings = await getSettingsRow()
    return res.status(200).json({ appMode: settings.appMode === 'development' ? 'development' : 'production' })
  } catch (error) {
    console.error('Get app mode error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const updateAppModeSetting = async (req, res) => {
  try {
    const { appMode } = req.body

    if (!APP_MODES.includes(appMode)) {
      return res.status(400).json({ message: 'appMode must be development or production' })
    }

    const settings = await getSettingsRow()
    await settings.update({ appMode })

    return res.status(200).json({
      message: appMode === 'development' ? 'Development mode enabled' : 'Production mode enabled',
      appMode: settings.appMode,
    })
  } catch (error) {
    console.error('Update app mode error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
