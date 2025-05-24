require('dotenv').config();
const {google} = require('googleapis');
const keys = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {T_Logger: Logger} = require('./logging/init')

/**
 *  @todo check if token is in database, if it exists for the user, then var token = value from database, if not token = {}
 *  promise.then so you don't need async func hopefully
 */

var token = {} 


async function authorizeClient(user_id)
{
    
    try
    {
        //if it has a user_id property then it definitely has a authclient attached to it
        if (!token.hasOwnProperty(user_id))
        {
            token[user_id] = {authClient :''}
            
            token[user_id].authClient = new google.auth.JWT({
                keyFile: keys,
                scopes: ['https://mail.google.com/'],
                subject: user_id
            });
        }
            
        if (!token[user_id].authClient.credentials || token[user_id].authClient.credentials.expiry_date < Date.now()) {
            await token[user_id].authClient.authorize();
            module.exports = {token};
            
        }
    }catch(error){
        Logger.error(`${error} stack: ${error.stack}`,{label: 'authModule.js'})
        process.exit(1)
    }
    
}



module.exports = {authorizeClient};