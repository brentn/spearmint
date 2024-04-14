const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const LocalStorage = require('node-localstorage').LocalStorage,
  localStorage = new LocalStorage('./scratch');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
import { NextFunction, Request, Response } from "express";
const server = require("fix-esm").require("@passwordless-id/webauthn/dist/esm/server");
require('dotenv').config();

if (!process.env.PLAID_SECRET) {
  throw new Error('Missing Environment Variables')
}

const plaidEnvironment = process.env.PLAID_ENVIRONMENT;
const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidSecret = process.env.PLAID_SECRET;
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',');


const anonymousEndpoints = ['/status', '/challenge', '/register', '/authenticate'];

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(async (req: Request, res: Response, next: NextFunction) => {
  console.log('Request:', req.url);
  if (anonymousEndpoints.includes(req.url)) {
    next();
  } else {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const credentialId = req.headers.authorization.split(' ')[1];
      const isRegisteredUser = JSON.parse(localStorage.getItem('credentials') || '[]').find((a: { id: string }) => a.id === credentialId);
      if (isRegisteredUser) {
        req.headers['userId'] = credentialId;
        next();
      } else {
        res.status(401).json({ message: 'Invlaid User' })
      }
    } else {
      res.status(401).json({ message: 'Unauthorized' });
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
});

app.get('/challenge', async (req: Request, res: Response) => {
  const challenges: string[] = JSON.parse(localStorage.getItem('challenges') || '[]');
  const challenge = crypto.randomBytes(20).toString('hex');
  localStorage.setItem('challenges', JSON.stringify([...challenges, challenge]));
  res.status(200).json({ challenge });
});

app.post('/register', async (req: Request, res: Response) => {
  try {
    console.log('registering user...')
    const challenges: string[] = JSON.parse(localStorage.getItem('challenges') || '[]');
    const credentials: object[] = JSON.parse(localStorage.getItem('credentials') || '[]');
    const origin = (origin: string) => allowedOrigins?.includes(origin);
    let verifiedRegistration;
    challenges.forEach(async challenge => {
      try {
        verifiedRegistration = await server.verifyRegistration(req.body, { challenge, origin });
        localStorage.setItem('challenges', JSON.stringify(challenges.filter(a => a !== challenge)));
        localStorage.setItem('credentials', JSON.stringify([...credentials, verifiedRegistration]));
      }
      catch (err) { }
    });
    if (!verifiedRegistration) {
      throw new Error('Unable to verify user registration');
    }
    res.status(200).json(verifiedRegistration);
    console.log('user registered')
  } catch (error) {
    console.error('Error registering new user:', error);
    res.status(500).json({ message: 'Failed to register new user' });
  }
});

app.post('/authenticate', async (req: Request, res: Response) => {
  try {
    console.log('authenticating user...')
    const credentialId = req.body.credentialId;
    const credentialKey = JSON.parse(localStorage.getItem('credentials') || '[]').find((a: { id: string }) => a.id === credentialId);
    const challenges: string[] = JSON.parse(localStorage.getItem('challenges') || '[]');
    await server.verifyAuthentication(req.body, credentialKey, {
      challenge: (challenge: string) => {
        if (challenges.includes(challenge)) {
          LocalStorage.setItem('challenges', JSON.stringify(challenges.filter(a => a !== challenge)));
          return true;
        }
        return false;
      },
      origin: (origin: string) => allowedOrigins?.includes(origin),
      userVerified: true,
      verbose: false
    });
    res.status(200);
    console.log('user authenticated');
  } catch (error) {
    console.error('Error authenticating user:', error);
    res.status(500).json({ message: 'Failed to authenticate user' });
  }
});

app.post('/linkToken', async (req: Request, res: Response) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: req.headers['userId'],
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
        client_user_id: req.headers['userId'],
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


