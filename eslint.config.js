'use strict';

// ESLint flat config (ESLint >= 9). Replaces the legacy .eslintrc.
// Reuses the rules from eslint-config-nodemailer, skipping any that ESLint no longer ships.
const js = require('@eslint/js');
const globals = require('globals');
const { builtinRules } = require('eslint/use-at-your-own-risk');
const nodemailerConfig = require('eslint-config-nodemailer');

const rules = Object.fromEntries(Object.entries(nodemailerConfig.rules).filter(([name]) => builtinRules.has(name)));

module.exports = [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...nodemailerConfig.globals
            }
        },
        rules
    },
    {
        files: ['test/**/*.js'],
        rules: {
            // The tests load several nodemailer majors on demand.
            'global-require': 'off'
        }
    }
];
