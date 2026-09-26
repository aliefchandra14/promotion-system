import { useSearchParams } from 'react-router-dom'
import ProjectSubmissionTab from '../components/ProjectSubmissionTab'

const TABS = [
  { key: 'project', label: 'Submission Project' },
  { key: 'task', label: 'Submission Task' },
]

function MyPromotion() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some(({ key }) => key === searchParams.get('tab')) ? searchParams.get('tab') : 'project'

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">My Promotion</h1>

      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSearchParams(key === 'project' ? {} : { tab: key }, { replace: true })}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === key
                ? 'border-quaternary text-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'project' ? (
        <ProjectSubmissionTab />
      ) : (
        <p className="mt-6 max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Submission task will be available here once admin opens it.
        </p>
      )}
    </div>
  )
}

export default MyPromotion
