import { Router } from 'express';
var router = Router();
import pkg from 'body-parser';
const { urlencoded } = pkg;
import { ObjectId } from 'mongodb';
import Database from '../lib/database.js';

import winston from 'winston';

// Create a logger
const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/usr/src/app/pacman/logs/user.log' })
  ]
});

// create application/x-www-form-urlencoded parser
var urlencodedParser = urlencoded({ extended: false })

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
  logger.info('Time: ', Date());
  next();
})


router.get('/id', function(req, res, next) {
  logger.info('[GET /user/id]');
  Database.getDb(req.app, function(err, db) {
    if (err) {
      return next(err);
    }
    // Insert user ID and return back generated ObjectId
    var userId = 0;
    db.collection('userstats').insertOne({
      date: Date()
    }, {
      w: 'majority',
      j: true,
      wtimeout: 10000
    }, function(err, result) {
      if (err) {
        logger.error('failed to insert new user ID err =', err);
      } else {
        userId = result.insertedId;
        logger.info('Successfully inserted new user ID = ', userId);
      }
      res.json(userId);
    });
  });
});

router.post('/stats', urlencodedParser, function(req, res, next) {
  logger.info('[POST /user/stats]\n',
              ' body =', req.body, '\n',
              ' host =', req.headers.host,
              ' user-agent =', req.headers['user-agent'],
              ' referer =', req.headers.referer);

  var userScore = parseInt(req.body.score, 10),
      userLevel = parseInt(req.body.level, 10),
      userLives = parseInt(req.body.lives, 10),
      userET = parseInt(req.body.elapsedTime, 10);

  Database.getDb(req.app, function(err, db) {
    if (err) {
      return next(err);
    }

    // Update live user stats
    db.collection('userstats').updateOne({
        _id: new ObjectId(req.body.userId),
      }, { $set: {
            cloud: req.body.cloud,
            zone: req.body.zone,
            host: req.body.host,
            score: userScore,
            level: userLevel,
            lives: userLives,
            elapsedTime: userET,
            date: Date(),
            referer: req.headers.referer,
            user_agent: req.headers['user-agent'],
            hostname: req.hostname,
            ip_addr: req.ip
          }, $inc: {
            updateCounter: 1
          }
      }, {
        w: 'majority',
        j: true,
        wtimeout: 10000
      }, function(err, result) {
        var returnStatus = '';

        if (err) {
          logger.error(err);
          returnStatus = 'error';
        } else {
          logger.info('Successfully updated user stats');
          returnStatus = 'success';
        }

        res.json({
          rs: returnStatus
        });
      });
  });
});

router.get('/stats', function(req, res, next) {
  logger.info('[GET /user/stats]');

  Database.getDb(req.app, function(err, db) {
    if (err) {
      return next(err);
    }

    // Find all elements where the score field exists to avoid
    // undefined values
    var col = db.collection('userstats');
    col.find({ score: {$exists: true}}).sort([['_id', 1]]).toArray(function(err, docs) {
      var result = [];
      if (err) {
          logger.error(err);
      }
      docs.forEach(function(item, index, array) {
        result.push({
          cloud: item['cloud'],
          zone: item['zone'],
          host: item['host'],
          score: item['score'],
          level: item['level'],
          lives: item['lives'],
          et: item['elapsedTime'],
          txncount: item['updateCounter']
        });
      });
      res.json(result);
    });
  });
});


export default router;
