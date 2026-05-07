const { nanoid } = require('nanoid');

const generateCode = () => {
  return nanoid(10).toUpperCase();
};

module.exports = generateCode;
