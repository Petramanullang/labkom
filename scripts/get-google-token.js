const { google } = require("googleapis");
const readline = require("readline");

const oauth2Client = new google.auth.OAuth2(
  "CLIENT_ID",
  "CLIENT_SECRET",
  "http://localhost:3000/api/auth/google/callback",
);

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",

  scope: ["https://www.googleapis.com/auth/drive"],
});

console.log(url);
