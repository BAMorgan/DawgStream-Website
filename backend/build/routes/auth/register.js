"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRouter = void 0;
// express is the framework we're going to use to handle requests
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const key = {
    secret: process.env.JSON_WEB_TOKEN,
};
const utilities_1 = require("../../core/utilities");
const isStringProvided = utilities_1.validationFunctions.isStringProvided;
//const isNumberProvided = validationFunctions.isNumberProvided;
const generateHash = utilities_1.credentialingFunctions.generateHash;
const generateSalt = utilities_1.credentialingFunctions.generateSalt;
const registerRouter = express_1.default.Router();
exports.registerRouter = registerRouter;
// Password must be at least 8 characters, contain one uppercase letter, one lowercase letter, and one number
const isValidPassword = (password) => isStringProvided(password) &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password);
// Phone number validation requires at least 10 digits (no special characters)
const isValidPhone = (phone) => isStringProvided(phone) && /^\d{10,}$/.test(phone);
// Email validation requires the "@" symbol and a domain name
const isValidEmail = (email) => isStringProvided(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidRole = (priority) => utilities_1.validationFunctions.isNumberProvided(priority) &&
    parseInt(priority) >= 1 &&
    parseInt(priority) <= 5;
// middleware functions may be defined elsewhere!
const emailMiddlewareCheck = (request, response, next) => {
    if (isValidEmail(request.body.email)) {
        next();
    }
    else {
        response.status(400).send({
            message: 'Invalid or missing email  - please refer to documentation',
        });
    }
};
/**
 * @api {post} /register Request to register a user
 *
 * @apiDescription Document this route. !**Document the password rules here**!
 * !**Document the role rules here**!
 *
 * @apiName PostRegister
 * @apiGroup Auth
 *
 * @apiBody {String} firstname a users first name
 * @apiBody {String} lastname a users last name
 * @apiBody {String} email a users email *unique
 * @apiBody {String} password a users password
 * @apiBody {String} username a username *unique
 * @apiBody {String} role a role for this user [1-5]
 * @apiBody {String} phone a phone number for this user
 *
 * @apiSuccess (Success 201) {string} accessToken a newly created JWT
 * @apiSuccess (Success 201) {number} id unique user id
 *
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * @apiError (400: Invalid Password) {String} message "Invalid or missing password  - please refer to documentation"
 * @apiError (400: Invalid Phone) {String} message "Invalid or missing phone number  - please refer to documentation"
 * @apiError (400: Invalid Email) {String} message "Invalid or missing email  - please refer to documentation"
 * @apiError (400: Invalid Role) {String} message "Invalid or missing role  - please refer to documentation"
 * @apiError (400: Username exists) {String} message "Username exists"
 * @apiError (400: Email exists) {String} message "Email exists"
 *
 */
registerRouter.post('/register', emailMiddlewareCheck, (request, response, next) => {
    if (isStringProvided(request.body.firstname) &&
        isStringProvided(request.body.lastname) &&
        isStringProvided(request.body.username)) {
        next();
    }
    else {
        response.status(400).send({
            message: 'Missing required information',
        });
    }
}, (request, response, next) => {
    if (!request.body.phone || isValidPhone(request.body.phone)) {
        next();
        return;
    }
    else {
        response.status(400).send({
            message: 'Invalid or missing phone number  - please refer to documentation',
        });
        return;
    }
}, (request, response, next) => {
    if (isValidPassword(request.body.password)) {
        next();
    }
    else {
        response.status(400).send({
            message: 'Invalid or missing password  - please refer to documentation',
        });
    }
}, (request, response, next) => {
    if (isValidRole(request.body.role)) {
        next();
    }
    else {
        response.status(400).send({
            message: 'Invalid or missing role  - please refer to documentation',
        });
    }
}, (request, response, next) => {
    const theQuery = 'INSERT INTO Account(firstname, lastname, username, email, phone, account_role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING account_id';
    const values = [
        request.body.firstname,
        request.body.lastname,
        request.body.username,
        request.body.email,
        request.body.phone || null,
        request.body.role,
    ];
    console.dir(Object.assign(Object.assign({}, request.body), { password: '******' }));
    utilities_1.pool.query(theQuery, values)
        .then((result) => {
        request.id = result.rows[0].account_id;
        next();
    })
        .catch((error) => {
        //log the error
        if (error.constraint == 'account_username_key') {
            response.status(400).send({
                message: 'Username exists',
            });
        }
        else if (error.constraint == 'account_email_key') {
            response.status(400).send({
                message: 'Email exists',
            });
        }
        else {
            //log the error
            console.error('DB Query error on register');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        }
    });
}, (request, response) => {
    const salt = generateSalt(32);
    const saltedHash = generateHash(request.body.password, salt);
    const theQuery = 'INSERT INTO Account_Credential(account_id, salted_hash, salt) VALUES ($1, $2, $3)';
    const values = [request.id, saltedHash, salt];
    utilities_1.pool.query(theQuery, values)
        .then(() => {
        const accessToken = jsonwebtoken_1.default.sign({
            role: request.body.role,
            id: request.id,
        }, key.secret, {
            expiresIn: '14 days',
        });
        response.status(201).send({
            accessToken,
            id: request.id,
        });
    })
        .catch((error) => {
        //log the error
        console.error('DB Query error on register');
        console.error(error);
        response.status(500).send({
            message: 'server error - contact support',
        });
    });
});
registerRouter.get('/hash_demo', (request, response) => {
    const password = 'password12345';
    const salt = generateSalt(32);
    const saltedHash = generateHash(password, salt);
    const unsaltedHash = generateHash(password, '');
    response.status(200).send({
        salt: salt,
        salted_hash: saltedHash,
        unsalted_hash: unsaltedHash,
    });
});
//# sourceMappingURL=register.js.map