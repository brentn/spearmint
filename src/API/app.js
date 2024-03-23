const express = require('express');
const axios = require('axios');
const cors = require('cors');

// const { OAuth2Client } = require('google-auth-library');
// const oauth2Client = new OAuth2Client()

const app = express();

// Enable CORS for all routes
app.use(cors());

app.get('/status', (request, response) => {
  const status = {
    'Status': 'Running'
  };
  response.send(status);
});


app.post('/linkToken', async (req, res) => {
  try {
    const accessToken = req.headers.authorization.substring(7);
    console.log('Access Token:', accessToken);

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
        coutry_codes: ['CA'],
        user: {
          client_user_id: userDetails.sub
        }
      }
    )

    res.status(200).json({
      google_access_token: accessToken,
      plaid_token: plaidResponse.data.link_token
    });
  } catch (error) {
    console.error('Error saving code:', error);
    res.status(500).json({ message: 'Failed to save code' });
  }
});


app.listen(process.env.PORT || 4000, () => {
  console.log('Server running on port', process.env.PORT || 4000);
});
