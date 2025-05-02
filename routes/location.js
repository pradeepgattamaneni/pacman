
import { request } from 'http';
import { request as _request } from 'https';
import { Router } from 'express';
var router = Router();
import { readFileSync } from 'fs';
import { hostname as _hostname } from 'os';

import winston from 'winston';

// Create a logger
const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/usr/src/app/pacman/logs/locations.log' })
  ]
});

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
  logger.info('Time: ', Date());
  next();
})

router.get('/metadata', function(req, res, next) {
  logger.info('[GET /loc/metadata]');
  var h = getHost();
  getCloudMetadata(function(c, z) {
    logger.info(`CLOUD: ${c}`);
    logger.info(`ZONE: ${z}`);
    logger.info(`HOST: ${h}`);
    res.json({
      cloud: c,
      zone: z,
      host: h
    });
  });
});

function getCloudMetadata(callback) {
  logger.info('getCloudMetadata');
  // Query k8s node api
  getK8sCloudMetadata(function(err, c, z) {
    if (err) {
      // Try AWS next
      getAWSCloudMetadata(function(err, c, z) {
        if (err) {
          // Try Azure next
          getAzureCloudMetadata(function(err, c, z) {
            if (err) {
              // Try GCP next
              getGCPCloudMetadata(function(err, c, z) {
                if (err) {
                  // Try Openstack next
                  getOpenStackCloudMetadata(function(err, c, z) {
                    // Return result regardless of error
                    callback(c, z); // Running in OpenStack or unknown
                  });
                } else {
                  callback(c, z); // Running in GCP
                }
              });
            } else {
              callback(c, z); // Running in Azure
            }
          });
        } else {
          callback(c, z); // Running in AWS
        }
      });
    } else {
      callback(c, z); // Running against k8s api
    }
  });
}

function getOpenStackCloudMetadata(callback) {
  logger.info('getOpenStackCloudMetadata');
  // Set options to retrieve OpenStack zone for instance
  var osOptions = {
    hostname: '169.254.169.254',
    port: 80,
    path: '/openstack/latest/meta_data.json',
    method: 'GET',
    timeout: 10000,
  };

  var cloudName = 'unknown',
      zone = 'unknown';

  var req = request(osOptions, (metadataRes) => {
    let error;

    if (metadataRes.statusCode !== 200) {
      error = new Error(`Request Failed.\n` +
        `Status Code: ${metadataRes.statusCode}`);
    }

    if (error) {
      logger.error(error.message);
      // consume response data to free up memory
      metadataRes.resume();
      callback(error, cloudName, zone);
      return;
    }

    logger.info(`STATUS: ${metadataRes.statusCode}`);
    logger.info(`HEADERS: ${JSON.stringify(metadataRes.headers)}`);
    metadataRes.setEncoding('utf8');

    var metaData;

    metadataRes.on('data', (chunk) => {
      logger.info(`BODY: ${chunk}`);
      metaData = JSON.parse(chunk);
    });

    metadataRes.on('end', () => {
      logger.info('No more data in response.');
      cloudName = 'OpenStack'; // Request was successful
      zone = metaData.availability_zone;

      // use extra metadata to identify the cloud if available
      if (metaData.meta) {
        clusterId = metaData.meta.clusterid;
        if (clusterId) {
          cloudName += ' - ' + clusterId.split('.')[0];
        }
      }

      logger.info(`CLOUD: ${cloudName}`);
      logger.info(`ZONE: ${zone}`);

      // return CLOUD and ZONE data
      callback(null, cloudName, zone);
    });
  });

  req.on('error', (e) => {
    logger.error(`problem with request: ${e.message}`);
    // return CLOUD and ZONE data
    callback(e, cloudName, zone);
  });

  // End request
  req.end();
}

function getAWSCloudMetadata(callback) {
  logger.info('getAWSCloudMetadata');
  // Set options to retrieve AWS zone for instance
  var awsOptions = {
    hostname: '169.254.169.254',
    port: 80,
    path: '/latest/meta-data/placement/availability-zone',
    method: 'GET',
    timeout: 10000,
  };

  var cloudName = 'unknown',
      zone = 'unknown';

  var req = request(awsOptions, (zoneRes) => {
    let error;

    if (zoneRes.statusCode !== 200) {
      error = new Error(`Request Failed.\n` +
        `Status Code: ${zoneRes.statusCode}`);
    }

    if (error) {
      logger.error(error.message);
      // consume response data to free up memory
      zoneRes.resume();
      callback(error, cloudName, zone);
      return;
    }

    logger.info(`STATUS: ${zoneRes.statusCode}`);
    logger.info(`HEADERS: ${JSON.stringify(zoneRes.headers)}`);
    zoneRes.setEncoding('utf8');

    zoneRes.on('data', (chunk) => {
      logger.info(`BODY: ${chunk}`);
      zone = chunk;
    });

    zoneRes.on('end', () => {
      logger.info('No more data in response.');
      cloudName = 'AWS'; // Request was successful

      // get the zone substring in uppercase
      var zoneSplit = zone.split('/');
      zone = zoneSplit[zoneSplit.length - 1].toLowerCase();
      logger.info(`CLOUD: ${cloudName}`);
      logger.info(`ZONE: ${zone}`);

      // return CLOUD and ZONE data
      callback(null, cloudName, zone);
    });
  });

  req.on('error', (e) => {
    logger.error(`problem with request: ${e.message}`);
    // return CLOUD and ZONE data
    callback(e, cloudName, zone);
  });

  // End request
  req.end();
}

function getAzureCloudMetadata(callback) {
  logger.info('getAzureCloudMetadata');
  // Set options to retrieve Azure zone for instance
  var azureOptions = {
    hostname: '169.254.169.254',
    port: 80,
    path: '/metadata/instance/compute/location?api-version=2017-04-02&format=text',
    method: 'GET',
    timeout: 10000,
    headers: {
      'Metadata': 'true'
    }
  };

  var cloudName = 'unknown',
      zone = 'unknown';

  var req = request(azureOptions, (zoneRes) => {
    let error;

    if (zoneRes.statusCode !== 200) {
      error = new Error(`Request Failed.\n` +
        `Status Code: ${zoneRes.statusCode}`);
    }

    if (error) {
      logger.error(error.message);
      // consume response data to free up memory
      zoneRes.resume();
      callback(error, cloudName, zone);
      return;
    }

    logger.info(`STATUS: ${zoneRes.statusCode}`);
    logger.info(`HEADERS: ${JSON.stringify(zoneRes.headers)}`);
    zoneRes.setEncoding('utf8');

    zoneRes.on('data', (chunk) => {
      logger.info(`BODY: ${chunk}`);
      zone = chunk;
    });

    zoneRes.on('end', () => {
      logger.info('No more data in response.');
      cloudName = 'Azure'; // Request was successful

      // get the zone substring in uppercase
      var zoneSplit = zone.split('/');
      zone = zoneSplit[zoneSplit.length - 1].toLowerCase();
      logger.info(`CLOUD: ${cloudName}`);
      logger.info(`ZONE: ${zone}`);

      // return CLOUD and ZONE data
      callback(null, cloudName, zone);
    });
  });

  req.on('error', (e) => {
    logger.error(`problem with request: ${e.message}`);
    // return CLOUD and ZONE data
    callback(e, cloudName, zone);
  });

  // End request
  req.end();
}

function getGCPCloudMetadata(callback) {
  logger.info('getGCPCloudMetadata');
  // Set options to retrieve GCE zone for instance
  var gcpOptions = {
    hostname: 'metadata.google.internal',
    port: 80,
    path: '/computeMetadata/v1/instance/zone',
    method: 'GET',
    timeout: 10000,
    headers: {
      'Metadata-Flavor': 'Google'
    }
  };

  var cloudName = 'unknown',
      zone = 'unknown';

  var req = request(gcpOptions, (zoneRes) => {
    let error;

    if (zoneRes.statusCode !== 200) {
      error = new Error(`Request Failed.\n` +
        `Status Code: ${zoneRes.statusCode}`);
    }

    if (error) {
      logger.error(error.message);
      // consume response data to free up memory
      zoneRes.resume();
      callback(error, cloudName, zone);
      return;
    }

    logger.info(`STATUS: ${zoneRes.statusCode}`);
    logger.info(`HEADERS: ${JSON.stringify(zoneRes.headers)}`);
    zoneRes.setEncoding('utf8');

    zoneRes.on('data', (chunk) => {
      logger.info(`BODY: ${chunk}`);
      zone = chunk;
    });

    zoneRes.on('end', () => {
      logger.info('No more data in response.');
      cloudName = 'GCP'; // Request was successful

      // get the zone substring in uppercase
      var zoneSplit = zone.split('/');
      zone = zoneSplit[zoneSplit.length - 1].toLowerCase();
      logger.info(`CLOUD: ${cloudName}`);
      logger.info(`ZONE: ${zone}`);

      // return CLOUD and ZONE data
      callback(null, cloudName, zone);
    });
  });

  req.on('error', (e) => {
    logger.error(`problem with request: ${e.message}`);
    // return CLOUD and ZONE data
    callback(e, cloudName, zone);
  });

  // End request
  req.end();
}

function getK8sCloudMetadata(callback) {
  logger.info('getK8sCloudMetadata');
  // Set options to retrieve k8s api information
  var node_name = process.env.MY_NODE_NAME;
  logger.info('Querying ' + node_name + ' for cloud data');

  try {
    var sa_token = readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
    var ca_file = readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
  } catch (err) {
    logger.info(err)
  }

  var headers = {
    'Authorization': `Bearer ${sa_token}`
  };

  var genericOptions = {
    host: 'kubernetes.default.svc',
    port: 443,
    path: `/api/v1/nodes/${node_name}`,
    timeout: 10000,
    ca: ca_file,
    headers: headers,
  };

  var cloudName = 'unknown',
      zone = 'unknown';

  var req = _request(genericOptions, (zoneRes) => {
    let error;

    if (zoneRes.statusCode !== 200) {
      error = new Error(`Request Failed.\n` +
        `Status Code: ${zoneRes.statusCode}`);
    }

    if (error) {
      logger.error(error.message);
      // consume response data to free up memory
      zoneRes.resume();
      callback(error, cloudName, zone);
      return;
    }

    logger.info(`STATUS: ${zoneRes.statusCode}`);
    logger.info(`HEADERS: ${JSON.stringify(zoneRes.headers)}`);
    zoneRes.setEncoding('utf8');

    var body = [];

    zoneRes.on('data', (chunk) => {
      body.push(chunk);
    });
    zoneRes.on('end', () => {
      var metaData = JSON.parse(body.join(''));
      logger.info(`RESULT: ${metaData}`);
      logger.info('No more data in response.');

      if (metaData.spec.providerID) {
        var provider = metaData.spec.providerID;
        cloudName = String(provider.split(":", 1)); // Split on providerID if request was successful
      }

      // use the annotation  to identify the zone if available
      if (metaData.metadata.labels['failure-domain.beta.kubernetes.io/zone']) {
        zone = metaData.metadata.labels['failure-domain.beta.kubernetes.io/zone'].toLowerCase();
      }
      // return CLOUD and ZONE data
      if (cloudName == "unknown") {
        error = new Error(`CloudName not found on node Spec`);
        logger.error(error);
        callback(error, cloudName, zone);
      }
      else {
        logger.info(`CLOUD: ${cloudName}`);
        logger.info(`ZONE: ${zone}`);
        callback(null, cloudName, zone);
      }
    });
  });

  req.on('error', (e) => {
    logger.error(`problem with request: ${e.message}`);
    // return CLOUD and ZONE data
    callback(e, cloudName, zone);
  });

  // End request
  req.end();
}

function getHost() {
  logger.info('[getHost]');
  var host = _hostname();
  logger.info(`HOST: ${host}`);
  return host;
}

export default router;