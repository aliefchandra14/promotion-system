import fs from 'fs'
import path from 'path'
import { EmployeeJudge, Periode, PresentationDecision, TaskSubmissionFile } from '../models/index.js'
import { SUBMISSION_GUIDELINES } from '../constants/submissionGuidelines.js'
import { TASK_UPLOAD_ROOT, decodeOriginalName, getExtension } from '../middleware/uploadProject.js'
import { notify } from '../services/notificationService.js'

const toDto = (file) => ({
  id: file.id,
  originalName: file.originalName,
  size: file.size,
  uploadedAt: file.createdAt,
})

const removeFromDisk = (filePath) => fs.promises.unlink(filePath).catch(() => {})

const storedPath = (file) => path.join(TASK_UPLOAD_ROOT, String(file.periodeId), file.employeeId, file.storedName)

/**
 * The employee's task for the active period: only when the admin's final decision is
 * "Recommended with Task". Files can be changed until the task is submitted (once).
 */
const getTaskAccess = async (employeeId) => {
  const periode = await Periode.findOne({ where: { status: 'active' } })
  if (!periode) {
    return { periode: null, decision: null, canUpload: false, reason: 'There is no active promotion period.' }
  }

  const decision = await PresentationDecision.findOne({ where: { employeeId, periodeId: periode.id } })
  // After the task is decided the status becomes recommended / not recommended; the task stays visible.
  const hasTask = decision?.status === 'recommended_with_task' || Boolean(decision?.taskSubmittedAt)
  if (!hasTask) {
    return { periode, decision: null, canUpload: false, reason: 'You have no task to submit.' }
  }
  if (decision.taskSubmittedAt) {
    return { periode, decision, canUpload: false, reason: 'You have already submitted your task.' }
  }
  return { periode, decision, canUpload: true, reason: null }
}

export const getMyTask = async (req, res) => {
  try {
    const access = await getTaskAccess(req.user.employeeId)
    const files = access.decision
      ? await TaskSubmissionFile.findAll({
          where: { employeeId: req.user.employeeId, periodeId: access.periode.id },
          order: [['createdAt', 'ASC']],
        })
      : []

    return res.status(200).json({
      guidelines: SUBMISSION_GUIDELINES,
      task: access.decision
        ? {
            text: access.decision.comment,
            assignedAt: access.decision.updatedAt,
            submittedAt: access.decision.taskSubmittedAt,
          }
        : null,
      canUpload: access.canUpload,
      canSubmit: access.canUpload && files.length > 0 && files.length <= SUBMISSION_GUIDELINES.maxFiles,
      reason: access.reason,
      files: files.map(toDto),
    })
  } catch (error) {
    console.error('Get my task error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// Runs before multer so an employee who may not upload is refused without any file being written.
export const requireTaskAccess = async (req, res, next) => {
  try {
    const access = await getTaskAccess(req.user.employeeId)
    if (!access.canUpload) {
      return res.status(403).json({ message: access.reason })
    }

    const count = await TaskSubmissionFile.count({
      where: { employeeId: req.user.employeeId, periodeId: access.periode.id },
    })
    if (count >= SUBMISSION_GUIDELINES.maxFiles) {
      return res.status(400).json({
        message: `You can upload only ${SUBMISSION_GUIDELINES.maxFiles} file. Delete the current file to upload a different one.`,
      })
    }

    req.uploadPeriodeId = access.periode.id
    return next()
  } catch (error) {
    console.error('Task access check error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const saveTaskFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please choose a file to upload' })
    }

    const file = await TaskSubmissionFile.create({
      employeeId: req.user.employeeId,
      periodeId: req.uploadPeriodeId,
      originalName: decodeOriginalName(req.file.originalname).slice(0, 255),
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    })

    return res.status(201).json({ message: 'File uploaded', file: toDto(file) })
  } catch (error) {
    // The file is already on disk; do not leave an orphan behind when saving its record failed.
    if (req.file?.path) await removeFromDisk(req.file.path)
    console.error('Save task file error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const deleteTaskFile = async (req, res) => {
  try {
    const file = await TaskSubmissionFile.findByPk(req.params.id)
    if (!file || file.employeeId !== req.user.employeeId) {
      return res.status(404).json({ message: 'File not found' })
    }

    const access = await getTaskAccess(req.user.employeeId)
    if (!access.canUpload) {
      return res.status(403).json({ message: access.reason })
    }

    await file.destroy()
    await removeFromDisk(storedPath(file))

    return res.status(200).json({ message: 'File deleted' })
  } catch (error) {
    console.error('Delete task file error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const downloadTaskFile = async (req, res) => {
  try {
    const file = await TaskSubmissionFile.findByPk(req.params.id)
    const isOwner = file?.employeeId === req.user.employeeId
    // The employee's judges review the task, so they may download it too.
    const isJudge =
      file && !isOwner
        ? Boolean(await EmployeeJudge.findOne({ where: { employeeId: file.employeeId, judgeId: req.user.employeeId } }))
        : false
    if (!file || !(isOwner || isJudge || req.user.role === 'admin')) {
      return res.status(404).json({ message: 'File not found' })
    }

    const filePath = storedPath(file)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File is no longer available' })
    }

    return res.download(filePath, file.originalName || `file.${getExtension(file.storedName)}`)
  } catch (error) {
    console.error('Download task file error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// Submits the task once; the files are locked afterwards.
export const submitTask = async (req, res) => {
  try {
    const access = await getTaskAccess(req.user.employeeId)
    if (!access.canUpload) {
      return res.status(400).json({ message: access.reason })
    }

    const count = await TaskSubmissionFile.count({
      where: { employeeId: req.user.employeeId, periodeId: access.periode.id },
    })
    if (count === 0) {
      return res.status(400).json({ message: 'Please upload your task file before submitting' })
    }
    if (count > SUBMISSION_GUIDELINES.maxFiles) {
      return res.status(400).json({
        message: `Only ${SUBMISSION_GUIDELINES.maxFiles} file can be submitted. Delete the extra files first.`,
      })
    }

    await access.decision.update({ taskSubmittedAt: new Date() })

    // Notification 7 (config/notificationTemplates.js).
    const files = await TaskSubmissionFile.findAll({
      where: { employeeId: req.user.employeeId, periodeId: access.periode.id },
      attributes: ['originalName'],
      raw: true,
    })
    notify('taskSubmitted', {
      employeeId: req.user.employeeId,
      periode: access.periode,
      actorId: req.user.employeeId,
      vars: { fileNames: files.map((file) => file.originalName).join(', ') },
    })
    return res.status(200).json({ message: 'Task submitted' })
  } catch (error) {
    console.error('Submit task error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
