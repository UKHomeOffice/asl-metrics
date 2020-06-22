// a static version of the response from workflow for unit test purposes
module.exports = () => {
  return {
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
    'discarded-by-asru': { open: false, withASRU: false }
  };
};
