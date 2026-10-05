import { Setting } from '../models/index.js'

// Development mode (switched by admin in Settings) is for testing:
//  - no email is sent (it is only logged, like when SMTP is not configured);
//  - presentation dates are not enforced (submission is always open, past dates are allowed).
export const APP_MODES = ['development', 'production']

export const getAppMode = async () => {
  const settings = await Setting.findByPk(1, { attributes: ['appMode'] })
  return settings?.appMode === 'development' ? 'development' : 'production'
}

export const isDevMode = async () => (await getAppMode()) === 'development'
