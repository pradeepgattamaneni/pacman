'use strict';

const { MongoClient } = require('mongodb');  // Updated import for MongoClient
const config = require('./config');
let _db;

function Database() {
    // Async connect method to work with newer driver
    this.connect = async function(app, callback) {
        console.log('enter connect')
        try {
            const client = new MongoClient(config.database.url, config.database.options);
            await client.connect();  // Connect using async/await
            _db = client.db();  // Use the default database from the connection string
            app.locals.db = _db;  // Save db instance to app.locals for global use
            callback(null);
        } catch (err) {
            console.error('Error connecting to MongoDB:', err);
            callback(err);
        }
    }

    // Get DB instance, ensure it’s connected
    this.getDb = function(app, callback) {
        console.log('enter db')
        if (!_db) {
            // If db is not yet connected, try to connect
            this.connect(app, function(err) {
                if (err) {
                    console.log('Failed to connect to database server');
                } else {
                    console.log('Connected to database server successfully');
                }
                callback(err, _db);
            });
        } else {
            console.log('db', _db)
            callback(null, _db);  // Return the existing db instance
        }
    }
}

module.exports = new Database();  // Export singleton instance
