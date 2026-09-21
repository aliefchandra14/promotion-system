import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { FiX, FiDownload, FiUploadCloud } from 'react-icons/fi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function ImportEmployeePromotionModal({ onClose, onImported }) {
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleDownloadTemplate = async () => {
    setIsDownloading(true)
    try {
      const res = await fetch(`${API_URL}/employee-promotions/import-template`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to download template')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'employee-promotion-import-template.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] || null)
  }

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please choose a file first')
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)

    setIsImporting(true)
    try {
      const res = await fetch(`${API_URL}/employee-promotions/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Import failed')
      }

      toast.success(data.message)
      data.errors?.forEach((err) => toast.error(err, { duration: 6000 }))
      onImported()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsImporting(false)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Import Employee Promotion Data</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">File format</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>File format: .xlsx</li>
              <li>Header is on row 1, data starts on row 2</li>
              <li>
                Columns: No., Employee ID, Name, Department, Current Grade, Promote To,
                Presentation, Type, TOEIC, Remark
              </li>
              <li>Employee ID must already exist in the Employee master data</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isDownloading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <FiDownload size={16} />
            {isDownloading ? 'Downloading...' : 'Download Template'}
          </button>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Upload File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting || !selectedFile}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-quaternary py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <FiUploadCloud size={16} />
            {isImporting ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImportEmployeePromotionModal
