const { FlatCompat } = require("@eslint/eslintrc");
const path = require("path");

const compat = new FlatCompat({
  baseDirectory: __dirname, // Already defined in CommonJS
});

module.exports = [...compat.extends("next/core-web-vitals")];
