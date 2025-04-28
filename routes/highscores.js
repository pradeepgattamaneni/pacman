import { trace } from '@opentelemetry/api';

import { Router } from 'express';
var router = Router();
import pkg from 'body-parser';
const { urlencoded } = pkg;
import Database from '../lib/database.js';


// create application/x-www-form-urlencoded parser
var urlencodedParser = urlencoded({ extended: false })

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
  console.log('Time: ', Date());
  next();
})

const tracer = trace.getTracer('pacman');


router.get('/list', urlencodedParser, function(req, res, next) {
  console.log('[GET /highscores/list]');
  const span = tracer.startSpan('get_highscore');
  Database.getDb(req.app, function(err, db) {
    if (err) {
      return next(err);
    }

    // Retrieve the top 10 high scores
    var col = db.collection('highscore');
    col.find({}).sort([['score', -1]]).limit(10).toArray(function(err, docs) {
      var result = [];
      if (err) {
        console.log(err);
      }

      docs.forEach(function(item, index, array) {
        span.setStatus({ code: 1, message: 'result displayed' });
        result.push({ name: item['name'], cloud: item['cloud'],
                      zone: item['zone'], host: item['host'],
                      score: item['score'] });
      });

      res.json(result);
      const span = tracer.startSpan('highscore_list');
      span.setStatus({ code: 2, message: 'result printed' });
      span.end();
    });
  });
});

// Accessed at /highscores
router.post('/', urlencodedParser, function(req, res, next) {
  console.log('[POST /highscores] body =', req.body,
              ' host =', req.headers.host,
              ' user-agent =', req.headers['user-agent'],
              ' referer =', req.headers.referer);


  var userScore = parseInt(req.body.score, 10),
      userLevel = parseInt(req.body.level, 10);

  Database.getDb(req.app, function(err, db) {
    if (err) {
      return next(err);
    }

    const span = tracer.startSpan('insert_highscore');
    // Insert high score with extra user data
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
        span.setStatus({ code: 1, message: err});
        console.log(err);
        returnStatus = 'error';
      } else {
        span.setStatus({ code: 2, message: 'Successfully inserted highscore' });
        console.log('Successfully inserted highscore');
        returnStatus = 'success';
      }

      const span = tracer.startSpan('insert_highscore_completed');

      res.json({
        name: req.body.name,
        zone: req.body.zone,
        score: userScore,
        level: userLevel,
        rs: returnStatus
      });
    });
    span.end();
  });
});

export default router;
