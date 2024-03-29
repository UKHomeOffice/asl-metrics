module.exports = {
  all: {
    new: { open: true, withASRU: false },
    autoresolved: { open: false, withASRU: false },
    resubmitted: { open: true, withASRU: false },
    updated: { open: true, withASRU: false },
    'returned-to-applicant': { open: true, withASRU: false },
    'recalled-by-applicant': { open: true, withASRU: false },
    'discarded-by-applicant': { open: false, withASRU: false },
    'withdrawn-by-applicant': { open: false, withASRU: false },
    'with-ntco': { open: true, withASRU: false },
    'awaiting-endorsement': { open: true, withASRU: false },
    endorsed: { open: true, withASRU: false },
    'with-licensing': { open: true, withASRU: true },
    'with-inspectorate': { open: true, withASRU: true },
    'referred-to-inspector': { open: true, withASRU: true },
    'inspector-recommended': { open: true, withASRU: true },
    'inspector-rejected': { open: true, withASRU: true },
    resolved: { open: false, withASRU: false },
    rejected: { open: false, withASRU: false },
    recovered: { open: true, withASRU: false },
    'discarded-by-asru': { open: false, withASRU: false }
  },
  open: [
    'new',
    'resubmitted',
    'updated',
    'returned-to-applicant',
    'recalled-by-applicant',
    'with-ntco',
    'awaiting-endorsement',
    'endorsed',
    'with-licensing',
    'with-inspectorate',
    'referred-to-inspector',
    'inspector-recommended',
    'inspector-rejected',
    'recovered'
  ],
  closed: [
    'autoresolved',
    'discarded-by-applicant',
    'withdrawn-by-applicant',
    'resolved',
    'rejected',
    'discarded-by-asru'
  ],
  withAsru: [
    'with-licensing',
    'with-inspectorate',
    'referred-to-inspector',
    'inspector-recommended',
    'inspector-rejected'
  ],
  notWithAsru: [
    'new',
    'autoresolved',
    'resubmitted',
    'updated',
    'returned-to-applicant',
    'recalled-by-applicant',
    'discarded-by-applicant',
    'withdrawn-by-applicant',
    'with-ntco',
    'awaiting-endorsement',
    'endorsed',
    'resolved',
    'rejected',
    'recovered',
    'discarded-by-asru'
  ]
};
