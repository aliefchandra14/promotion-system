import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { FiX, FiDownload, FiUploadCloud, FiLoader, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Upload an Excel file in the Summary format. Valid rows go to the summary; failed rows are
// listed with their Excel row number and the reason.
function UploadSummaryModal({ onClose, onUploaded }) {
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState(null)

  const handleDownloadTemplate = async () => {
    setIsDownloading(true)
    try {
      const res = await fetch(`${API_URL}/summaries/upload-template`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to download template')

      const url = window.URL.createObjectURL(await res.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = 'summary-upload-template.xlsx'
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

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please choose a file first')
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)

    setIsUploading(true)
    try {
      const res = await fetch(`${API_URL}/summaries/upload`, { method: 'POST', credentials: 'include', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Upload failed')

      setResult(data)
      if (data.created > 0) {
        toast.success(`${data.created} row(s) added to the summary`)
        onUploaded()
      }
      if (data.failed > 0) toast.error(`${data.failed} row(s) failed, see the list below`)
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsUploading(false)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Upload Summary</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <p>
              Use the Excel template (same columns as the Summary table). Every value must be written exactly as in
              the template lists, and the rows must follow the promotion rules (see the <strong>Guide</strong> sheet).
            </p>
            <p className="mt-1.5">
              A row fails when the employee is already in the summary for the same FY. Failed rows are listed with
              their row number; the other rows are still added.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isDownloading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiDownload size={15} />
            {isDownloading ? 'Downloading...' : 'Download Excel Template'}
          </button>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-6 text-center transition hover:border-tertiary hover:bg-slate-50">
            <FiUploadCloud className="text-slate-400" size={26} />
            <span className="text-sm text-slate-600">
              {selectedFile ? selectedFile.name : 'Click to choose an Excel file (.xlsx)'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] || null)
                setResult(null)
              }}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-quaternary py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading && <FiLoader className="animate-spin" size={14} />}
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>

          {result && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 font-medium text-green-700">
                  <FiCheckCircle size={14} /> {result.created} added
                </span>
                <span
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${
                    result.failed ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'
                  }`}
                >
                  <FiAlertTriangle size={14} /> {result.failed} failed
                </span>
              </div>

              {result.errors.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-red-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-red-50 text-red-600">
                      <tr>
                        <th className="w-16 px-3 py-2 font-semibold">Row</th>
                        <th className="px-3 py-2 font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50">
                      {result.errors.map((error) => (
                        <tr key={`${error.row}-${error.message}`}>
                          <td className="px-3 py-2 font-semibold text-slate-700">{error.row}</td>
                          <td className="px-3 py-2 text-slate-600">{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UploadSummaryModal
