const { MongoClient } = require('mongodb');
require('dotenv').config();
const {STATUS_KEY, FUNCTIONS, DATABASE} = require ('../variables');
const {T_Logger: Logger } = require ('../logging/init')
//const calls = require('../src/calls');//- temp 
require('colors');

var DB, mongo, uri;

/**
 * Connect to the database
 * @returns Database connection
 */
async function connect() {
    uri = process.env.conn_string;
    DB = process.env.DB;//database name
    try{
        
        if (typeof mongo == 'undefined')
            mongo = new MongoClient(uri);

        else if (typeof mongo == 'object' && mongo.isConnected)
            ; 
            //nothing to do
            //i want a re-use of the already existing connection

        else
            mongo = new MongoClient(uri);
    }
    catch(e){
        console.log("Cannot connect to DB".red);
        console.log(e);
    }

    try {
        await mongo.connect();

        const db = mongo.db(DB);
        return db;
    }
    catch (e) {
        await mongo.close();
        throw e;
    }
}

/**
 * Saves message details into database
 * @param {Object} Database connection
 * @param {Object} content 
 * @param {Object} params
 */
async function saveMsg(DB, params, content) {
    //const db = await connect();
    const db = await DB;
    const message_info = db.collection("message_info");
    try {
        if (content != undefined){
            var res = await message_info.updateOne(
                { name: params.userId },
                { $push: { messages: { $each: content } } },
                { upsert: true }
            );
        }
        if (!res.acknowledged) throw new Error(`No message IDs inserted to DB. result from DB -> ${res}`)
        return res //check if write was acked
    }
   
    catch (err) {
        Logger.error(err, {label: saveMsg})
        process.exit(1)
        //console.log(`${content}`.green.bgRed);
        // throw err;
    }
    //await mongo.close();
}
/**
 * Save the newly created labels to the database
 * @param {object} DB Database connection
 * @param {Object} params 
 * @param {Object} content 
 * @param {String} label_prefix 
 */
async function saveLabel(DB, params, content, label_prefix) {
    //const db = await connect();
    const db = await DB;
    const collection = db.collection('label_data');

    try {
        await collection.insertOne(
            {
                _id: content.id,
                email: params.userId,
                prefix: label_prefix,
                new_label: `${label_prefix}/${content.name}`,
                label: content
            }
        )
    } catch (err) {
        console.log("Error inserting into database");
        throw err;
    }
}

async function saveSingleLabel(DB, params, label) {
    const db = await DB;
    const collection = db.collection('label_data');

    try {
        await collection.insertOne({
            _id: label,
            email: params.userId,

        })
    } catch (error) {
        
    }
}
/**
 * @param {Object} DB - Database connection
 * @param {Object} label - new label
 * @param {String} id - id of label to upadate
 */
async function updateLabel(DB, label, id) {
    //const db = await connect();
    const db = await DB;
    const collection = db.collection('label_data');

    try {
        await collection.updateOne(
            { "_id": id },
            { $set: { "new_id": label.id } }
        );
        //if (res.modifiedCount != 1)
        //throw new Error("update did  not work, did not update document or updated too many")
    }
    catch (err) {
        //log error email it
        throw err;
    }

}
/**
 * Get the prefix of the newly created labels
 * @param {Object} DB - Database connection 
 * @param {String} userId 
 * @returns {String} - prefix for labels
 */
async function getPrefix(DB, userId) {
    //const db = await connect();
    const db = await DB;
    const collection = db.collection('operation_status');
    const options = {
        projection: {
            _id: 0,
            prefix: 1,
            destination: 1
        }
    }

    try {
        var result = await collection.findOne(
            {
                origin: userId
            }, options);

    } catch (err) {
        throw err;
    }

    //await mongo.close();
    return result;
}
/**
 * Get all the labels for the specified user
 * @param {Object} DB - Database connection
 * @param {*} origin 
 * @returns {Cursor} - curosor to iterate through all labels
 */
async function getAllLabels(DB, origin) {
    var cursor = '';
    //const db = await connect();
    const db = await DB;
    const collection = db.collection('label_data');

    try {
        const query = { email: origin };
        let count = await collection.countDocuments(query)
        if (count == 0)
            throw new Error("There is no label data");

        cursor = await collection.find(query);

    }
    catch (err) {
        console.log(err);
        throw err;
    }

    return cursor;
}

async function saveEmailDB() {

}
/**
 * Retrieve message information
 * @param {Object} DB - Database connection
 * @param {String} key 
 * @returns Cursor
 */
async function retrieveMsg(DB, key) {
    const db = await DB;
    //const db = await connect();
    const collection = db.collection("message_info");
    const options = {
        projection: {
            _id: 0,
            messages: 1
        }
    }

    try {
        var cursor = await collection.find(
            { name: key },
            options
        );

    } catch (err) {
        throw err;
    }

    return { cursor, mongo };
}
/**
 * Use the old Id to get the new ID in the destination mailbox
 * @param {Object} DB - Database connection
 * @param {String} oldId 
 * @returns String - new id value of given old ID from the destination mailbox
 */
async function getNewLabelId(DB, oldId) {
    //const db = await connect();
    const db = await DB;
    const collection = db.collection("label_data");
    const options = {
        projection: {
            _id: 0,
            new_id: 1
        }
    }

    try {
        var id = await collection.findOne(
            { _id: oldId },
            options
        );

        //console.log(id);
    } catch (err) {
        throw err;
    }

    return id.new_id;
}

/**
 * return the contents of the label collection
 * @param {Object} DB - The database object
 * @returns {Object} Object label collectiom
 */
async function getLabelCollection(DB) {
    const db = await DB;
    const collection = db.collection("label_data");

    try {
        var labelCursor = collection.find()
        var labelData = await labelCursor.toArray()
        await labelCursor.close()

    } catch (error) {
        Logger.error(`Error retrieving label collection ${error} `,{label: "getLabelCollection"})
        process.exit(1)
    }

    return labelData[0]
    
}

/**
 * Removes given id from the database, returns true if succesful
 * @param {Object} DB - Database connection
 * @param {String} key 
 * @param {String} id 
 * @returns Boolean
 */
async function removeMsg(DB, key, id) {
    //const db = await connect();
    const db = await DB;
    const collection = db.collection("message_info");
    const filter = {
        name: key
    };

    const updateDoc = {
        $pull: {
            messages: { id: id }
        }
    };
    try {
        var res = await collection.updateOne(filter, updateDoc);
        if (res.modifiedCount == 1) {
            //await mongo.close();
            return true;
        }
        else {
            await mongo.close();
            throw new Error(`update operation failed, id: ${id}`);
        }
    } catch (err) {
        throw err;
    }

}
/**
 * Updates the status of the transfer at its dfferent stages and events
 * @param {Object} DB - Database connection
 * @param {Object} props object holiding various properties for the different operations
 * 
 * caller property must have a valid value
 * @property {String} status - Status of the current transfer
 * @property {String} userId - email of user mailbox being transfered
 * @property {String} caller - function that called this function
 * @property {String} token - pagetoken 
 * @property {String} prefix - prefix used in label creation in detsination mailbox
 * @property {Object} meta - metadata of email gotten from appscript
 * @property {String} date - date to be used to monitor progress of script
 */
async function updateOpStatus(DB, props) {
    //const db = await connect();
    const db = await DB;
    const collection = db.collection("operation_status");
    const date = new Date();
    const {pid} = require('node:process');

    switch(props.caller)
    {
        case "run":
            try {
                await collection.updateOne(
                    { origin: props.userId },
                    {
                        $set: { 
                            status: props.status ,
                            stage: props.caller,
                            lastRun: date
                        }
                    }
                );
            } catch (err) {
                console.error("Error writing to Database");
                console.error(err);
            }
            
        break;

        case "putLabel":
            try {
                await collection.updateOne(
                    { origin: props.userId },
                    {
                        $set: { 
                            status: props.status ,
                            prefix: props.prefix,
                            stage: props.caller,
                            lastRun: date,
                            PID: pid
                        }
                    }
                );
            } catch (err) {
                console.error("Error writing to Database");
                throw err;
            }
            
        break;

        case FUNCTIONS.createSave:
            try {
                await collection.updateOne(
                    { origin: props.userId },
                    {
                        $set: { 
                            status: props.status ,
                            prefix: props.prefix,
                            stage: props.caller,
                            lastRun: date,
                            PID: pid
                        }
                    }
                );
            } catch (err) {
                console.error(`Error writing to Database ${FUNCTIONS.createSave}`);
                throw err;
            }
            
        break;

        case "listandSaveMsg":
            try {
                await collection.updateOne(
                    { origin: props.userId },
                    {
                        $set: { 
                            status: props.status ,
                            pageToken: props.token,
                            stage: props.caller,
                            lastRun: date,
                            PID: pid
                        }
                    }
                );
            } catch (err) {
                console.error("Error writing to Database");
                throw err;
            }
        break;

        case "getMsg":
            try {
                await collection.updateOne(
                    { origin: props.userId },
                    {
                        $set: { 
                            status: props.status,
                            stage: props.caller,
                            lastRun: date,
                            PID: pid
                        }
                    }
                );
            } catch (err) {
                console.error("Error writing to Database");
                throw err;
            }
        break;

        case "getEmailsFromSpreadSheet":
            try {
                await collection.updateOne(
                    { origin: props.userId },
                    {
                        $set: { 
                            meta: props.meta,
                            stage: props.caller
                        }
                    }
                );
            } catch (err) {
                console.error("Error writing to Database".yellow.bgBlack);
                throw err;
            }
            
        break;

        case "restart":
            try {
                await collection.updateOne(
                    { origin: props.origin },
                    {
                        $set: { 
                            status: STATUS_KEY.stopped,
                            stage: props.caller,
                            lastRun: date
                        }
                    }
                );
            } catch (err) {
                console.error("Error writing to Database".yellow.bgBlack + "\n In restart case".yellow.bgBlack);
                throw err;
            }
            
        break;

        case STATUS_KEY.aborted:
            try {
                await collection.updateOne(
                    { origin: props.origin },
                    {
                        $set: { 
                            status: STATUS_KEY.aborted,
                            lastRun: date,
                            label_info: props.label_info,
                            abort_reason: props.reason
                            // TODO make sure to send a reason, labelData for this call

                        }
                    }
                );
            } catch (err) {
                throw err;
            }
            
        break;

        case "controller":
            try {
                await collection.updateOne(
                    { origin: props.userId },
                    {
                        $set: { 
                            status: props.status,
                            stage: props.caller,
                            lastRun: date
                        }
                    }
                );
            } catch (err) {
                console.error("Error writing to Database".yellow.bgBlack);
                throw err;
            }
            
        break;

        default:
            //should only happen for the try-catch in controller()
            console.log(`Executed default action in updateOpStatus...`.green);
            try {
                await collection.updateOne(
                    { origin: props.userId },
                    {
                        $set: { 
                            status: props.status,
                            lastRun: date
                        }
                    }
                );
            } catch (err) {
                console.error("Error writing to Database".yellow.bgBlack);
                throw err;
            }

    }

    
}
/**
 * Log errors into the database identified by the userId 
 * @param {Object} DB - Database connection
 * @param {Object} data 
 * @param {String} code 
 * @param {String} userId 
 * @param {Object} params 
 */
async function logError(DB, data, code, userId, params) {
    //const db = await connect();
    const db = await DB;
    const collection = db.collection("error_log");

    try {
        await collection.insertOne(
            {
                account: userId,
                error_msg: data,
                error_code: code,
                options: params
            }
        );
    } catch (err) {
        console.error("Error writing to Database");
        throw err;
    }
}

/**
 * Get the cursor for error_log collection
 * @param {Object} DB - DB object to access the database
 * @param {*} userId - userID/origin for account for query
 * @returns MongoDB Cursor
 */
async function getErrorLog(DB, userId)
{
    const db = await DB;
    const collection = db.collection("error_log");

    const options = {
        projection: {_id:1, account: 1, options: 1}
    };
    const query = {
        account: userId
    };

    try {
        var cursor = await collection.find(query, options)
    } catch (error) {
        console.error(`Problem with accessing the databse`.bgBlack.red);
        throw error;
    }
    
    return cursor;
}

/**
 * This log is to be used for emails that dont get transfered - most lilely emails with scripts in them
 * @param {Object} DB - Database connection
 * @param {String} origin 
 * @param {String} id 
 */
async function updateTransferLog(DB, origin, id) {
    //const db = await connect();
    const db = await DB;
    const collection = db.collection("transfer_log");
    const updateDoc = {
        $push: { failed: id }
    }

    try {
        await collection.updateOne(
            { origin: origin },
            updateDoc
        );
    } catch (err) {
        console.error("Error writing to Database");
        throw err;
    }
}

/**
 * Get count of id's left to be migrated
 * @param {Object} DB - Database connection
 * @param {String} origin 
 * @returns Aggregate Cursor
 */
async function message_count(DB, origin)
{
    //const db = await connect();
    const db = await DB;
    const collection = db.collection("message_info");
    const pipeline = [
        {$match:{ name: origin}},
        {$project: {_id:0, name: 1, count: {$size: "$messages"}}}
    ];

    try {
        var cursor = await collection.aggregate(pipeline);
        
    } catch (error) {
        console.error("error getting information from database");
        throw error;
    }
    
    return cursor;
}
/**
 * get the transfer status of the transfer operation
 * @param {Object} DB - Database connection
 * @param {String} userId - origin email address
 * @returns {String} status - Status of peration based on the result of the database oepration
 */
async function getTransferStatus(DB, userId)
{
    var status;
    //const db = await connect();
    const db = await DB;
    const collection = db.collection("transfer_log");
    const pipeline = [
        {$match:{ origin: userId}},
        {$project: {_id:0, count: {$size: "$failed"}}}
    ];

    try {
        var cursor = await collection.aggregate(pipeline);
        for await (const val of cursor)
        {
            if (val.count == 0){
                status = STATUS_KEY.done;
            }
            else{
                status = STATUS_KEY.done_err;
            }
        }
        

    } catch (error) {
        console.error(`Error getting information from database`.yellow.bgBlack +`${error}`.red);
        throw error;
    }
    return status;
}

/**
 * Get metadata to use for updating spreadsheet
 * @param {Object} DB - Database connection
 * @param {String} userId 
 * @returns Object
 */
async function getMeta(DB, userId)
{
    //const db = await connect();
    const db = await DB;
    const collection = db.collection("operation_status");
    const options = {
        projection: {
            _id: 0,
            meta: 1
        }
    }

    try {
        var res = await collection.findOne({
            origin: userId
        }, options);
    } catch (error) {
        console.error(`Error getting information from database`.yellow.bgBlack +` ${error}`.red);
        throw error;
    }
    return res.meta;
}
/**
 * Initial insert into operation_status and transfer_log database. 
 * Should only run once per email to transfer
 * @param {Object} DB - Database connection
 * @param {Object} params - parameters to insert into the database.
 * @property {String} status - Status of the current transfer
 * @property {String} origin - email of user mailbox being transfered
 * @property {String} caller - function that called this function
 * @property {Object} meta - metadata of email gotten from appscript
 * @property {String} destination - destination mailbox of the transfer operation
 */
async function initDB(DB, params)
{
    //const db = await connect();
    const db = await DB;
    var collection = db.collection("operation_status");
    const date = new Date();

    try {
        await collection.insertOne({
            origin: params.origin,
            destination: params.destination,
            meta: params.meta,
            status: params.status,
            stage: params.caller,
            lastRun: date
        });

        collection = db.collection("transfer_log");

        await collection.insertOne({
            origin: params.origin,
            failed: []
        });
    } catch (error) {
        console.error(`Error Inserting into database`.yellow.bgBlack +` ${error}`.red);
        throw error;
    }
}
/**
 * Check the database for where the script was before it was stopped 
 * @param {Object} DB - Database connection
 * @returns {String} name of last function that was called before script was stopped
 */
async function checkDB(DB)
{
    //const db = await connect();
    const db = await DB;
    var collection = db.collection("operation_status");
    const options = {
        projection: {
            _id:0,
            origin: 1,
            destination: 1,
            meta:1,
            stage: 1
        }
    }

    try {
        var res  = await collection.findOne({
            status: STATUS_KEY.stopped
        },options);
        return res;

    } catch (error) {
        console.error(`Error getting information from database`.yellow.bgBlack +` ${error}`.red);
        throw error;
    }
}
/**
 * Delete all data in label collection
 * @param {Object} DB - Database connection
 */
async function deleteAllLabels(DB)
{
    //const db = await connect();
    const db = await DB;
    var collection = db.collection("label_data");

    try {
        await collection.drop();
    } catch (error) {
        throw error;
    }
}

/**
 * Get the total message to transfer
 * @param {Object} DB - Database connection
 * @param {String} userId - origin email address
 * @returns cursor
 */
async function getMessageCount(DB, userId)
{
    //const db = await connect();
    const db = await DB;
    const collection = db.collection("message_info");
    const pipeline = [
        {$match:{ name: userId}},
        {$project: {_id:0, count: {$size: "$messages"}}}
    ];

    try {
        var cursor = collection.aggregate(pipeline);
    } catch (error) {
        console.error(`Error getting information from database`.yellow.bgBlack +`${error}`.red);
        throw error;
    }

    return cursor;
}
/**
 * Clear the messages array in the messages_info collection
 * @param {Object} DB - Database connection
 * @param {String} origin - email address to delete message IDs from collection
 * @returns Boolean
 */
async function clearMsg(DB, origin)
{
    //const db = await connect();
    const db = await DB;
    const collection = db.collection("message_info");

    const query = {name: origin}
    // const cursor = collection.find(query)
    try{
        let count = await collection.countDocuments(query)
        if (count == 0)
            {
                // create message array
                Logger.info(`message_info collection did not have an entry for this transfer ${origin} `,{label: "db.js"})
                var res = await collection.updateOne(
                    { name: origin },
                    { $set: { messages: []} },
                    { upsert: true }
                );

                if (res.acknowledged && res.upsertedCount == 1)
                    return;
                else throw new Error(`db.js: clearMsg has not worked, please check message_info collection.\n \
                user: ${origin} `);
            }
        else if (count > 0){
            Logger.info(`message_info collection has an entry for ${origin}... clearing the messages array`,{label: "db.js"})
            var res = await collection.replaceOne({"name": origin},
                {name: origin, messages: []}
                // {$set: {"messages":[]}}
            );

            if (res.acknowledged && res.modifiedCount == 1)
                return;
            else throw new Error(`db.js: clearMsg has not worked, please check message_info collection.\n \
            user: ${origin} `);
        }
    }catch(e){
        // log the error and stop execution
        Logger.error(e,{label: "DB.js --> clearMSg"})
        process.exit()
        
    }
}

/**
 * Get info from last entered document in database, used to restart the tool
 * @param {Object} DB - Database connection
 * @returns Object with result (mongo cursor) and mongo connection  
 */
async function getRunInfo(DB)
{
    //const db = await connect();
    const db = await DB;
    var collection = db.collection("operation_status");
    const options = {
        projection: {
            _id:0,
            origin: 1,
            destination: 1,
            stage: 1,
            lastRun: 1,
            status: 1,
            meta: 1,
            PID: 1
        }
    }

    try {
        //get the latest entry
        var res = await collection.find({}, options).sort({_id: -1}).limit(1);
        return {res, mongo};

    } catch (error) {
        console.error(`Error getting information from database`.yellow.bgBlack +` ${error}`.red);
        throw error;
    }
}

/**
 * copy finished transfers from operation_status to finished transfers
 * @param {Object} DB - Database mongo object
 * @param {String} origin - Email of the user to move data for
 */
async function moveToFinished(DB, origin)
{
    const db = await DB;
    var collection = db.collection(DATABASE.transfer.collection.transfer_status);
    const query = {origin: origin}
    var toInsert = [];
    try {
        var res = await collection.find(query);
        var collection2 = db.collection(DATABASE.transfer.collection.finished);
        for await(const document of res)
        {
            toInsert.push(document);
        }
        
        //copy before deleting
        var {insertedIds, insertedCount} = await collection2.insertMany(toInsert, {ordered: true});        
        let count = 0;

        for (const value of Object.values(insertedIds))
        {
            const deleteQuery = {_id: value}
            await collection.deleteOne(deleteQuery)
            count++;
        }
        if (count == insertedCount)
        {
            console.log(`Successfully deleted ${JSON.stringify(insertedIds)}`.green)
        }
        //await collection.deleteMany(deleteQuery); 

    } catch (error) {
        console.log(`${error}`.red);
        //throw error -- no need as we dont need to stop control flow
    }

}

async function moveToCancelled(DB, origin) 
{
    const db = await DB;
    var collection = db.collection(DATABASE.transfer.collection.transfer_status);
    const query = {origin: origin}
    var toInsert = [];
    try {
        var res = await collection.find(query);
        var collection2 = db.collection(DATABASE.transfer.collection.cancelled);
        for await(const document of res)
        {
            toInsert.push(document);
        }
        
        //copy before deleting
        var {insertedIds, insertedCount} = await collection2.insertMany(toInsert, {ordered: true});        
        let count = 0;

        for (const value of Object.values(insertedIds))
        {
            const deleteQuery = {_id: value}
            await collection.deleteOne(deleteQuery)
            count++;
        }
        if (count == insertedCount)
        {
            console.log(`Successfully deleted ${JSON.stringify(insertedIds)}`.green)
        }
        //await collection.deleteMany(deleteQuery); 

    } catch (error) {
        console.log(`${error}`.red);
        //throw error -- no need as we dont need to stop control flow
    }

}


module.exports = { connect, getRunInfo, 
    clearMsg, getMessageCount, 
    deleteAllLabels, getMeta, 
    checkDB, initDB, 
    getTransferStatus, message_count, 
    updateTransferLog, updateOpStatus, 
    logError, saveMsg, 
    retrieveMsg, saveLabel, 
    saveEmailDB, getPrefix, 
    getAllLabels, updateLabel, 
    getNewLabelId, removeMsg,
    saveSingleLabel, getErrorLog,
    moveToFinished, getLabelCollection,
    moveToCancelled
};