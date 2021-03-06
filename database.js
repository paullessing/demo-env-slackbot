const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

const tableName = exports.tableName = 'demo-env-slackbot.environments';

// exports.getItem = function getItem(id, done) {
//   const params = {
//     TableName: tableName,
//     Key: {
//       id: id
//     }
//   };
//
//   docClient.get(params, function(err, data) {
//     if (err) {
//       console.log(err);
//       done(err);
//     } else {
//       console.log(data);
//       done(null, data.Item);
//     }
//   });
// }

exports.getAllEnvironments = function getAllEnvironments() {
  return new Promise((resolve, reject) => {
    const params = {
      TableName: tableName
    };

    docClient.scan(params, onScan);

    let allItems = [];

    function onScan(err, data) {
      if (err) {
        console.error('Unable to scan the table. Error JSON:', JSON.stringify(err, null, 2));
        reject(err);
      } else {
        // print all the movies
        console.log('Scan succeeded.');
        allItems = allItems.concat(data.Items);

        // continue scanning if we have more movies, because
        // scan can retrieve a maximum of 1MB of data
        if (typeof data.LastEvaluatedKey !== 'undefined') {
          console.log('Scanning for more...');
          params.ExclusiveStartKey = data.LastEvaluatedKey;
          docClient.scan(params, onScan);
        } else {
          resolve(allItems);
        }
      }
    }
  });
};

/**
 * Mark an environment as busy.
 * @param username
 * @param environment
 * @param time Can be empty to un-mark
 * @param claimDurationHours {number} optional
 * @returns {Promise}
 */
exports.markEnvironment = function markEnvironment(username, environment, time, claimDurationHours) {
  const item = {
    environment,
    username,
    time: time.toString(),
    claimDurationHours
  };

  return new Promise((resolve, reject) => {
    const itemToInsert = {
      'TableName': tableName,
      'Item' : item
    };

    console.log('Putting:', itemToInsert);

    docClient.put(itemToInsert, (error) => {
      console.log('Finished inserting' + (error ? ' with error' : ''), error);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  })
};

exports.getEnvironment = function getEnvironment(environment) {
  return new Promise((resolve, reject) => {
    const itemToFetch = {
      'TableName': tableName,
      'Key': { environment }
    };

    console.log('Getting:', itemToFetch);

    docClient.get(itemToFetch, (error, data) => {
      console.log('Finished getting' + (error ? ' with error' : ''), error);
      if (error) {
        reject(error);
      } else {
        const item = data.Item;

        const result = {
          environment: item.environment,
          username: item.username,
          time: new Date(item.time),
          claimDurationHours: item.claimDurationHours
        };
        resolve(result);
      }
    });
  })
};
