
module.exports = ({ db }) => {

  const query = () => {
    // all holcs must receive operational newsletter
    const holcs = db.asl('profiles')
      .select('profiles.first_name', 'profiles.last_name', 'profiles.email')
      .select('establishments.name AS establishment')
      .select(db.asl.raw("'yes' as is_holc"))
      .join('roles', 'roles.profile_id', '=', 'profiles.id')
      .join('establishments', 'establishments.id', '=', 'roles.establishment_id')
      .where('roles.type', '=', 'holc')
      .whereNull('roles.deleted');

    const query = db.asl('profiles')
      .select('profiles.first_name', 'profiles.last_name', 'profiles.email')
      .select('establishments.name AS establishment')
      .select(db.asl.raw("'no' as is_holc"))
      .join('permissions', 'permissions.profile_id', '=', 'profiles.id')
      .join('establishments', 'establishments.id', '=', 'permissions.establishment_id')
      .join('email_preferences', 'email_preferences.profile_id', '=', 'profiles.id')
      .whereNull('permissions.deleted')
      .whereRaw(`email_preferences.preferences->'newsletters' \\? 'operational'`) // user has selected operational newsletter
      .union(holcs)
      .orderBy([{ column: 'last_name' }, { column: 'first_name' }, { column: 'establishment' }]);

    return query;
  };

  const parse = profile => {
    return profile;
  };

  return { query, parse };

};
