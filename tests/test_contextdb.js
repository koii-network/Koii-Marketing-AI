const {Context} = require('../adapters/context/context');
const dotenv = require('dotenv');
dotenv.config();
const context = new Context();
context.initializeContext();