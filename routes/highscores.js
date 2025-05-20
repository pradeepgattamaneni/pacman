import { Router } from 'express';
var router = Router();
import pkg from 'body-parser';
const { urlencoded } = pkg;
import Database from '../lib/database.js';

import winston from 'winston';

// Create a logger
const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/usr/src/app/pacman/logs/highscores.log' })
  ]
});


import opentelemetry from '@opentelemetry/api'
const tracer = opentelemetry.trace.getTracer('pacman-high-scores')

// create application/x-www-form-urlencoded parser
var urlencodedParser = urlencoded({ extended: false })

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
  logger.info('Time: ', Date());
  next();
})

router.get('/list', urlencodedParser, function(req, res, next) {
  logger.info('[GET /highscores/list]');
  Database.getDb(req.app, function(err, db) {
    const span = tracer.startSpan('/high_scores/list', {'kind':opentelemetry.SpanKind.SERVER});
    span.setAttribute('high_score_list', 'loading_score')
    if (err) {
      return next(err);
    }

    // Retrieve the top 10 high scores
    var col = db.collection('highscore');
    col.find({}).sort([['score', -1]]).limit(10).toArray(function(err, docs) {
      var result = [];
      if (err) {
        logger.error(err);
      }

      docs.forEach(function(item, index, array) {
        result.push({ name: item['name'], cloud: item['cloud'],
                      zone: item['zone'], host: item['host'],
                      score: item['score'] });
        logger.info('name: ', item['name']);
        logger.info('highscore: ', item['score']);
      });

      res.json(result);
    });
    span.end()
  });
});

// Accessed at /highscores
router.post('/', urlencodedParser, function(req, res, next) {
  logger.info('[POST /highscores] body =', req.body,
              ' host =', req.headers.host,
              ' user-agent =', req.headers['user-agent'],
              ' referer =', req.headers.referer);

  var userScore = parseInt(req.body.score, 10),
      userLevel = parseInt(req.body.level, 10);

  Database.getDb(req.app, function(err, db) {

    const span = tracer.startSpan('/high_scores', {'kind':opentelemetry.SpanKind.SERVER});
    if (err) {
      return next(err);
    }


    // Insert high score with extra user data
    span.setAttribute('name', req.body.name)
    span.setAttribute('high_score', userScore)
    db.collection('highscore').insertOne({
      name: req.body.name,
      cloud: req.body.cloud,
      zone: req.body.zone,
      host: req.body.host,
      score: userScore,
      level: userLevel,
      date: Date(),
      referer: req.headers.referer,
      user_agent: req.headers['user-agent'],
      hostname: req.hostname,
      ip_addr: req.ip
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
	logger.info('Successfully inserted highscore');
        returnStatus = 'success';
      }

      res.json({
        name: req.body.name,
        zone: req.body.zone,
        score: userScore,
        level: userLevel,
        rs: returnStatus
      });
    });
    span.end()
  });
});

export default router;