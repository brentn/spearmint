const express = require('express');
const axios = require('axios');
const cors = require('cors');

// const { OAuth2Client } = require('google-auth-library');
// const oauth2Client = new OAuth2Client()

const app = express();

// Enable CORS for all routes
app.use(cors());

app.post('/linkToken', async (req, res) => {
  try {
    const accessToken = req.headers.authorization.substring(7);

    // Fetch user details using the access token
    const userResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const userDetails = userResponse.data;
    console.log('User Details:', userDetails);

    const plaidResponse = await axios.post(
      process.env.PlaidURL + '/link/token/create',
      {
        client_id: '65e630db59195c001ba33978',
        secret: process.env.PlaidSecret,
        client_name: 'Spearmint',
        language: 'en',
        country_codes: ['CA'],
        user: {
          client_user_id: userDetails.sub
        },
        products: ['transactions'],
        transactions: {
          days_requested: 60
        }
      }
    )
    console.log('Plaid Response:', plaidResponse);

    res.status(200).json({
      link_token: plaidResponse.data.link_token
    });
  } catch (error) {
    console.error('Error getting link token:', error);
    res.status(500).json({ message: 'Failed to get link token' });
  }
});

app.post('/accessToken', async (req, res) => {
  try {
    const plaidResponse = await axios.post(
      process.env.PlaidURL + '/item/public_token/exchange',
      {
        client_id: '65e630db59195c001ba33978',
        secret: process.env.PlaidSecret,
        public_token: req.body.public_token,
      }
    );
    console.log('Plaid Response:', plaidResponse);
    return res.status(200).json({
      access_token: plaidResponse.data.access_token,
      item_id: plaidResponse.data.item_id
    });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    res.status(500).json({ message: 'Failed to exchange public token for access token' });
  }

});

app.listen(process.env.PORT || 4000, () => {
  console.log('Server running on port', process.env.PORT || 4000);
});
