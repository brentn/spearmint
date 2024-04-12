const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Configuration, PlaidApi, Products, PlaidEnvironments } = require('plaid');
import { NextFunction, Request, Response } from "express";
require('dotenv').config();

if (!process.env.PLAID_SECRET) {
  throw new Error('Missing Environment Variables')
}

const plaidEnvironment = process.env.PLAID_ENVIRONMENT;
const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidSecret = process.env.PLAID_SECRET;


var userId: string | null = null;

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split('Bearer ')[1];
    try {
      const response = await axios.get(`https://api.passwordless.id/openapi/validate?token=${token}`);
      console.log('HERE', Object.keys(response));
      userId = response.payload['sub'];
      next();
    } catch (error: any) {
      console.error('Error verifying token:', error.message, error.config);
    }
  }
});

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

app.get('/status', async (req: Request, res: Response) => {
  res.status(200).json({ message: 'Server is running' });
})

app.post('/linkToken', async (req: Request, res: Response) => {
  try {
    const response = await plaidClient.linkTokenCreate({
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
      access_token: req.body?.accessToken
    });
    res.status(200).json({ link_token: response.data.link_token });
  } catch (error: any) {
    console.error('Error getting link token:', error.response.data);
    res.status(500).json({ message: 'Failed to get link token' });
  }
});

app.put('/linkToken', async (req: Request, res: Response) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: 'Spearmint',
      country_codes: ['CA'],
      language: 'en',
      access_token: req.body?.accessToken
    });
    res.status(200).json({ link_token: response.data.link_token })
  } catch (error: any) {
    console.error('Error getting update link token', error.response.data);
    res.status(500).json({ message: 'Failed to get update link token' });
  }
})

app.post('/accessToken', async (req: Request, res: Response) => {
  try {
    const public_token = req.body?.public_token;
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    console.log('Access Token:', response.data.access_token, 'Item ID:', response.data.item_id)
    return res.status(200).json({
      access_token: response.data.access_token,
      item_id: response.data.item_id
    });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    res.status(500).json({ message: 'Failed to exchange public token for access token' });
  }
});

app.post('/balances', async (req: Request, res: Response) => {
  try {
    const request = { access_token: req.body?.access_token };
    const response = await plaidClient.accountsBalanceGet(request);
    return res.status(200).json({
      accounts: response.data.accounts
    });
  } catch (error: any) {
    console.error('Error getting account balances:', error.code, error.response.data);
    switch (error.response.data.error_code) {
      case 'ITEM_LOGIN_REQUIRED': res.status(401).json({ message: 'Item login required' }); break;
      default: res.status(500).json({ message: 'Failed to get account balances' });
    }
  }
});

app.post('/transactions', async (req: Request, res: Response) => {
  try {
    const request = { access_token: req.body?.access_token };
    const response = await plaidClient.transactionsSync(request);
    return res.status(200).json({
      transactions: response.data
    })
  } catch (error: any) {
    console.error('Error getting transactions:', error.code);
    switch (error.response.data.error_code) {
      case 'ITEM_LOGIN_REQUIRED': res.status(401).json({ message: 'Item login required' }); break;
      default: res.status(500).json({ message: 'Failed to get transactions' });
    }
  }
})

app.listen(process.env.PORT || 4000, () => {
  console.log('Server running on port', process.env.PORT || 4000);
});


