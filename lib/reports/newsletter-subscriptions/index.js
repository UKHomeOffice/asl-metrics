const { omit } = require('lodash');

module.exports = ({ db }) => {

  const query = () => {
    // all holcs must receive operational newsletter
    const holcs = db.asl('profiles')
      .select('profiles.id', 'profiles.first_name', 'profiles.last_name', 'profiles.email')
      .select('establishments.name AS establishment')
      .join('roles', 'roles.profile_id', '=', 'profiles.id')
      .join('establishments', 'establishments.id', '=', 'roles.establishment_id')
      .where('roles.type', '=', 'holc')
      .whereNull('roles.deleted');

    // user has specifically selected operational newsletter
    const subscriptions = db.asl('profiles')
      .select('profiles.id', 'profiles.first_name', 'profiles.last_name', 'profiles.email')
      .select('establishments.name AS establishment')
      .join('permissions', 'permissions.profile_id', '=', 'profiles.id')
      .join('establishments', 'establishments.id', '=', 'permissions.establishment_id')
      .join('email_preferences', 'email_preferences.profile_id', '=', 'profiles.id')
      .whereNull('permissions.deleted')
      .whereRaw(`email_preferences.preferences->'newsletters' \\? 'operational'`);

    // could not get group by to work with union so wrap it in outer query to apply the group by
    const query = db.asl
      .select('first_name', 'last_name', 'email')
      .select(db.asl.raw('array_agg(establishment) AS establishments'))
      .from(subscriptions.unionAll(holcs).as('profiles'))
      .groupBy('id', 'first_name', 'last_name', 'email')
      .orderBy([{ column: 'last_name' }, { column: 'first_name' }]);

    return query;
  };

  const parse = profile => {
    return {
      ...omit(profile, 'establishments'),
      establishments: profile.establishments ? profile.establishments.join(', ') : ''
    };
  };

  return { query, parse };

};
