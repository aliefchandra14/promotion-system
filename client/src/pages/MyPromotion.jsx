import { useSearchParams } from 'react-router-dom'
import ProjectSubmissionTab from '../components/ProjectSubmissionTab'
import TaskSubmissionTab from '../components/TaskSubmissionTab'
import PromotionHistoryTab from '../components/PromotionHistoryTab'

const TABS = [
  { key: 'project', label: 'Submission Project' },
  { key: 'task', label: 'Submission Task' },
  { key: 'history', label: 'Promotion History' },
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

      {tab === 'project' && <ProjectSubmissionTab />}
      {tab === 'task' && <TaskSubmissionTab />}
      {tab === 'history' && <PromotionHistoryTab />}
    </div>
  )
}

export default MyPromotion
