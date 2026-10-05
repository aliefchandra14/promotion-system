import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FiUpload,
  FiDownload,
  FiTrash2,
  FiFile,
  FiLoader,
  FiSend,
  FiCheckCircle,
  FiClipboard,
  FiAlertTriangle,
} from 'react-icons/fi'
import { formatDateTime } from '../constants/assessment'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getExtension = (filename) => (filename.includes('.') ? filename.split('.').pop().toLowerCase() : '')

// "Recommended with Task": the task summarized by admin, and the employee's one-time task submission.
function TaskSubmissionTab() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyFileId, setBusyFileId] = useState(null)
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/task-submission`, { credentials: 'include' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Failed to load task')
      setData(body)
      setLoadError('')
    } catch (error) {
      setLoadError(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (isLoading) {
    return (
      <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
        <FiLoader className="animate-spin" size={16} />
        Loading...
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="mt-6 max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-red-500">{loadError || 'Failed to load task'}</p>
        <button
          type="button"
          onClick={() => {
            setIsLoading(true)
            load()
          }}
          className="mt-3 rounded-lg bg-quaternary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-quaternary/90"
        >
          Try Again
        </button>
      </div>
    )
  }

  const { guidelines, task, canUpload, canSubmit, reason, files } = data

  if (!task) {
    return (
      <p className="mt-6 max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        You have no task to submit. A task appears here when your promotion result is &quot;Recommended with
        Task&quot;.
      </p>
    )
  }

  const maxBytes = guidelines.maxFileSizeMB * 1024 * 1024
  const allowedLabel = guidelines.allowedExtensions.map((ext) => ext.toUpperCase()).join(', ')

  const handleChoose = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!guidelines.allowedExtensions.includes(getExtension(file.name))) {
      toast.error(`This file type is not allowed. Allowed: ${allowedLabel}`)
      return
    }
    if (file.size > maxBytes) {
      toast.error(`File is too large. Maximum size is ${guidelines.maxFileSizeMB} MB.`)
      return
    }
    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    try {
      const form = new FormData()
      form.append('file', selectedFile)
      const res = await fetch(`${API_URL}/task-submission/files`, { method: 'POST', credentials: 'include', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Failed to upload file')

      toast.success(body.message)
      setSelectedFile(null)
      await load()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownload = async (file) => {
    setBusyFileId(file.id)
    try {
      const res = await fetch(`${API_URL}/task-submission/files/${file.id}/download`, { credentials: 'include' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Failed to download file')
      }
      const url = URL.createObjectURL(await res.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = file.originalName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyFileId(null)
    }
  }

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.originalName}"?`)) return
    setBusyFileId(file.id)
    try {
      const res = await fetch(`${API_URL}/task-submission/files/${file.id}`, { method: 'DELETE', credentials: 'include' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Failed to delete file')

      toast.success(body.message)
      await load()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyFileId(null)
    }
  }

  const handleSubmit = async () => {
    const confirmation =
      'Have you discussed your task with the assigned judges? The task can only be submitted once and cannot be ' +
      'changed afterwards. Submit now?'
    if (!window.confirm(confirmation)) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/task-submission/submit`, { method: 'POST', credentials: 'include' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Failed to submit task')

      toast.success(body.message)
      await load()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FiClipboard size={15} /> Your task
        </h2>
        <p className="mt-1 text-xs text-slate-400">Given {formatDateTime(task.assignedAt)}</p>
        <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-4 text-sm text-slate-700">{task.text}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">Upload task</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              task.submittedAt ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {task.submittedAt ? `Submitted ${formatDateTime(task.submittedAt)}` : 'Not submitted'}
          </span>
        </div>

        {task.submittedAt ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
            <FiCheckCircle className="mt-0.5 shrink-0 text-green-600" size={16} />
            <p className="text-xs text-green-700">Your task has been submitted. It cannot be changed anymore.</p>
          </div>
        ) : !canUpload ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">{reason}</p>
        ) : (
          <>
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <FiAlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={16} />
              <div>
                <p className="text-sm font-semibold text-amber-700">Important notice before submitting</p>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-700">
                  Please ensure that you have discussed your task with the assigned judges before submitting. The task
                  submission can only be made once and cannot be changed or resubmitted afterwards.
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Upload your task as one {allowedLabel} file (maximum {guidelines.maxFileSizeMB} MB), then submit it.
            </p>
          </>
        )}

        {canUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={guidelines.allowedExtensions.map((ext) => `.${ext}`).join(',')}
              onChange={handleChoose}
              className="hidden"
            />
            {files.length >= guidelines.maxFiles ? (
              <p className="mt-4 text-xs text-slate-500">
                Only {guidelines.maxFiles} file can be submitted. Delete the current file below to upload a different
                one.
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Choose file
                </button>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
                  {selectedFile ? `${selectedFile.name} (${formatSize(selectedFile.size)})` : 'No file chosen'}
                </span>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="flex items-center gap-2 rounded-lg border border-quaternary px-4 py-2 text-sm font-semibold text-quaternary transition hover:bg-quaternary/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploading ? <FiLoader className="animate-spin" size={14} /> : <FiUpload size={14} />}
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-4 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase text-slate-400">Uploaded files</h3>
          <span className="text-xs text-slate-400">
            {files.length} / {guidelines.maxFiles}
          </span>
        </div>

        {files.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No files uploaded yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-3 py-2.5">
                <FiFile className="shrink-0 text-slate-400" size={18} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700" title={file.originalName}>
                    {file.originalName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatSize(file.size)} · {formatDateTime(file.uploadedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(file)}
                  disabled={busyFileId === file.id}
                  title="Download"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                >
                  <FiDownload size={16} />
                </button>
                {canUpload && (
                  <button
                    type="button"
                    onClick={() => handleDelete(file)}
                    disabled={busyFileId === file.id}
                    title="Delete"
                    className="rounded-lg p-2 text-red-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    <FiTrash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canUpload && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            {!canSubmit && <p className="text-xs text-slate-400">Upload your task file before submitting.</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <FiLoader className="animate-spin" size={14} /> : <FiSend size={14} />}
              {isSubmitting ? 'Submitting...' : 'Submit Task'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default TaskSubmissionTab
