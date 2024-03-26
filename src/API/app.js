const GOOGLE_CLIENT_ID = '316624811771-jugmh69v4b636shvv1c9gtj6glr5i9e7.apps.googleusercontent.com';
const PLAID_CLIENT_ID = '65e630db59195c001ba33978';

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split('Bearer ')[1];
    console.log('Bearer Token:', token);
    try {
      await googleClient.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      let userid = payload['sub']; next();
      console.log('User ID:', userid);
    } catch (error) {
      console.error('Error verifying token:', error);
    }
  }
  res.status(401).json({ message: 'Unauthorized' });
})

const googleClient = new OAuth2Client();
const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PlaidSecret,
    },
  },
});
const plaidClient = new PlaidApi(configuration);

app.get('/status', async (req, res) => {
  res.status(200).json({ message: 'Server is running' });
})

app.post('/linkToken', async (req, res) => {
  try {
    console.log('User Details:', userId);
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
    });
    console.log('Link Token:', response.data.link_token)
    res.status(200).json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error getting link token:', error);
    res.status(500).json({ message: 'Failed to get link token' });
  }
});

app.post('/accessToken', async (req, res) => {
  try {
    const public_token = req.body?.public_token;
    console.log('Public Token:', public_token)
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

app.post('/transactions', async (req, res) => {

});

app.listen(process.env.PORT || 4000, () => {
  console.log('Server running on port', process.env.PORT || 4000);
});


