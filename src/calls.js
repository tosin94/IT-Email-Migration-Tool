const { run } = require("./init");
const {saveSingleLabel, logError, getMessageCount, deleteAllLabels, getMeta, getTransferStatus, message_count, saveMsg, saveLabel, getPrefix, getAllLabels, updateLabel, retrieveMsg, getNewLabelId, removeMsg, updateTransferLog, updateOpStatus, moveToFinished} = require('./database/db');
const {OPCODES, STATUS_KEY, FUNCTIONS} = require('./variables');
const {updateSpreadSheet} = require('./spreadsheet');
const {T_Logger: Logger} = require('./logging/init')
require('colors');
var params = {};
let intervalID;

var DB = {};
/* self invoking function to setup the DB object  */
(async function (){
    try {
        DB = require('./database/db').connect();
    } catch (err) {
        //console.log(`Database cannot be connected => ${err}`.red)
        Logger.error(`Database cannot be connected => ${err}`)
    }
})();
/**
 * create and save the new label which is in fact the prefix - to be used when emails are to be transfered under just one label
 * @param {String} origin 
 */
async function createAndSaveLabel(origin)
{
    params.userId = origin;
    /* Split origin and save the value in the database */
    try {
        const prefix = params.userId.split("@")[0];
        //need a new way to save the label in the database
        await saveSingleLabel(DB, params,prefix);
        await updateOpStatus(DB,{status: STATUS_KEY.running, userId:params.userId, prefix:prefix, caller:FUNCTIONS.createSave});

        /* create the label in the destination user account*/
        var res = await getPrefix(DB, origin);
        params = {
            userId: res.destination,
            requestBody: {
                "labelListVisibility": "labelShow",
                "messageListVisibility": "show",
                "name": res.prefix,
                "type": "user"
            }
        }

        var result = await run(OPCODES.createLabel,params);
        await updateLabel(DB, result.data, prefix);

        //console.log("Finished creating labels in destination account");
        Logger.info("Finished creating labels in destination account",{label: 'createAndSaveLabel'});
        params = {};

    } catch (error) {
        //console.error(`problem in createAndSaveLabel() \n ${error}`.red);
        Logger.error(`problem in createAndSaveLabel ${error}`,{label: 'createAndSaveLabel'})
        throw error;
    }

}

/**
 * Gets the email of the user to transfer and obtains the labels of the user
 * @param {String} origin Emailof user perform transfer on
 */
async function listLabel(origin)
{
    //await updateOpStatus(DB, {status: STATUS_KEY.running, userId:origin, caller:FUNCTIONS.listLabel});
    var result = '';
    params.userId = origin
    
    try{
        result = await run(OPCODES.listLabel, params);
        const labels = result.data.labels;
        return labels
            
        //log saving labels into database - not console log
        //await putLabel({params, labels});
    }catch(ex){
        //console.error({Error: ex});
        Logger.error(JSON.stringify({Error:ex}),{label: 'listLabel'})
        throw ex;
    }   
}

/**
 * Save labels in the database.
 ** Do not call directly
 * 
 * @param {Object} obj - Object holding params and labels
 * @property {String} params - options passed to the run function
 * @property {Object} labels - Array holding all the labels
 */
 async function putLabel(obj)
 {
     /*
     Could use this but not doing so.
     This still saves values into db but in potentially differnt order
     */
    /*
     await Promise.all(labels.map(async (elem)=>{
         await saveLabel(params, elem);
     }));
     */
     const labels = obj.labels;
     const prefix = obj.params.userId.split("@")[0];
     await labels.reduce(async (memo, elem)=>{
         await memo;
         await saveLabel(DB, obj.params, elem, prefix);
     },undefined);
 
     //insert into operaton_status the prefix using userId as primary key
     await updateOpStatus(DB,{status: STATUS_KEY.running, userId:params.userId, prefix:prefix, caller:FUNCTIONS.putLabel});
 
     params = {}; //global VARIABLE
 }


/**
 * Create the labels in the destination account
 * @param {String} origin - email address of source account
 */
async function createLabels(origin)
{
    /*
    create prefix label before creating the labels from the db
    find the labels needed for the operation using find. it returns a cursor
    iterate through cursor async and use data to create the new labels
    */
    var res = await getPrefix(DB, origin);
    params = {
        userId: res.destination,
        requestBody: {
            "labelListVisibility": "labelShow",
            "messageListVisibility": "show",
            "name": res.prefix,
            "type": "user"
        }
    }
    
    try 
    {
        await run(OPCODES.createLabel,params);

        //start creating the other labels in the destination mailbox
        var label_cursor = await  getAllLabels(DB, origin);

        for await (const label of label_cursor)
        {
            params.requestBody.name = label.new_label;
            var result = await run(OPCODES.createLabel, params);
            await updateLabel(DB, result.data, label._id);//update document with new info from creating the label

        }
        label_cursor.close();
        //console.log("Finished creating labels in destination account");
        Logger.info('Finished creating labels in destination account')
        params = {};
    }catch(ex){
        //console.error("Problem creating labels...".red);
        Logger.error(`Problem creating labels... ${ex}`,{label: 'createLabels'})
        throw ex;
    }
    /*
    finally{
        //await label_cursor.close();
        await mongo.close();
    }
    */
}
/**
 * get all the messages for the user and save it in the database
 * @param {String} origin 
 * @param {string} query - date range to be imported
 */
async function listandSaveMsg(origin,query)
 {
     //console.log("getting the messages...");
     Logger.info('Getting the messages...')
     //setup params
     params.userId = origin;
     params.q = query
     console.time("retrieval time".green);
     try{
         do
         {
             var result = await run(OPCODES.listMessage, params);
             params.pageToken = result.data.nextPageToken;
             await updateOpStatus(DB, {status: STATUS_KEY.running, userId: params.userId, token: params.pageToken, caller:FUNCTIONS.listandsave});
             await saveMsg(DB, params, result.data.messages);
         }
             while (result.data.nextPageToken != null);
     }catch(err){
         //console.error("Error getting the messages..".red);
         Logger.error("Error getting the messages.." + err);
         //console.log(`params: ${JSON.stringify(params)}, data: ${JSON.stringify(result.data)}`.green);
         Logger.error(`params: ${JSON.stringify(params)}, data: ${JSON.stringify(result.data)}`);
         throw err;
     }
     console.timeEnd("retrieval time".green);
     
     params = {};//reset object
 }

/**
 * get all the messages for the user from the specified labels and save it in the database
 * @param {string} origin 
 * @param {array} labelIDs 
 */
async function listandSaveMsgLabel(origin,labelIDs) 
{
    Logger.info(`Retrieving the message... specific label function. labels: ${labelIDs}`,{label: FUNCTIONS.listandsaveLabel})
    params.userId = origin;
    console.time("retrieval time".green);

    try
    {
        for (const element of labelIDs)
        {
            params.labelIds = [element]
            do
            {
                var result = await run(OPCODES.listMessage, params);
                params.pageToken = result.data.nextPageToken;
                await updateOpStatus(DB, {status: STATUS_KEY.running, userId: params.userId, token: params.pageToken, caller:FUNCTIONS.listandsaveLabel});
                var res = await saveMsg(DB, params, result.data.messages);
                Logger.info(`Result for DB save operation ${JSON.stringify(res)}`, {label: "listandSaveMsgLabel feature"})
            }
                while (result.data.nextPageToken != null);                

        }

        console.timeEnd("retrieval time".green);
        params = {};//reset object
        
    }catch(err)
    {
        //console.error("Error getting the messages..".red);
        Logger.error("Error getting the messages.." + err);
        //console.log(`params: ${JSON.stringify(params)}, data: ${JSON.stringify(result.data)}`.green);
        Logger.error(`params: ${JSON.stringify(params)}, data: ${JSON.stringify(result.data)}`);
        throw err;
    }
}


/**
 * @todo update user function (update user)
 * Get the message in RFC 2822 format and send it off to be imported
 * @param {String} origin 
 * @param {String} destination
 */
async function getMsg(origin, destination)
{
    await updateUser(origin);//first update letting them know how many messages are to be transfered.
    //update user about transfer every 3 mins
    intervalID = setInterval(updateUser,180000,origin);
    await updateOpStatus(DB, {status: STATUS_KEY.running, userId:origin, caller:FUNCTIONS.getMessage});
    params = {
        userId: origin,
        format: "raw"
    }
    //once completed, remove from total messages
    try{
        var result = await retrieveMsg(DB, origin);
        for await (const msgObj of result.cursor)
        {
            await msgObj.messages.reduce(async(first, elem) => {
                await first;
                params.id = elem.id;
                var res = await run(OPCODES.getMessage, params);
                var {raw, labelIds, id} = res.data;
                await transferMailbox(raw, labelIds, id, destination, origin)
                //update user this time using different flag
            }, undefined);
        }
        //await finalCheck();
    }catch(err){
        throw err;
    }
    
    finally{
        /* if there are no more messages to transfer ... 
        update satus and necessary things
        call controller to go to next email
        */
       const msg_count = await message_count(DB, origin);
       var count = 1;//that way nothing happens if nothing has changed
       for await (const val of msg_count)
       {
           count = val.count;
       }
       var status = await getTransferStatus(DB, params.userId);
       var meta = await getMeta(DB, params.userId);//get metadata to update spreadsheet with
       
       //if there are no more messages to transfer then finished
       if (!count) 
       {
           await updateOpStatus(DB, {status: status, userId:params.userId, caller:FUNCTIONS.controller});
           await deleteAllLabels(DB);
           await moveToFinished(DB, origin)

           await updateSpreadSheet({
                function: "updateSheet",
                devMode: true,
                parameters: [
                    {
                        status: status,
                        row: meta.row,
                        column: meta.column,
                        date: Date().toString(),
                        finishDate: meta.finishDate,
                        flag: "finish"
                    }
                ],
           });
        //    await updateUser(origin)//update the user for the final time
           clearInterval(intervalID);
           await result.mongo.close();
           process.exit(0);
       }
    }
    
}
/**
 * remodel the labelIds array by using the label id to find the new_id in the label_data collection and then
 * transfer the messages including the new labels.
 * 
 ** Do not call directly
 * @param {String} raw 
 * @param {Object} labelIds 
 * @param {String} id 
 * @param {String} destination
 * @param {String} origin
 */
async function transferMailbox(raw, labelIds, id, destination, origin)
{
    //only for purpose of update the database really...
    await updateOpStatus(DB, {status: STATUS_KEY.running, userId:origin, caller:FUNCTIONS.getMessage});
    //only for purpose of update the database really...

    //check if "CHAT is part of the label"
    
    if (labelIds === undefined)
    {
        //dont wish to keep the id's for the CHAT ones
        //async funcs but no need to block
        removeMsg(DB, origin, id);
        updateTransferLog(DB, origin, id);
        return;
    }
    else if (labelIds.includes("CHAT"))
    {
        await removeMsg (DB, origin, id);
        return;
    }

    /**
     * Update the labels of the origin account with thr newly created labels & metadata
     */
    const getNewLabels = new Promise(async (resolve, reject) =>{
        try{
            var label = [];
            let {prefix} = await getPrefix(DB, origin);
            let new_id = await getNewLabelId(DB, prefix);
            label.push(new_id);
            /*
            labelIds.map(async(label_id) => {
                var res = await getNewLabelId(DB, label_id);
                label.push(res);
                return res;
            });
            */
            
            setTimeout(()=>{
                resolve (label)
            },1000)
        }catch(err)
        {
            reject(err);
        }
    }).then((response) =>{
        return response;
    });
    
   //not using params here becaue async. could potentially corrupt params contents
   const transfer = async () => {
       var labels = await getNewLabels;

       var options ={
        userId: destination,
        requestBody : {
            raw: raw,
            labelIds: labels
        },
        uploadType: "resumable"
    };
       try{
            //console.log(`importing ${id}`);
            await run(OPCODES.import, options);
            await removeMsg(DB, origin, id);
       }catch(err)
       {
           //var code  = err.response.code;//previous
           var code  = err.code;
           options.userId = origin; //userId is the archive account, we want the source account, so updating it with origin
           options.MSG_ID = id;
           await logError(DB, err.response.data,err.code, options.userId, options);
           
           switch (code.toString())
           {
               case "500":
                   //remove it from the message info collection to prevent hang
                   //will be re-transferred later
                   await removeMsg(DB, origin, id);

               case "400":
                   //update transfer log with the ID of the message that didnt transfer
                   //this log will only hold messages that are not allowed by gmail
                   //and remove it from the database
                   await updateTransferLog(DB, origin, id);
                   await removeMsg(DB, origin, id);
                break;

                default:
                    throw err;//stop script execution
           }
           //console.info("Error transfering mailbox, please check the error log..");
           Logger.error(`Error transfering mailbox, please check the DB error log.. ${err} stack ${err.stack}`),{label: `transferMailbox -- > ${options.userId}`}
           //throw err;
       }
   }
   await transfer();

    /**
     * @todo for emails that havent gone through, save as a RFC 2822 file unless i am able to convert to eml
     * save it in a drive storage somewhere.
     * could do this after transfer is finished. go through transfer log.
     * get the base64 file and organise in a folder.
     */      
}

/**
 * Update user about transfer progres
 * @param {String} origin - email of source account
 */
async function updateUser(origin)
{
    let msg_count;
    //get total messages
    var cursor = await getMessageCount(DB, origin);
    for await( const count of cursor)
    {
        msg_count = count.count;
    }
    console.log(`\n${msg_count} messages to transfer...`.green);
    Logger.info(`${origin} has ${msg_count} messages to transfer...`,{label: 'Update user'})


    // update spreadsheet about amount of messages to go
    // const {PARAMS} = require('./controller')
    // var data = {
    //     function: "progressUpdate",
    //     devMode: true,
    //     parameters: [
    //         {
    //             row: PARAMS.row,
    //             column: 9,
    //             count: msg_count,
    //             flag: "update"
    //         }
    //     ],
    // };
    // await updateSpreadSheet(data);
}

/**
 * Try and re-transfer the messages that have error 500
 * Itereate through them and call transfer mailbox on them
 */
async function consolidate(userId)
{
    

}

module.exports = { DB, listandSaveMsg,listandSaveMsgLabel,createAndSaveLabel, listLabel, createLabels, transferMailbox, getMsg};