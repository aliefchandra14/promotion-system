import fs from 'fs'
import path from 'path'
import { ProjectSubmissionFile } from '../models/index.js'
import { SUBMISSION_GUIDELINES } from '../constants/submissionGuidelines.js'
import { getSubmissionAccess } from '../services/submissionAccess.js'
import { PROJECT_UPLOAD_ROOT, decodeOriginalName, getExtension } from '../middleware/uploadProject.js'

const toDto = (file) => ({
  id: file.id,
  originalName: file.originalName,
  size: file.size,
  uploadedAt: file.createdAt,
})

const removeFromDisk = (filePath) => fs.promises.unlink(filePath).catch(() => {})

const storedPath = (file) =>
  path.join(PROJECT_UPLOAD_ROOT, String(file.periodeId), file.employeeId, file.storedName)

// Everything the My Promotion > Submission Project tab needs in one call.
export const getProjectSubmission = async (req, res) => {
  try {
    const access = await getSubmissionAccess(req.user.employeeId)

    const files = access.periode
      ? await ProjectSubmissionFile.findAll({
          where: { employeeId: req.user.employeeId, periodeId: access.periode.id },
          order: [['createdAt', 'ASC']],
        })
      : []

    return res.status(200).json({
      guidelines: SUBMISSION_GUIDELINES,
      periode: access.periode,
      presentation: access.presentation,
      canUpload: access.canUpload,
      reason: access.reason,
      files: files.map(toDto),
    })
  } catch (error) {
    console.error('Get project submission error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// Runs before multer so an employee who may not upload is refused without any file being written.
export const requireSubmissionAccess = async (req, res, next) => {
  try {
    const access = await getSubmissionAccess(req.user.employeeId)
    if (!access.canUpload) {
      return res.status(403).json({ message: access.reason })
    }

    const count = await ProjectSubmissionFile.count({
      where: { employeeId: req.user.employeeId, periodeId: access.periode.id },
    })
    if (count >= SUBMISSION_GUIDELINES.maxFiles) {
      return res.status(400).json({
        message: `You can upload up to ${SUBMISSION_GUIDELINES.maxFiles} files. Delete one to upload another.`,
      })
    }

    req.submissionAccess = access
    return next()
  } catch (error) {
    console.error('Submission access check error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const saveProjectFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please choose a file to upload' })
    }

    const file = await ProjectSubmissionFile.create({
      employeeId: req.user.employeeId,
      periodeId: req.submissionAccess.periode.id,
      originalName: decodeOriginalName(req.file.originalname).slice(0, 255),
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    })

    return res.status(201).json({ message: 'File uploaded', file: toDto(file) })
  } catch (error) {
    // The file is already on disk; do not leave an orphan behind when saving its record failed.
    if (req.file?.path) await removeFromDisk(req.file.path)
    console.error('Save project file error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const deleteProjectFile = async (req, res) => {
  try {
    const file = await ProjectSubmissionFile.findByPk(req.params.id)
    if (!file || file.employeeId !== req.user.employeeId) {
      return res.status(404).json({ message: 'File not found' })
    }

    const access = await getSubmissionAccess(req.user.employeeId)
    if (!access.canUpload) {
      return res.status(403).json({ message: 'Submission is closed, files can no longer be changed.' })
    }

    await file.destroy()
    await removeFromDisk(storedPath(file))

    return res.status(200).json({ message: 'File deleted' })
  } catch (error) {
    console.error('Delete project file error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const downloadProjectFile = async (req, res) => {
  try {
    const file = await ProjectSubmissionFile.findByPk(req.params.id)
    const isOwner = file?.employeeId === req.user.employeeId
    if (!file || !(isOwner || req.user.role === 'admin')) {
      return res.status(404).json({ message: 'File not found' })
    }

    const filePath = storedPath(file)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File is no longer available' })
    }

    return res.download(filePath, file.originalName || `file.${getExtension(file.storedName)}`)
  } catch (error) {
    console.error('Download project file error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
