// Guidelines for the project upload on the My Promotion page.
// These values are enforced by the server and shown to employees, so edit them here only.
export const SUBMISSION_GUIDELINES = {
  maxFileSizeMB: 20,
  maxFiles: 1,
  allowedExtensions: ['zip'],
  notes: [
    'Do not upload password-protected files.',
    'You can submit only once. If your submission is rejected by your Superior, HOD or Admin, you can replace the file and submit again.',
  ],
}

export const MAX_FILE_SIZE_BYTES = SUBMISSION_GUIDELINES.maxFileSizeMB * 1024 * 1024

const PROJECT_GRADES = [
  'Junior Staff 1',
  'Staff 1',
  'Staff 2',
  'Senior Staff 1',
  'Executive',
  'Manager 1',
  'Manager 2',
  'Senior Manager',
  'Assistant General Manager',
  'General Manager',
]

const TEMPLATE_GRADES = [
  'Junior Staff 1',
  'Staff 1',
  'Executive',
  'Senior Executive',
  'Manager 1',
  'Manager 2',
  'Senior Manager',
  'Assistant General Manager',
  'General Manager',
]

// Project guidelines from HR-ED; each one applies only to the grades listed (the "Promote To" grade).
export const GRADE_GUIDELINES = [
  {
    title:
      'The project submitted must be your own original work. If it is proven to be copied from someone else’s project or from a previous year, the participant will be disqualified',
    grades: PROJECT_GRADES,
  },
  {
    title:
      'If the project is a team project, the participant must have a significant role or clear involvement in the creation process',
    grades: PROJECT_GRADES,
  },
  {
    title: 'Use the template provided by HR-ED',
    grades: TEMPLATE_GRADES,
  },
  {
    title: 'The project creation year must be the same as the year of the presentation',
    grades: TEMPLATE_GRADES,
  },
  {
    title: 'Projects submitted to the promotion system must be in ZIP format (Maximum size: 20 MB).',
    grades: TEMPLATE_GRADES,
  },
  {
    title: 'Presentation Slide, Module Training, & Course Parameter must include',
    grades: ['Senior Staff 1'],
  },
]

export const getGradeGuidelines = (grade) =>
  grade ? GRADE_GUIDELINES.filter((item) => item.grades.includes(grade)).map((item) => item.title) : []
