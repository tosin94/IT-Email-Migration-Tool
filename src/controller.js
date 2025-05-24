const {getEmailsFromSpreadSheet, updateSpreadSheet} = require('./spreadsheet');
const {clearMsg, initDB, updateOpStatus, checkDB, getMessageCount} = require('./database/db');
const { OPCODES, FUNCTIONS, STATUS_KEY } = require('./variables');
const {T_Logger: Logger } = require ('./logging/init')
const calls = require('./calls');
require('colors');

/**
 * @todo 
 * throw errors once https://stackify.com/best-practices-exceptions-java/
 * save label_data collection to a backup collection after transfer is done
 */

/**
 * Controller that starts the transfer process
 * gets the emails to be migrated and calls the appropriate functions
 */
async function controller()
{
    try
    {
        var emails = JSON.parse(await fromSpreadSheet());
        var props = {meta: {
                row: emails.row, 
                column: emails.column, 
                startDate: emails.start_date,
                query: emails.query,
                labelIds: emails.labelIds,
                finishDate: emails.finish_date
            }, 
            userId: emails.origin,
            caller: "getEmailsFromSpreadSheet"
        };
        emails.meta = props.meta;
        await toSheet(emails);
        
        const PARAMS = emails;
        module.exports = {PARAMS}
        
        Logger.info(`Transferring ${JSON.stringify(emails)}`,{label: 'Initial Stage'})
        await updateOpStatus(calls.DB, props);
        await populateDB(emails); // create base for dbs collections like the transfer log and operation status
        
        await calls.createAndSaveLabel(emails.origin);
        //await calls.listLabel(emails.origin);
        //await calls.createLabels(emails.origin);

        if ( emails.labelIds){await calls.listandSaveMsgLabel(emails.origin, emails.labelIds)}
        // default it to transfer the labels as normal
        else {await calls.listandSaveMsg(emails.origin, emails.query)} 
       

        //TODO - if statemnt to choose between listand save and list and save msg label. add extra status for it.
        // await calls.listandSaveMsg(emails.origin, emails.query);
        // await calls.listandSaveMsgLabel(emails.origin, emails.labelIds)
        await updateTotalMsg(emails)
        await calls.getMsg(emails.origin, emails.dest);
    }
    
    catch(err)
    {
        //console.log(err);
        Logger.error(`Error: ${err} .... stack: ${err.stack}`,{label: 'Error controller function'})
        if (emails != undefined)
        {
            await updateOpStatus(calls.DB, {
                userId: emails.origin,
                status: STATUS_KEY.stopped
            });
        }
        //Logger.error(err,{label: 'Error controller function'})
        process.exit(1)
    }
    
}
/**
 * used when the script is stopped and needs to continue
 */
async function cont_exec()
{
    //check database and continue from there status == stopped
    //if checks are okay and we are continuing, updateOpStatus(running);
    try
    {
        var res = await checkDB(calls.DB);

        /**
         * used in updateSheet
         */
        const PARAMS = res.meta;
        module.exports = {PARAMS}

        switch (res.stage)
        {
            case FUNCTIONS.listLabel:
                //console.log(`Resuming from listLabel...`.green);
                Logger.info(`Resuming from listLabel `)
                await calls.listLabel(res.origin);
                await calls.createLabels(res.origin);
                await calls.listandSaveMsg(res.origin);
                await calls.getMsg(res.origin, res.destination);

                break;

            case FUNCTIONS.getMessage:
                //console.log(`\n\n\tResuming transfer.....\n\tTransfering messages\n\t`.green.bgBlack);
                Logger.info(`Resuming transfer.... `,{label: 'cont_exec'})
                await calls.getMsg(res.origin, res.destination);
                break;

            case FUNCTIONS.listandsave:
                Logger.info('Resuming from listandSave...',{label: 'cont_exec'})
                Logger.info(`clearing previously stored messages for ${res.origin}`,{label: 'cont_exec'})
                //console.log(`Resuming from listandSave... \n`.green);
                //console.log(`clearing previously stored messages for ${res.origin}`.green.bgBlack);
                await clearMsg(calls.DB, res.origin);
                await calls.listandSaveMsg(res.origin, res.meta.query);
                await calls.getMsg(res.origin, res.destination);
                break;

            case FUNCTIONS.listandsaveLabel:
                Logger.info('Resuming from listandSaveLabel...',{label: 'cont_exec'})
                Logger.info(`clearing previously stored messages for ${res.origin}`,{label: 'cont_exec'})
                //console.log(`Resuming from listandSave... \n`.green);
                //console.log(`clearing previously stored messages for ${res.origin}`.green.bgBlack);
                await clearMsg(calls.DB, res.origin);
                await calls.listandSaveMsg(res.origin, res.meta.labelIds);
                await calls.getMsg(res.origin, res.destination);
                break;

            case FUNCTIONS.controller:
                Logger.log('calling controller')
                //console.log(`Calling controller...`.green);
                await controller();
                break;
            
            default:
                //console.log(`\n\n\tIssue restarting program\n\n`.red.bgBlack);
                Logger.error(`Error restarting the tool.. `,{label: 'controller'})
                process.exit(1);
        }
    
    }catch(err){
        //console.log(`\n\n\tIssue restarting program: ${err}\n\n`.yellow.bgBlack);
        Logger.error(`Error restarting the tool.. error -  ${err}`,{label: 'controller'})
        await updateOpStatus(calls.DB, {
            userId: res.origin,
            status: STATUS_KEY.stopped
        });
        process.exit(1);
    }
    
}
/**
 * Initial entry into operation_status and transfer_log collection
 * @param {String} origin 
 */
async function populateDB(emails)
{
    //insertOne (email properties, all of them)
    await initDB(calls.DB, {
        status: STATUS_KEY.running,
        origin: emails.origin,
        caller: "populateDB",
        meta: emails.meta,
        destination: emails.dest
    });
}

async function toSheet(params)
{
    var data = {
        function: "updateSheet",
        devMode: true,
        parameters: [
            {
                status: STATUS_KEY.running,
                row: params.row,
                column: params.column,
                startDate: params.start_date,
                date: Date().toString(),
                flag: "update"

            }
        ],
    };
    await updateSpreadSheet(data);
}

async function updateTotalMsg(params)
{
    //get total number of messages to transfer
    let msg_count;
    //get total messages
    var cursor = await getMessageCount(calls.DB, params.origin);
    for await( const count of cursor)
    {
        msg_count = count.count;
    }

    var data = {
        function: "progressUpdate",
        devMode: true,
        parameters: [
            {
                row: params.row,
                column: 8, //whatever the column for total messages is in
                total: msg_count,
                flag: "total"

            }
        ],
    };
    await updateSpreadSheet(data);

}

/**
 * Validate emails retrieved from spreadsheet
 * @returns Boolean
 */
function validate()
{
    /*
    validated on the spreadsheet side rather than here
    */
    
    return true;
}

/**
 * An Object containing two string properties
 * @typedef {Object} Emails
 * @property {String} origin - Mailbox to transfer
 * @property {String} dest - Mailbox to transfer to
 * @property {String} row - row in spreadsheet where the email is 
 * @property {String} column - row in spreadsheet where the email is
 */

/**
 * Gets emails from google spreadsheet.
 * @todo code to check if there are actually any emails to migrate, somthing ng like ?val.status then return val
 * if no emails to migrate, exit the program, i.e console.lognothing to do
 * @returns {Emails} Emails of transfer operation and its metadata
 */
async function fromSpreadSheet()
{
    const PAUSE = "PAUSE";
    var data ={
        function: "testfunc",
        devMode: true
    };
    var val = await getEmailsFromSpreadSheet(data);
    if (val == PAUSE){
        Logger.info(`Nothing to do value of val --> ${val}`,{label: `FromSpreadsheet()`})
        process.exit(0);
    }
        
    
    if (val == undefined)
    {
        Logger.info(`Nothing to do value of val --> ${val}`,{label: `FromSpreadsheet()`})
        process.exit(0)
    }
    return val;
}

module.exports = {controller, cont_exec};