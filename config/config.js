/**
 * Module dependencies.
 */
const _ = require('lodash');

const allConfig = require('./env/all');
const developmentConfig = require('./env/development');
const testConfig = require('./env/test');
const productionConfig = require('./env/production');

/**
 * Load app configurations
 */
const files = [];
if (process.env.NODE_ENV === 'production') {
  files.push(productionConfig);
} else if (process.env.NODE_ENV === 'test') {
  files.push(testConfig);
} else {
  files.push(developmentConfig);
}
files.push(allConfig);

const config = _.defaultsDeep(...files);

module.exports = config;
module.exports.isTest = process.env.NODE_ENV === 'test';
module.exports.isProduction = process.env.NODE_ENV === 'production';
