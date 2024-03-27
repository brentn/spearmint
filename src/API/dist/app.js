"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const { Configuration, PlaidApi, Products, PlaidEnvironments } = require('plaid');
require('dotenv').config();
if (!process.env.PLAID_SECRET) {
    throw new Error('Missing Environment Variables');
}
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const plaidEnvironment = process.env.PLAID_ENVIRONMENT;
const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidSecret = process.env.PLAID_SECRET;
var userId = null;
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const token = req.headers.authorization.split('Bearer ')[1];
        try {
            const ticket = yield googleClient.verifyIdToken({
                idToken: token,
                audience: googleClientId,
            });
            const payload = ticket.getPayload();
            userId = payload['sub'];
            next();
        }
        catch (error) {
            console.error('Error verifying token:', error);
        }
    }
}));
const googleClient = new OAuth2Client();
const configuration = new Configuration({
    basePath: PlaidEnvironments[(plaidEnvironment || 'sandbox')],
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': plaidClientId,
            'PLAID-SECRET': plaidSecret,
        },
    },
});
const plaidClient = new PlaidApi(configuration);
app.get('/status', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.status(200).json({ message: 'Server is running' });
}));
app.post('/linkToken', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield plaidClient.linkTokenCreate({
            user: {
                client_user_id: userId,
            },
            client_name: 'Spearmint',
            products: ['transactions'],
            transactions: {
                days_requested: 60
            },
            country_codes: ['CA'],
            language: 'en',
        });
        console.log('Link Token:', response.data.link_token);
        res.status(200).json({ link_token: response.data.link_token });
    }
    catch (error) {
        console.error('Error getting link token:', error);
        res.status(500).json({ message: 'Failed to get link token' });
    }
}));
app.post('/accessToken', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const public_token = (_a = req.body) === null || _a === void 0 ? void 0 : _a.public_token;
        const response = yield plaidClient.itemPublicTokenExchange({ public_token });
        console.log('Access Token:', response.data.access_token, 'Item ID:', response.data.item_id);
        return res.status(200).json({
            access_token: response.data.access_token,
            item_id: response.data.item_id
        });
    }
    catch (error) {
        console.error('Error exchanging public token:', error);
        res.status(500).json({ message: 'Failed to exchange public token for access token' });
    }
}));
app.post('/balances', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const request = { access_token: (_b = req.body) === null || _b === void 0 ? void 0 : _b.access_token };
        const response = yield plaidClient.accountsBalanceGet(request);
        return res.status(200).json({
            accounts: response.data.accounts
        });
    }
    catch (error) {
        console.error('Error getting account balances:', error);
        res.status(500).json({ message: 'Failed to get account balances' });
    }
}));
app.post('/transactions', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    try {
        const request = { access_token: (_c = req.body) === null || _c === void 0 ? void 0 : _c.access_token };
        const response = yield plaidClient.transactionsSync(request);
        return res.status(200).json({
            transactions: response.data
        });
    }
    catch (error) {
        console.error('Error getting transations:', error);
        res.status(500).json({ message: 'Failed to get transactions' });
    }
}));
app.listen(process.env.PORT || 4000, () => {
    console.log('Server running on port', process.env.PORT || 4000);
});
