const { difference } = require('lodash');

module.exports = settings => {

  if (!settings.flowUrl) {
    throw new Error('Workflow status endpoint url is not configured');
  }

  const getOpenStatuses = flow => {
    return Object.keys(flow).reduce((openStatuses, status) => {
      if (flow[status].open) {
        openStatuses.push(status);
      }
      return openStatuses;
    }, []);
  };

  const getClosedStatuses = flow => difference(Object.keys(flow), getOpenStatuses(flow));

  const getWithAsruStatuses = flow => {
    return Object.keys(flow).reduce((withAsruStatuses, status) => {
      if (flow[status].withASRU) {
        withAsruStatuses.push(status);
      }
      return withAsruStatuses;
    }, []);
  };

  const getNotWithAsruStatuses = flow => difference(Object.keys(flow), getWithAsruStatuses(flow));

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
            req.flow = {
              all: json,
              open: getOpenStatuses(json),
              closed: getClosedStatuses(json),
              withAsru: getWithAsruStatuses(json),
              notWithAsru: getNotWithAsruStatuses(json)
            };
          })
          .then(() => next())
          .catch(next);
      });

  };

};
