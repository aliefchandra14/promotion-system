import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { FiUpload, FiDownload, FiTrash2, FiFile, FiLoader, FiCheckCircle, FiLock, FiInfo } from 'react-icons/fi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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

  const { guidelines, presentation, canUpload, reason, files } = data
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
    <div className="mt-6 grid max-w-5xl gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {canUpload ? (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <FiCheckCircle className="mt-0.5 shrink-0 text-green-600" size={18} />
            <div>
              <p className="text-sm font-semibold text-green-700">Submission is open</p>
              <p className="mt-0.5 text-xs text-green-600">You can upload your project files below.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <FiLock className="mt-0.5 shrink-0 text-amber-600" size={18} />
            <div>
              <p className="text-sm font-semibold text-amber-700">Upload is not available</p>
              <p className="mt-0.5 text-xs text-amber-600">{reason}</p>
            </div>
          </div>
        )}

        {presentation && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Schedule for {presentation.grade}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ['Briefing', presentation.briefingStart, presentation.briefingEnd],
                ['Submission', presentation.submissionStart, presentation.submissionEnd],
                ['Presentation', presentation.presentationStart, presentation.presentationEnd],
              ].map(([label, start, end]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right font-medium text-slate-700">
                    {formatDate(start)} – {formatDate(end)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FiInfo size={15} /> Upload guidelines
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>
              Maximum file size: <span className="font-medium">{guidelines.maxFileSizeMB} MB</span> per file.
            </li>
            <li>
              Maximum number of files: <span className="font-medium">{guidelines.maxFiles}</span>.
            </li>
            <li>
              Allowed formats: <span className="font-medium">{allowedLabel}</span>.
            </li>
            {guidelines.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        {canUpload && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Upload a file</h2>

            <input
              ref={fileInputRef}
              type="file"
              accept={guidelines.allowedExtensions.map((ext) => `.${ext}`).join(',')}
              onChange={handleChoose}
              className="hidden"
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || files.length >= guidelines.maxFiles}
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
                className="flex items-center gap-2 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading ? <FiLoader className="animate-spin" size={14} /> : <FiUpload size={14} />}
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>

            {files.length >= guidelines.maxFiles && (
              <p className="mt-2 text-xs text-amber-600">
                You have reached the limit of {guidelines.maxFiles} files. Delete one to upload another.
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Uploaded files</h2>
            <span className="text-xs text-slate-400">
              {files.length} / {guidelines.maxFiles}
            </span>
          </div>

          {files.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No files uploaded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
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
        </div>
      </div>
    </div>
  )
}

export default ProjectSubmissionTab
