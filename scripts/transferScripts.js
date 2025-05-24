const {DB} = require('../src/calls');
const { deleteAllLabels } = require('../src/database/db');
const { updateSpreadSheet } = require('../src/spreadsheet');
const {STATUS_KEY} = require ('../src/variables');

/**
 *
 */
async function stopTransfer()
{
    const db = await DB;
    const collection = db.collection("operation_status");
    const query = {
        $or: [
            {status: STATUS_KEY.running},
            {status: STATUS_KEY.stopped}
        ]
    }

    const options = {
        sort: [['_id', -1]],
        limit: 1
    }

    var cursor = await getCursor(query, options);
    try {
        if (await cursor.count() <=0){
            console.log("None of the accounts meet the coditions to be aborted".red)
            process.exit(0);
        }
            
        for await (const curs of cursor)
        {
            //console.log(curs)
            const res = await collection.updateOne(
                {
                    origin: curs.origin,
                    _id: curs._id
                },
                {
                    $set: {status: STATUS_KEY.aborted}
            });
            if (!res.modifiedCount){
                console.log(`Duplicate documents to update, pleasre refine criteria \n
                ${curs}`.green);
                console.log('Stopping process')
            }
            //after updating the database, update the spreadsheet with new information

        }
        console.log(`Updating the spreadsheet....`);
        var data = {
            function: "updateSheet",
            devMode: true,
            parameters: [
                {
                    status: STATUS_KEY.aborted,
                    row: curs.meta.row,
                    column: curs.meta.column,
                    startDate: curs.meta.start_date,
                    date: Date().toString(),
                    flag: "update"
    
                }
            ],
            };
        await updateSpreadSheet(data);
        console.log(`spreadsheet updated....`);
        
    } catch (error) {
        throw error
    }

}

async function restartCurrent()
{

    console.log(`NOTE: This function will not work if the destination account is the same. \n
    If using this for the same destination account, please remove the label from the destination account and re-reun the script `.bgBlack.green);

    const db = await DB;
    const collection = db.collection("operation_status");

    await stopTransfer();
    const query = {
     status: STATUS_KEY.aborted
    };
    const options = {
        sort: [['_id', -1]],
        limit: 1
    }

    var cursor = await getCursor(query, options);

    try {
        cursor.forEach(console.dir)
        /**
         * for loop
         * update the spreadsheet
         * delete document in collection to script can npm start
         */

        for await (const curs of cursor)
        {
           var data = {
            function: "updateSheet",
            devMode: true,
            parameters: [
                {
                    status: "",
                    row: curs.meta.row,
                    column: curs.meta.column,
                    startDate: curs.meta.start_date,
                    date: Date().toString(),
                    flag: "update"
    
                }
            ],
            };
            console.log("Updating Spreadsheet...".bgBlack.green)
            await updateSpreadSheet(data);
            console.log(`spreadsheet updated`.bgBlack.green)

            //delete the document from the collection
            await collection.deleteOne({origin: curs.origin, _id: curs._id});
            //drop label_data collection
            await deleteAllLabels(db)
        }
         
    } catch (error) {
        throw error;
    }
}

async function getCursor(query, options)
{
    const db = await DB;
    const collection = db.collection("operation_status");
    
    var cursor;

    try {
        cursor = await collection.find(query, options);
    }
    catch(error){
        throw error
    }

    return cursor;
}

module.exports = { restartCurrent, stopTransfer}