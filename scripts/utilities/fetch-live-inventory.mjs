import 'dotenv/config';
import etsyOAuthService from './services/etsyOAuthService.js';

const listingId = 1800659590;
const url = `https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`;

const token = await etsyOAuthService.getValidAccessToken();
const apiKey = `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`;

const resp = await fetch(url, {
  headers: {
    'x-api-key': apiKey,
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
});

const text = await resp.text();
console.log('Status:', resp.status);
console.log(text);
