const database = require('./database');

exports.getActive = function getActive() {
  return Promise.resolve()
    .then(() => database.getAllEnvironments())
    .then((envs) => envs
      .map((env) => Object.assign({}, env, { time: new Date(env.time) }))
      .filter((env) => {
        const time = env.time.getTime();
        const now = new Date().getTime();
        return now - time < 8 * 3600 * 1000; // More than 8 hours since deploy
      })
    );
}
