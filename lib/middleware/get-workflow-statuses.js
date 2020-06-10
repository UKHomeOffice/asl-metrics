module.exports = settings => {

  if (!settings.flowUrl) {
    next(new Error('Workflow status endpoint url is not configured'));
  }

  return (req, res, next) => {

    fetch(settings.flowUrl, { headers: { Authorization: req.get('Authorization') } })
      .then(response => {
        return response.json()
          .then(json => {
            if (response.statusCode > 399) {
              const err = new Error(json.message);
              err.status = response.statusCode;
              Object.assign(err, json);
              throw err;
            }
            return json;
          })
          .then((json) => {
            req.flow = json;
          })
          .then(() => next())
          .catch(next);
      })

  };

};
