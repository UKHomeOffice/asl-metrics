const {omit, uniqBy} = require('lodash');
const dictionary = require('@ukhomeoffice/asl-dictionary');

const getNames = (rawProfiles, asruType) => {
  let profiles = uniqBy(rawProfiles.filter(p => p && p.id), 'id'); // filter nulls and dedupe

  if (asruType === 'licensing') {
    profiles = profiles.filter(profile => profile.asru_licensing);
  }

  if (asruType === 'inspector') {
    profiles = profiles.filter(profile => profile.asru_inspector);
  }

  return profiles.map(p => `${p.first_name} ${p.last_name}`).join(', ');
};

function getSpeciesList(suitabilities) {
  const uniqueSuitabilities = (suitabilities ?? [])
    .reduce((acc, codes) => {
      (codes ?? []).forEach(code => acc.add(code));
      return acc;
    }, new Set());

  return [...uniqueSuitabilities]
    .map(code => dictionary[code])
    .sort()
    .join(',');
}

module.exports = ({db}) => {

  const query = () => {
    return db.asl('establishments AS est')
      .select(
        'est.id',
        'est.name',
        'est.licence_number',
        'est.status',
        'est.issue_date',
        'est.revocation_date',
        'est.procedure',
        'est.breeding',
        'est.supplying',
        'est.killing',
        'est.rehomes',
        db.asl.raw('JSON_AGG(places.suitability) as suitabilities'),
        db.asl.raw('JSON_AGG(pelh) as pelh'),
        db.asl.raw('JSON_AGG(holc) as holc'),
        db.asl.raw('JSON_AGG(asru) as asru')
      )

      // PELH/NPRCs
      .leftJoin('roles', builder => {
        builder.on('roles.establishment_id', '=', 'est.id')
          .andOn(b2 => {
            // filter the roles in the join, otherwise it only returns establishments with those roles assigned
            // onVal() is used here because on() causes pelh to be double-quoted and Postgres thinks it's a column name
            // onVal isn't currently documented, but it was added here: https://github.com/knex/knex/pull/2746
            b2.onVal('roles.type', '=', 'pelh')
              .orOnVal('roles.type', '=', 'nprc');
          })
          .andOnNull('roles.deleted');
      })
      .leftJoin('profiles AS pelh', 'pelh.id', 'roles.profile_id')

      // HOLCs
      .leftJoin('roles AS roles2', builder => {
        builder
          .on('roles2.establishment_id', '=', 'est.id')
          .andOnVal('roles2.type', '=', 'holc')
          .andOnNull('roles2.deleted');
      })
      .leftJoin('profiles AS holc', 'holc.id', 'roles2.profile_id')

      // inspectors and spocs
      .leftJoin('asru_establishment', 'asru_establishment.establishment_id', 'est.id')
      .leftJoin('profiles AS asru', 'asru.id', 'asru_establishment.profile_id')

      // Authorised areas to get set of species suitability
      .leftJoin('places AS places', 'places.establishment_id', 'est.id')

      .groupBy('est.id')
      .orderBy('est.name');
  };

  const parse = establishment => {
    const activePpls = db.asl('projects')
      .count('*')
      .where({establishment_id: establishment.id, status: 'active', deleted: null})
      .then(activePplCount => activePplCount[0].count);

    // submitted draft ppls: has at least one submitted version
    const submittedDrafts = db.asl('projects')
      .count('*')
      .where({establishment_id: establishment.id, status: 'inactive', deleted: null})
      .whereExists(builder => {
        builder.select('id')
          .from('project_versions')
          .where('status', 'submitted')
          .whereRaw('project_versions.project_id = projects.id');
      })
      .then(submittedDraftsCount => submittedDraftsCount[0].count);

    // unsubmitted draft ppls: has no submitted versions
    const unsubmittedDrafts = db.asl('projects')
      .count('*')
      .where({establishment_id: establishment.id, status: 'inactive', deleted: null})
      .whereNotExists(builder => {
        builder.select('id')
          .from('project_versions')
          .where('status', 'submitted')
          .whereRaw('project_versions.project_id = projects.id');
      })
      .then(unsubmittedDraftsCount => unsubmittedDraftsCount[0].count);

    const speciesHeld = getSpeciesList(establishment.suitabilities);

    return Promise.all([activePpls, submittedDrafts, unsubmittedDrafts])
      .then(([activeProjectCount, submittedDraftsCount, unsubmittedDraftsCount]) => {
        return {
          ...omit(establishment, 'asru', 'suitabilities', 'pelh', 'holc'),
          'species held': speciesHeld,
          pelh: getNames(establishment.pelh),
          holc: getNames(establishment.holc),
          spoc: getNames(establishment.asru, 'licensing'),
          inspector: getNames(establishment.asru, 'inspector'),
          'active_project_count': activeProjectCount,
          'submitted_drafts_count': submittedDraftsCount,
          'unsubmitted_drafts_count': unsubmittedDraftsCount
        };
      });
  };

  return {query, parse};
};
