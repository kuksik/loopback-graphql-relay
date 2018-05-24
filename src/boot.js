'use strict';

const _ = require('lodash');
const Engine = require('apollo-engine').Engine;
const graphql = require('graphql-server-express');
const bodyParser = require('body-parser');
const { getSchema } = require('./schema/index');

const startSubscriptionServer = require('./subscriptions');
const patchChangeStream = require('./subscriptions/patchChangeStream');

module.exports = function(app, options) {
  // console.log('Option Param', options);
  const models = app.models();
  
  _.forEach(models, (model) =>  {
    patchChangeStream(model);
  });

  const schema = getSchema(models, options);
  // const apollo = options.apollo;
  const apollo = {
    apiKey: 'service:BlueEastCode-4822:GPjWuVoaPBzEDA9RvGzP9A',
    debugLevel: 'ERROR',
    graphqlPort: 8000,
    dumpTraffic: false
  }
  const graphiqlPath = options.graphiqlPath || '/graphiql';
  const path = options.path || '/graphql';

    if (apollo) {
      if (!apollo.apiKey) {
        throw new Error('Apollo engine api key is not defined');
      }
      const engine = new Engine({
        engineConfig: {
          apiKey: apollo.apiKey,
          logging: {
            level: apollo.debugLevel || 'DEBUG', // Engine Proxy
            // logging level.
            // DEBUG, INFO, WARN
            // or ERROR
          },
        },
        graphqlPort: apollo.graphqlPort || 8000, // GraphQL port
        endpoint: path || '/graphql', // GraphQL endpoint suffix -
        // '/graphql' by default
        dumpTraffic: apollo.dumpTraffic || false, // Debug configuration that logs traffic between
        // Proxy and GraphQL server
      });
  
      engine.start();
  
      app.use(engine.expressMiddleware());
    }

  app.use(path, bodyParser.json(), graphql.graphqlExpress(req => ({
    schema,
    context: {
      app,
      req
    },
    tracing: true,
    cacheControl: true
  })));

  app.use(graphiqlPath, graphql.graphiqlExpress({
    endpointURL: path
  }));

  // Subscriptions
  try {
    startSubscriptionServer(app, schema, options);
  } catch (ex) {
    console.log(ex);
  }
};
