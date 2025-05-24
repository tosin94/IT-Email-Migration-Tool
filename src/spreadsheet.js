require('dotenv').config();
require('colors');
const fs = require('fs');
const readline = require ('readline');
const {google} = require('googleapis');
const { token } = require('./authModule');
const creds = process.env.API_EXEC;

const SCOPES = [
    'https://www.googleapis.com/auth/drive', 
    'https://www.googleapis.com/auth/spreadsheets'
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

/**
 * 
 * @param {function} callback function to be called when token is received and authenticated
 * @param {Object} data data the callback will use
 */
async function getSheetAuth(callback, data)
{
    try{
        var content = fs.readFileSync(creds);
        var res = await authorize(JSON.parse(content), callback, data);
        return res;
    }catch(err){
        console.log('Error loading client secret file:', err);
        throw err;
    }
    /*
    needed synchronous access
    // Load client secrets from a local file.
    fs.readFile(creds, (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Apps Script API.
    authorize(JSON.parse(content), callback, data);
    });  */
}


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 * @param {Object} data data the callback will use
 */
async function authorize(credentials, callback, data) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  try {
      var token = fs.readFileSync(TOKEN_PATH);
      oAuth2Client.setCredentials(JSON.parse(token));
      return callback(oAuth2Client, data);
  } catch (error) {
      return getAccessToken(oAuth2Client, callback, data);
  }

  /*
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback, data);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client, data);
  });*/
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 * @param {Object} data data the callback will use
 */
function getAccessToken(oAuth2Client, callback, data) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      return callback(oAuth2Client, data);
    });
  });
}

/**
 * gets the email to migrate and metadata
 * @param {Object} data data the callback will use
 */
async function getEmailsFromSpreadSheet(data) 
{
    var res  = await getSheetAuth(callAppScript, data);
    return res;
}

/**
 * updates the spreadhsheet on info of the transfer
 * @param {Object} data data the callback will use
 */
async function updateSpreadSheet(data)
{
    var res  = await getSheetAuth(callAppScript, data);
    return res;
}

async function appAscriptCloud(data) {
  var res = await getSheetAuth(callAppScript, data);
  return res;
}

async function test()
{
    var res = await getSheetAuth(callAppScript, {
        function: "testfunc",
        devMode: true
    });
    
    return res;
    
}

/**
 * uses the authenticated client to call the appscript API. Not to be called directly
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {Object} data data the callback will use
 */
async function callAppScript(auth, data)
{
    const script = google.script({
        version: "v1",
        auth: auth
    });
    try{
        var data = await script.scripts.run({
            scriptId: process.env.SCRIPT_ID,
            resource: data
        });
        if (data.error) {
            // The API executed, but the script returned an error.
      
            // Extract the first (and only) set of error details. The values of this
            // object are the script's 'errorMessage' and 'errorType', and an array
            // of stack trace elements.
            const error = data.error.details[0];
            console.log('Script error message: ' + error.errorMessage);
            console.log('Script error stacktrace:');
      
            if (error.scriptStackTraceElements) {
              // There may not be a stacktrace if the script didn't start executing.
              for (let i = 0; i < error.scriptStackTraceElements.length; i++) {
                const trace = error.scriptStackTraceElements[i];
                console.log('\t%s: %s', trace.function, trace.lineNumber);
              }
            }
          }
          //console.log("## " + `${data.data.response.result}`.green); 
          return data.data.response.result;
    }catch(err){
        console.log(`The API run method returned an error: ${err}`);
        throw err;
    }
}
module.exports = {updateSpreadSheet, getEmailsFromSpreadSheet, appAscriptCloud}