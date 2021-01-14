const { get } = require('lodash');

module.exports = project => {
  if (get(project, 'data.training-licence') === true) {
    return '(f)';
  }

  const mappings = {
    'basic-research': '(a)',
    'translational-research-1': '(bi)',
    'translational-research-2': '(bii)',
    'translational-research-3': '(biii)',
    'safety-of-drugs': '(c)',
    'protection-of-environment': '(d)',
    'preservation-of-species': '(e)',
    'forensic-enquiries': '(g)',
    'purpose-a': '(a)',
    'purpose-b': '(b)',
    'purpose-b1': '(bi)',
    'purpose-b2': '(bii)',
    'purpose-b3': '(biii)',
    'purpose-c': '(c)',
    'purpose-d': '(d)',
    'purpose-e': '(e)',
    'purpose-f': '(f)',
    'purpose-g': '(g)'
  };
  const permissiblePurposes = get(project, 'data.permissible-purpose', []);
  const translationalResearch = get(project, 'data.translational-research', []);
  const legacyPermissiblePurpose = get(project, 'data.purpose', []);
  const legacyPermissiblePurposeB = get(project, 'data.purpose-b', []);

  if (!permissiblePurposes.length && !translationalResearch.length && !legacyPermissiblePurpose.length && !legacyPermissiblePurposeB.length) {
    return '';
  }

  return [
    ...permissiblePurposes,
    ...translationalResearch,
    ...legacyPermissiblePurpose,
    ...legacyPermissiblePurposeB
  ]
    .filter(p => p !== 'translational-research' && p !== 'purpose-b')
    .map(p => mappings[p])
    .sort()
    .join(', ');
};
