import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FiUpload,
  FiDownload,
  FiTrash2,
  FiFile,
  FiLoader,
  FiCheckCircle,
  FiLock,
  FiInfo,
  FiSend,
} from 'react-icons/fi'
import SubmissionHistoryList from './SubmissionHistoryList'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const SUBMISSION_STATUS_STYLE = {
  not_started: 'bg-slate-100 text-slate-500',
  pending_superior: 'bg-amber-50 text-amber-600',
  rejected_superior: 'bg-red-50 text-red-500',
  pending_hod: 'bg-amber-50 text-amber-600',
  rejected_hod: 'bg-red-50 text-red-500',
  complete: 'bg-green-50 text-green-600',
}

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Dates arrive as "YYYY-MM-DD"; build them locally so the shown day never shifts with the time zone.
const formatDate = (value) => {
  if (!value) return '-'
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatUploadedAt = (value) =>
  new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const getExtension = (filename) => (filename.includes('.') ? filename.split('.').pop().toLowerCase() : '')

function ProjectSubmissionTab() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [busyFileId, setBusyFileId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/project-submission`, { credentials: 'include' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Failed to load submission data')
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
        <p className="text-sm text-red-500">{loadError || 'Failed to load submission data'}</p>
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

  const { guidelines, gradeGuidelines, presentation, canUpload, canSubmit, reason, files, submission, history } =
    data
  const isRejected = submission.status === 'rejected_superior' || submission.status === 'rejected_hod'
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
      const res = await fetch(`${API_URL}/project-submission/files`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
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
      const res = await fetch(`${API_URL}/project-submission/files/${file.id}/download`, { credentials: 'include' })
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

  const handleSubmit = async () => {
    const action = isRejected ? 'Submit your project again' : 'Submit your project'
    const note = 'You can submit only once; the file cannot be changed unless it is rejected.'
    if (!window.confirm(`${action} for approval? ${note}`)) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/promotions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'submission' }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Failed to submit project')

      toast.success(body.message)
      await load()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.originalName}"?`)) return
    setBusyFileId(file.id)
    try {
      const res = await fetch(`${API_URL}/project-submission/files/${file.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
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

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FiInfo size={15} /> Guidelines
          {gradeGuidelines.grade && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              {gradeGuidelines.grade}
            </span>
          )}
        </h2>

        {gradeGuidelines.items.length > 0 && (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
            {gradeGuidelines.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        )}

        <div className={gradeGuidelines.items.length > 0 ? 'mt-4 border-t border-slate-100 pt-4' : 'mt-3'}>
          <p className="text-xs font-medium uppercase text-slate-400">Upload rules</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>
              Format: <span className="font-medium">{allowedLabel}</span> only, maximum{' '}
              <span className="font-medium">{guidelines.maxFileSizeMB} MB</span>.
            </li>
            <li>
              Number of files: <span className="font-medium">{guidelines.maxFiles}</span>.
            </li>
            {guidelines.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </div>

      {presentation && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Schedule for {presentation.grade}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              ['Briefing', presentation.briefingStart, presentation.briefingEnd],
              ['Submission', presentation.submissionStart, presentation.submissionEnd],
              ['Presentation', presentation.presentationStart, presentation.presentationEnd],
            ].map(([label, start, end]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
                <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-700">
                  {formatDate(start)} – {formatDate(end)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <SubmissionHistoryList history={history} />

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Upload project</h2>
            {submission.by && submission.status === 'complete' && (
              <p className="mt-0.5 text-xs text-slate-500">Approved by HOD ({submission.by})</p>
            )}
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${SUBMISSION_STATUS_STYLE[submission.status]}`}
          >
            {submission.label}
            {submission.by && submission.status !== 'complete' && ` (${submission.by})`}
          </span>
        </div>

        {canUpload ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
            <FiCheckCircle className="mt-0.5 shrink-0 text-green-600" size={16} />
            <div>
              <p className="text-sm font-semibold text-green-700">
                {isRejected ? 'You can submit again' : 'Submission is open'}
              </p>
              <p className="mt-0.5 text-xs text-green-700">
                {isRejected
                  ? 'Your last submission was rejected. Replace your ZIP file if needed, then submit again.'
                  : 'Upload your project as one ZIP file, then submit it for approval. You can submit only once.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <FiLock className="mt-0.5 shrink-0 text-amber-600" size={16} />
            <div>
              <p className="text-sm font-semibold text-amber-700">You cannot submit right now</p>
              <p className="mt-0.5 text-xs text-amber-700">{reason}</p>
            </div>
          </div>
        )}

        {isRejected && submission.remark && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-600">Reason: {submission.remark}</p>
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
                Only {guidelines.maxFiles} file can be submitted. Delete the current file below to upload a
                different one.
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
                    {formatSize(file.size)} · {formatUploadedAt(file.uploadedAt)}
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
            {!canSubmit && (
              <p className="text-xs text-slate-400">
                {files.length > guidelines.maxFiles
                  ? `Only ${guidelines.maxFiles} file can be submitted. Delete the extra files first.`
                  : 'Upload your ZIP file before submitting.'}
              </p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <FiLoader className="animate-spin" size={14} /> : <FiSend size={14} />}
              {isSubmitting ? 'Submitting...' : isRejected ? 'Submit Again' : 'Submit for Approval'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectSubmissionTab
