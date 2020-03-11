'use strict';

module.exports = {
  extends: 'airbnb',
  rules: {
    'class-methods-use-this': 0,
    'consistent-return': 0,
    'function-paren-newline': 0,
    'jsx-a11y/anchor-is-valid': [
      'error',
      {
        components: ['Link'],
        specialLink: ['to'],
      },
    ],
    'jsx-a11y/label-has-for': 0,
    'no-plusplus': 0,
    'no-console': 0,
    'no-else-return': 0,
    'no-param-reassign': 0,
    'arrow-parens': 0,
    'no-use-before-define': 0,
    'no-underscore-dangle': ['error', { 'allow': ['_id', '__STATE'] }],
    'object-curly-newline': ['error',
      {
        multiline: true,
        consistent: true,
      },
    ],
    'import/prefer-default-export': 0,
    'react/prop-types': ['error', {
      ignore: [
        'common',
        'projectStore',
        'mediaStore',
      ], customValidators: []
    }],
    'react/require-default-props': 0,
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-props-no-spreading": 0,
    "react/jsx-fragments": 0,
    semi: ['error', 'always'],
  },
  plugins: [
  "react-hooks"
],
  parser: 'babel-eslint',
  env: {
    browser: true,
    mocha: true,
    node: true,
    es6: true,
    jest: true,
  },
  settings: {
    'import/resolver': {
      node: {
        moduleDirectory: [
          'node_modules',
          '.',
        ]
      }
    }
  }
};
