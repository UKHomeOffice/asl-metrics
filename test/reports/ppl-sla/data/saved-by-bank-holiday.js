module.exports = [
  {
    event_name: 'status:new:endorsed',
    event: {
      data: {
        meta: {
          awerb: 'Yes',
          ready: 'Yes'
        },
        model: 'project',
        action: 'grant'
      },
      event: 'status:new:endorsed',
      status: 'endorsed'
    },
    created_at: '2020-03-10T10:44:36.440124+00:00'
  },
  {
    event_name: 'status:endorsed:with-inspectorate',
    event: {
      data: {
        meta: {
          awerb: 'Yes',
          ready: 'Yes',
          authority: 'Yes'
        },
        model: 'project',
        action: 'grant'
      },
      event: 'status:endorsed:with-inspectorate',
      status: 'with-inspectorate'
    },
    created_at: '2020-03-10T10:44:37.173304+00:00'
  },
  {
    event_name: 'status:with-inspectorate:inspector-recommended',
    event: {
      data: {
        meta: {
          awerb: 'Yes',
          ready: 'Yes',
          authority: 'Yes'
        },
        model: 'project',
        action: 'grant',
        extended: false
      },
      event: 'status:with-inspectorate:inspector-recommended',
      status: 'inspector-recommended'
    },
    created_at: '2020-05-06T11:29:54.567+00:00'
  },
  {
    event_name: 'status:inspector-recommended:resolved',
    event: {
      data: {
        meta: {
          awerb: 'Yes',
          ready: 'Yes',
          authority: 'Yes'
        },
        model: 'project',
        action: 'grant',
        extended: false
      },
      event: 'status:inspector-recommended:resolved',
      status: 'resolved'
    },
    // deadline _should_ be 2020-05-05 if not for bank holidays
    created_at: '2020-05-06T15:00:47.074+00:00'
  }
];
