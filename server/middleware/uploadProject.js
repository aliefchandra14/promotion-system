import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { SUBMISSION_GUIDELINES, MAX_FILE_SIZE_BYTES } from '../constants/submissionGuidelines.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROJECT_UPLOAD_ROOT = path.resolve(currentDir, '..', 'uploads', 'project-submissions')
export const TASK_UPLOAD_ROOT = path.resolve(currentDir, '..', 'uploads', 'task-submissions')

export const getExtension = (filename) => path.extname(filename || '').replace('.', '').toLowerCase()

// multer reads the multipart filename as latin1, which garbles non-ASCII names.
export const decodeOriginalName = (name) => Buffer.from(name || '', 'latin1').toString('utf8')

const fileFilter = (req, file, cb) => {
  const extension = getExtension(decodeOriginalName(file.originalname))
  if (SUBMISSION_GUIDELINES.allowedExtensions.includes(extension)) {
    cb(null, true)
  } else {
    cb(new Error(`This file type is not allowed. Allowed: ${SUBMISSION_GUIDELINES.allowedExtensions.join(', ')}`))
  }
}

// Single-file upload stored under <root>/<periodeId>/<employeeId>/, with the submission guideline
// limits. req.uploadPeriodeId must be set by the access check that runs before it.
const createUploader = (root) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(root, String(req.uploadPeriodeId), req.user.employeeId)
      fs.mkdir(dir, { recursive: true }, (error) => cb(error, dir))
    },
    filename: (req, file, cb) => {
      cb(null, `${crypto.randomUUID()}.${getExtension(decodeOriginalName(file.originalname))}`)
    },
  })

  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  })

  // Wraps multer so its errors become friendly JSON responses instead of the generic error handler.
  return (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (!error) return next()

      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res
          .status(413)
          .json({ message: `File is too large. Maximum size is ${SUBMISSION_GUIDELINES.maxFileSizeMB} MB.` })
      }
      return res.status(400).json({ message: error.message || 'Failed to upload file' })
    })
  }
}

export const uploadProjectFile = createUploader(PROJECT_UPLOAD_ROOT)
export const uploadTaskFile = createUploader(TASK_UPLOAD_ROOT)
