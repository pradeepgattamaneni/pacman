import { MongoClient } from 'mongodb';
import { database } from './config.js';
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import winston from 'winston';

let _db = null;

// Logger
const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/usr/src/app/pacman/logs/database.log' })
  ]
});

class Database {
  constructor() {
    this.tracer = trace.getTracer('pacman-database');
  }

  connect(app, callback) {
    // If already connected, reuse it
    if (_db) {
      return callback(null, _db);
    }

    const span = this.tracer.startSpan('MongoDB Connect', { kind: SpanKind.SERVER });

    MongoClient.connect(database.url, database.options)
      .then(client => {
        _db = client.db(database.name);
        app.locals.db = _db;
        logger.info('Connected to MongoDB');

        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('db.name', database.name || 'pacman');
        span.end();

        callback(null, _db);
      })
      .catch(err => {
        logger.error('Error connecting to MongoDB:', err);

        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        span.setAttribute('db.connection.status_code', 503);
        span.setAttribute('db.connection.error', err.message);
        span.end();

        callback(err, null);
      });
  }

  getDb(app, callback) {
    if (_db) {
      callback(null, _db);
    } else {
      this.connect(app, callback);
    }
  }
}

export default new Database();