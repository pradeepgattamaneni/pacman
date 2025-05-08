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
    this.tracer = trace.getTracer('pacman-Mongo-Db');
  }

  async connect(app) {
    if (_db) return _db;

    const span = this.tracer.startSpan('MongoDB Connect', { kind: SpanKind.CLIENT });

    try {
      const client = await MongoClient.connect(database.url, database.options);
      _db = client.db(database.name);
      app.locals.db = _db;

      logger.info('Connected to MongoDB');
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttribute('db.name', database.name || 'pacman');
      return _db;
    } catch (err) {
      logger.error('Error connecting to MongoDB:', err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.setAttribute('db.connection.status_code', 503);
      span.setAttribute('db.connection.error', err.message);
      throw err;
    } finally {
      span.end();
    }
  }

  async getDb(app) {
    if (_db) return _db;

    try {
      return await this.connect(app);
    } catch (err) {
      logger.error('Database connection failed:', err);
      throw err;
    }
  }
}

export default new Database();
