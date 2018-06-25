'use strict';

const _ = require('lodash');

const promisify = require('promisify-node');
const utils = require('../utils');
const {connectionFromPromisedArray} = require('graphql-relay');
const allowedVerbs = ['get', 'head'];
const defaultFindMethods = ['find'];

module.exports = function getRemoteMethodQueries(model) {
  const hooks = {};

  if (model.sharedClass && model.sharedClass.methods) {
    model.sharedClass.methods().forEach((method) => {
      if (method.shared && method.name.indexOf('Stream') === -1 && method.name.indexOf('invoke') === -1) {
        if (!utils.isRemoteMethodAllowed(method, allowedVerbs)) {
          return;
        }

        // TODO: Add support for static methods
        if (method.isStatic === false) {
          return;
        }

        const typeObj = utils.getRemoteMethodOutput(method);

        const acceptingParams = utils.getRemoteMethodInput(method, typeObj.list);
        const hookName = utils.getRemoteMethodQueryName(model, method);

        hooks[hookName] = {
          name: hookName,
          description: method.description,
          meta: {relation: true},
          args: acceptingParams,
          type: typeObj.type,
          resolve: (__, args, context, info) => {
            let params = buildParams(method, context, acceptingParams, args);


            const wrap = promisify(model[method.name]);

            if (typeObj.list) {
              if (defaultFindMethods.indexOf(method.name) == -1 && method.returns[0].type.indexOf('any') != -1) {
                params = [];
                _.forEach(method.accepts, (accept, index) => {
                  params.push(args[accept.arg]);
                });
              }

              return connectionFromPromisedArray(wrap.apply(model, params), args, model);
            }

            return wrap.apply(model, params);
          },
        };
      }
    });
  }

  return hooks;
};

function buildParams(method, ctx, acceptingParams, args) {
  let params = [];

  _.forEach(acceptingParams, (param, name) => {
    let val;
    const a = _.find(method.accepts, (p) =>  p.arg === name);
    const httpFormat = a && a.http;
    if (httpFormat) {
      switch (typeof httpFormat) {
        case 'function':
          val = httpFormat(ctx);
          break;
        case 'object':
          switch (httpFormat.source) {
            case 'body':
              val = ctx.req.body;
              break;
            case 'form':
            case 'formData':
              val = ctx.req.body && ctx.req.body[name];
              break;
            case 'query':
              val = ctx.req.query[name];
              break;
            case 'path':
              val = ctx.req.params[name];
              break;
            case 'header':
              val = ctx.req.get(name);
              break;
            case 'req':
              val = ctx.req;
              break;
            case 'res':
              val = ctx.res;
              break;
            case 'context':
              val = ctx;
              break;
          }
          break;
      }
    } else {
      val = args[name];
    }
    params.push(val)
  });

  return params;
};
