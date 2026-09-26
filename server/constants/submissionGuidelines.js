// Guidelines for the project upload on the My Promotion page.
// These values are enforced by the server and shown to employees, so edit them here only.
// Temporary values - update once the real guidelines are confirmed.
export const SUBMISSION_GUIDELINES = {
  maxFileSizeMB: 24,
  maxFiles: 5,
  allowedExtensions: ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'zip'],
  notes: [
    'Only upload your own project work.',
    'Do not upload password-protected files.',
    'If you have more documents than the file limit, compress them into a single ZIP file.',
    'You can delete a file and upload it again as long as submission is still open.',
  ],
}

export const MAX_FILE_SIZE_BYTES = SUBMISSION_GUIDELINES.maxFileSizeMB * 1024 * 1024
