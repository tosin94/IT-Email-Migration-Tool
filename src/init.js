const {logError} = require ('./database/db');
const {DB} = require('./calls');
const {T_Logger: Logger} = require('./logging/init')

var { authorizeClient} = require('./authModule')
const {google} = require('googleapis');

async function main(op, params)
{
    await authorizeClient(params.userId); //authorize client if not authorized

    /*
        token can change based on the sent userId. Idea is to prevent creation of new id's everytime the token has to be switched
        should only create new one on expiry
     */
    var {token} = require('./authModule') //update the client if necessary
    var authClient = token[params.userId].authClient

    const gmail = google.gmail({
        version: 'v1',
        auth: authClient
    }); 

    res = "";
    switch(op)
    {
        case "listMsg":
            res = await gmail.users.messages.list(params);
        break;

        case "getMsg":
            res = await gmail.users.messages.get(params);
        break;

        case "listLabel":
            res = await gmail.users.labels.list(params);
        break;

        case "importMsg":
            res = await gmail.users.messages.import(params);
        break;

        case "createLabel":
            res = await gmail.users.labels.create(params);
        break;
        
        case "getProfile":
            res = await gmail.users.getProfile(params);
        break;
        
        case "importMSG":
            res = await gmail.users.import(params);
            //await gmail.users.import(params,)

        default:
            throw new Error("Error executing operation, wrong op-code");
    }

    return res;
}

/**
 * 
 * @param {String} op - code to decide what operation needs to be run
 * @param {Object} params - parameters for operation
 */
async function run(op, params)
{
    return main(op, params).catch((e)=>{
        console.log(`There has been a problem with the tool, please check the error log`.red);
        Logger.error(`${e} stack: ${e.stack}`,{label: 'Init.js --> catch in main()'})
        //console.log(`${e}`.red.bgBlack);
        if (params == undefined)
        {
            if (!(op == "importMsg"))
            {
                logError(DB, e.response.data,e.code, params.userId, params);
            }

            throw e
        }

        if (params.hasOwnProperty('raw'))
        {
            delete params.raw;
        }
        else if (params.hasOwnProperty('requestBody'))
        {
            if (params.requestBody.hasOwnProperty('raw'))
            {
                delete params.requestBody.raw;
            }
            ;//nothing to do here
        }
        //include logic to check if it has the property "response", 
        //if not log a different type of error with logError
        //sort - params.userId isnt always the user being transfered. in the case of import, its the
        //account being transfered into... needs sorting
        if ((op != "importMsg") && (e.response != undefined))
        {
            logError(DB, e.response.data,e.code, params.userId, params).then(console.log('error - init.js --> logged to log file ln 95'));
        }
        throw e;
    });
}
module.exports = { run };
